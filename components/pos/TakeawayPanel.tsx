"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, ShoppingBag, Plus, CornerDownRight } from "lucide-react";
import type { CustomerMenuItem } from "@/lib/orders/customer-menu";
import type { CartLine } from "@/lib/orders/types";
import type { BillView, PaymentMethod } from "@/lib/billing/types";
import type { OnlineOrderView } from "@/lib/orders/online";
import { groupTakeawayOrders } from "@/lib/orders/takeaway-group";
import { formatVnd, unitPrice } from "@/lib/orders/cart";
import { getPrintAdapter } from "@/lib/print/adapter";
import { QtyStepper } from "@/components/customer/QtyStepper";
import { ModifierSheet, type PendingLine } from "@/components/customer/ModifierSheet";
import { Input } from "@/components/ui/input";
import { PaymentDialog } from "./PaymentDialog";
import { CancelItemDialog, type CancelStaff } from "./CancelItemDialog";
import { TicketPrintButtons } from "./TicketPrintButtons";
import {
  createTakeawayOrderAction,
  openOnlineBillAction,
  payOnlineBillAction,
} from "@/app/r/[slug]/pos/actions";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

type CancelTarget = { id: string; name: string; variant: "item" | "order" };

/** Danh sách món của MỘT đơn — dùng lại cho đơn gốc và từng lượt gọi thêm. */
function OrderLines({
  order,
  onCancelItem,
}: {
  order: OnlineOrderView;
  onCancelItem: (t: CancelTarget) => void;
}) {
  return (
    <ul className="mt-sm flex flex-col divide-y divide-hairline-soft">
      {order.items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-md py-xs">
          <div className="min-w-0">
            <p className="text-sm text-ink">
              {it.qty}× {it.name}
            </p>
            {it.modifiers.length > 0 && (
              <p className="text-xs text-steel">{it.modifiers.join(" · ")}</p>
            )}
            {it.note && <p className="text-xs italic text-stone">“{it.note}”</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-xs">
            <span className="text-sm tabular-nums text-steel">
              {formatVnd(it.unitPrice * it.qty)}
            </span>
            <button
              type="button"
              onClick={() => onCancelItem({ id: it.id, name: it.name, variant: "item" })}
              className="inline-flex h-8 items-center rounded-md px-sm text-xs font-medium text-status-late hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-late focus-visible:ring-offset-2"
            >
              Hủy
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * TakeawayPanel (POS — đơn KHÔNG gắn bàn). Xử lý TRỌN trên /pos, chịu nhiều khách liên tục:
 *  - Trên cùng: gõ đơn mới (giỏ + tên/SĐT) → tạo đơn (source=staff, confirmed → xuống bếp).
 *  - Dưới: danh sách đơn ĐANG CHỜ — mỗi đơn hiện món + tổng (như panel bàn), có "In phiếu
 *    bếp" + "Thu tiền & hoàn tất". Tạo xong đơn tự vào danh sách, builder sạch cho khách kế.
 *
 * GỌI THÊM (ORDER-14 · QD-011): mỗi nhóm hiện thành MỘT khối — đơn gốc + các lượt gọi thêm, tổng
 * gộp, MỘT nút thu tiền. Bấm "Gọi thêm" đưa builder sang chế độ nối vào nhóm đó; liên kết được
 * ghi NGAY LÚC TẠO nên nhân viên không phải nhớ ngược lúc thu tiền.
 */
export function TakeawayPanel({
  slug,
  cart,
  itemMap,
  orders,
  onCartQty,
  onCartRemove,
  onCartEdit,
  onClearCart,
  onClose,
  cancelStaff,
  canCancelWithoutPin,
  counter = false,
  filterOrderId = null,
  onClearFilter,
  searchSlot = null,
}: {
  slug: string;
  cart: CartLine[];
  itemMap: Map<string, CustomerMenuItem>;
  orders: OnlineOrderView[];
  onCartQty: (lineId: string, qty: number) => void;
  onCartRemove: (lineId: string) => void;
  onCartEdit: (lineId: string, line: PendingLine) => void;
  onClearCart: () => void;
  onClose: () => void;
  cancelStaff: CancelStaff[];
  canCancelWithoutPin: boolean;
  /**
   * Quán chế độ QUẦY (service_mode='counter'): nhân viên gõ đơn cho khách tại quầy, khách ngồi ăn
   * tại quán nhưng không gắn bàn → chữ nói theo "gọi món cho khách", KHÔNG phải "mang về". Chế độ
   * bàn thì panel này đúng nghĩa bán mang về. Cũng ẩn nút đóng vì chế độ quầy không có bàn để về.
   */
  counter?: boolean;
  /** Lọc hàng đợi còn đúng nhóm chứa đơn này (chọn từ ô "Tìm số đơn"). */
  filterOrderId?: string | null;
  onClearFilter?: () => void;
  /** Ô "Tìm số đơn" đặt trong header panel — chế độ quầy không có bàn nên nó thuộc về đây. */
  searchSlot?: React.ReactNode;
}) {
  const title = counter ? "Gọi món cho khách" : "Bán mang về";
  const createLabel = counter ? "Tạo đơn" : "Tạo đơn mang về";
  const hideClose = counter; // chế độ quầy không có bàn để quay về

  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payBill, setPayBill] = useState<BillView | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState<{
    lineId: string;
    item: CustomerMenuItem;
    initial: { qty: number; note: string; optionIds: string[] };
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  /** Đơn gốc đang được nối thêm (chế độ "Gọi thêm"); null = tạo đơn mới độc lập. */
  const [addToOrderId, setAddToOrderId] = useState<string | null>(null);

  const groups = useMemo(() => groupTakeawayOrders(orders), [orders]);
  const addingTo = groups.find((g) => g.root.id === addToOrderId) ?? null;
  // Nhóm biến mất (đã thu tiền/hủy ở thiết bị khác) → tự thoát chế độ gọi thêm thay vì gửi lên
  // server một parent không còn hợp lệ.
  const addToId = addingTo ? addToOrderId : null;

  const cartTotal = cart.reduce((s, l) => {
    const it = itemMap.get(l.itemId);
    return it ? s + unitPrice(it, l.optionIds) * l.qty : s;
  }, 0);

  const orderLabel = (o: OnlineOrderView) => (o.kitchenNo != null ? `#${o.kitchenNo}` : "");

  // Chọn một số đơn ở ô "Tìm số đơn" → hàng đợi LỌC còn đúng nhóm chứa đơn đó (kể cả khi số đơn
  // là một lượt gọi thêm — vẫn hiện cả nhóm vì tiền thu theo nhóm).
  const visibleGroups = filterOrderId
    ? groups.filter(
        (g) => g.root.id === filterOrderId || g.children.some((c) => c.id === filterOrderId)
      )
    : groups;
  const filteredOrder = filterOrderId
    ? groups
        .flatMap((g) => [g.root, ...g.children])
        .find((o) => o.id === filterOrderId) ?? null
    : null;

  const optionNames = (item: CustomerMenuItem, optionIds: string[]) => {
    const set = new Set(optionIds);
    const names: string[] = [];
    for (const g of item.groups) for (const o of g.options) if (set.has(o.id)) names.push(o.name);
    return names;
  };

  const create = async () => {
    if (cart.length === 0) return;
    setCreating(true);
    setError(null);
    const res = await createTakeawayOrderAction(
      slug,
      cart.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note, optionIds: l.optionIds })),
      // Lượt gọi thêm không hỏi lại tên/SĐT — đã có ở đơn gốc.
      addToId
        ? undefined
        : { name: name.trim() || undefined, phone: phone.trim() || undefined },
      undefined,
      addToId ?? undefined
    );
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Đơn vào danh sách chờ; dọn builder cho khách kế.
    onClearCart();
    setName("");
    setPhone("");
    setAddToOrderId(null);
    router.refresh();
  };

  const openPayment = async (orderId: string) => {
    setOpeningId(orderId);
    setError(null);
    const res = await openOnlineBillAction(slug, orderId);
    setOpeningId(null);
    if (!res.ok) setError(res.error);
    else setPayBill(res.bill);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex items-center gap-md border-b border-hairline-soft px-lg py-md">
        <h2 className="inline-flex shrink-0 items-center gap-sm font-display text-xl text-ink">
          <ShoppingBag className="h-5 w-5 text-primary" /> {title}
        </h2>
        {searchSlot && <div className="ml-auto flex shrink-0 items-center">{searchSlot}</div>}
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Đóng ${title.toLowerCase()}`}
            className="grid h-9 w-9 place-items-center rounded-md text-steel hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-lg mt-md rounded-md bg-cream-soft px-md py-sm text-sm text-status-late">
          {error}
        </p>
      )}

      {/* HAI CỘT: gõ đơn mới bên trái, hàng đợi bên phải — mỗi cột cuộn riêng. Xếp chồng chung
          một khung cuộn thì quán đông (chục đơn chờ) là ô gõ đơn bị đẩy khuất, nhân viên phải
          cuộn ngược lên mỗi lần có khách mới. Màn hẹp (<1280px) mới xếp dọc. */}
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-hairline px-lg py-md xl:max-h-none xl:w-[27rem] xl:border-b-0 xl:border-r">
        {/* ---- Đơn mới (builder) ---- */}
        <div
          className={
            addingTo
              ? "rounded-lg border-2 border-primary bg-cream-soft p-md"
              : "rounded-lg border border-hairline-soft p-md"
          }
        >
          {addingTo ? (
            // Băng nhận diện rõ ràng: nhân viên phải thấy ngay mình đang nối vào đơn nào,
            // và thoát được bằng 1 chạm. Đây là điểm mấu chốt của QD-011 — liên kết ở thời
            // điểm gõ, không phải nhớ lại lúc thu tiền.
            <div className="flex items-start justify-between gap-sm">
              <p className="inline-flex items-center gap-xs text-sm font-medium text-ink">
                <CornerDownRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Đang thêm vào Đơn {orderLabel(addingTo.root)}
                  {addingTo.root.contact?.name ? ` · ${addingTo.root.contact.name}` : ""}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setAddToOrderId(null)}
                className="shrink-0 rounded-md px-sm py-xxs text-xs font-medium text-primary hover:bg-cream-deeper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Bỏ liên kết
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-ink">Đơn mới</p>
          )}

          {/* Tên/SĐT trước, danh sách món ngay trên nút tạo đơn: nhân viên soát lại món + tổng
              tiền ở cùng một chỗ trước khi bấm. Lượt gọi thêm dùng lại thông tin đơn gốc nên
              ẩn hẳn 2 ô này. */}
          {!addingTo && (
            <div className="mt-sm flex flex-col gap-sm">
              <label className="flex flex-col gap-xxs text-sm text-slate">
                Tên khách (tùy chọn)
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="VD: Anh Nam" />
              </label>
              <label className="flex flex-col gap-xxs text-sm text-slate">
                SĐT (tùy chọn)
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} placeholder="09xx xxx xxx" />
              </label>
            </div>
          )}

          {cart.length === 0 ? (
            <p className="py-md text-center text-sm text-steel">Chạm món ở thực đơn để thêm.</p>
          ) : (
            <ul className="mt-md flex flex-col gap-sm">
              {cart.map((l) => {
                const it = itemMap.get(l.itemId);
                if (!it) return null;
                const names = optionNames(it, l.optionIds);
                return (
                  <li key={l.lineId} className="flex items-start justify-between gap-sm border-b border-hairline-soft pb-sm last:border-b-0">
                    <div className="min-w-0">
                      {/* Tên món to hơn phần còn lại: nhân viên liếc qua là soát được món đã gõ. */}
                      <p className="text-base font-medium text-ink">{it.name}</p>
                      {names.length > 0 && <p className="text-xs text-steel">{names.join(" · ")}</p>}
                      {l.note && <p className="text-xs italic text-stone">“{l.note}”</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-sm">
                      <QtyStepper value={l.qty} onChange={(v) => onCartQty(l.lineId, v)} />
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            lineId: l.lineId,
                            item: it,
                            initial: { qty: l.qty, note: l.note, optionIds: l.optionIds },
                          })
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onCartRemove(l.lineId)}
                        aria-label="Xoá khỏi giỏ"
                        className="text-xs text-status-late hover:underline"
                      >
                        Xoá
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={create}
            disabled={creating || cart.length === 0}
            className="mt-md flex h-12 w-full items-center justify-center gap-sm rounded-md bg-primary text-sm font-medium text-primary-fg hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-hairline disabled:text-muted"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${addingTo ? `Gửi bếp lượt gọi thêm` : createLabel}${
                cart.length > 0 ? ` · ${formatVnd(cartTotal)}` : ""
              }`
            )}
          </button>
        </div>

      </div>

      {/* ---- Đơn đang chờ (chưa thu tiền) — gom theo NHÓM gọi thêm ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
        {groups.length === 0 ? (
          <p className="py-xl text-center text-sm text-steel">Chưa có đơn nào đang chờ.</p>
        ) : (
          <div>
            <div className="sticky top-0 z-10 -mt-md flex flex-wrap items-center gap-sm bg-canvas py-sm">
              <p className="text-sm font-medium text-ink">
                Đơn đang chờ ({visibleGroups.length}
                {filterOrderId ? `/${groups.length}` : ""})
              </p>
              {filteredOrder && (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="inline-flex h-7 items-center gap-xxs rounded-full bg-cream-deeper px-sm text-xs font-medium text-ink hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Đang lọc: Đơn {orderLabel(filteredOrder)}
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
            {visibleGroups.length === 0 && (
              <p className="py-xl text-center text-sm text-steel">
                Đơn này không còn trong hàng đợi.
              </p>
            )}
            <div className="flex flex-col gap-md">
              {visibleGroups.map((g) => (
                <div
                  key={g.root.id}
                  className={
                    addToId === g.root.id
                      ? "rounded-lg border-2 border-primary p-md transition-shadow"
                      : "rounded-lg border border-hairline-soft p-md transition-shadow"
                  }
                >
                  {/* Header GIỮ NGUYÊN 3 điều khiển như trước (in bếp / in khách / hủy) — panel
                      chỉ ~26rem, nút thứ 4 làm vỡ hàng. "Gọi thêm" nằm ở cuối khối. */}
                  {/* Hàng 1 CHỈ số đơn + giờ: panel ~26rem vừa đúng 3 nút, thêm bất kỳ thứ gì
                      vào cột trái là bóp vỡ tiêu đề. */}
                  <div className="flex items-start justify-between gap-sm">
                    <p className="shrink-0 text-sm font-medium text-ink">
                      Đơn {orderLabel(g.root)}
                      <span className="ml-xs text-xs font-normal text-steel">
                        {hhmm(g.root.createdAt)}
                      </span>
                    </p>
                    <div className="flex shrink-0 flex-wrap items-start justify-end gap-xs">
                      <TicketPrintButtons
                        slug={slug}
                        orderId={g.root.id}
                        kitchenLabel={orderLabel(g.root) || undefined}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCancelTarget({
                            id: g.root.id,
                            name: orderLabel(g.root),
                            variant: "order",
                          })
                        }
                        className="inline-flex h-8 items-center rounded-md border border-status-late/40 px-sm text-xs font-medium text-status-late hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-late focus-visible:ring-offset-2"
                      >
                        Hủy đơn
                      </button>
                    </div>
                  </div>

                  {/* Thông tin khách chiếm HÀNG RIÊNG full-width: nhét cạnh cụm nút thì tên dài
                      hoặc "tên · SĐT" bị cắt cụt, mà đây đúng là thứ nhân viên cần đọc để gọi khách. */}
                  {(g.root.contact?.name || g.root.contact?.phone) && (
                    <p className="mt-xxs flex flex-wrap items-baseline gap-x-xs text-xs">
                      {g.root.contact?.name && (
                        <span className="font-medium text-primary">{g.root.contact.name}</span>
                      )}
                      {g.root.contact?.phone && (
                        <span className="tabular-nums text-steel">{g.root.contact.phone}</span>
                      )}
                    </p>
                  )}

                  <OrderLines order={g.root} onCancelItem={setCancelTarget} />

                  {/* Từng lượt gọi thêm: vé bếp riêng nên vẫn in/hủy riêng được, nhưng KHÔNG có
                      nút thu tiền — cả nhóm thu một lần ở chân khối. */}
                  {g.children.map((c) => (
                    <div
                      key={c.id}
                      className="mt-sm border-t border-dashed border-hairline pt-sm"
                    >
                      <div className="flex items-start justify-between gap-sm">
                        <p className="inline-flex shrink-0 items-center gap-xxs whitespace-nowrap text-xs font-medium text-steel">
                          <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Lượt {orderLabel(c)}
                          <span className="font-normal">{hhmm(c.createdAt)}</span>
                        </p>
                        <div className="flex shrink-0 flex-wrap items-start justify-end gap-xs">
                          <TicketPrintButtons
                            slug={slug}
                            orderId={c.id}
                            kitchenLabel={orderLabel(c) || undefined}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCancelTarget({ id: c.id, name: orderLabel(c), variant: "order" })
                            }
                            className="inline-flex h-8 items-center rounded-md border border-status-late/40 px-sm text-xs font-medium text-status-late hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-late focus-visible:ring-offset-2"
                          >
                            Hủy lượt
                          </button>
                        </div>
                      </div>
                      <OrderLines order={c} onCancelItem={setCancelTarget} />
                    </div>
                  ))}

                  {/* Nút hàng riêng, ngay dưới danh sách món: đọc tự nhiên là "thêm vào đơn NÀY",
                      vùng chạm rộng, và không tranh chỗ với hàng nút in/hủy ở header. */}
                  <button
                    type="button"
                    onClick={() => setAddToOrderId(g.root.id)}
                    className="mt-sm flex h-10 w-full items-center justify-center gap-xs rounded-md border border-dashed border-primary/60 text-sm font-medium text-primary hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Gọi thêm
                  </button>

                  <div className="mt-sm flex items-center justify-between gap-sm border-t border-hairline-soft pt-sm">
                    {/* Số lượt gọi thêm là span ANH EM của tổng, không lồng bên trong: lồng vào
                        thì mọi thứ đọc `innerText` của tổng (kể cả test) đều dính chữ vào số. */}
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {formatVnd(g.total)}
                      </span>
                      {g.children.length > 0 && (
                        <span className="text-xs font-normal text-steel">
                          gồm {g.children.length} lượt gọi thêm
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPayment(g.root.id)}
                      disabled={openingId === g.root.id}
                      className="inline-flex h-10 items-center justify-center gap-sm rounded-md bg-primary px-lg text-sm font-medium text-primary-fg hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {openingId === g.root.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Thu tiền & hoàn tất"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {payBill && (
        <PaymentDialog
          bill={payBill}
          busy={paying}
          onPay={async (method: PaymentMethod, amountReceived: number) => {
            setPaying(true);
            const res = await payOnlineBillAction(slug, payBill.id, { method, amountReceived });
            setPaying(false);
            if (!res.ok) return { ok: false, error: res.error };
            router.refresh();
            return { ok: true, change: res.change };
          }}
          onPrint={() => getPrintAdapter().printReceipt({ slug, billId: payBill.id })}
          onClose={() => setPayBill(null)}
        />
      )}

      <CancelItemDialog
        slug={slug}
        item={cancelTarget}
        variant={cancelTarget?.variant ?? "item"}
        open={cancelTarget !== null}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        cancelStaff={cancelStaff}
        canCancelWithoutPin={canCancelWithoutPin}
        onDone={() => setCancelTarget(null)}
      />

      <ModifierSheet
        item={editing?.item ?? null}
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        initialLine={editing?.initial ?? null}
        submitLabel="Cập nhật"
        presentation="dialog"
        onAdd={(pending) => {
          if (editing) {
            onCartEdit(editing.lineId, pending);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}
