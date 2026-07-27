"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, Receipt, Loader2, Check, AlertTriangle } from "lucide-react";
import { getPrintAdapter } from "@/lib/print/adapter";
import type { KitchenPrintState } from "@/lib/print/adapter";
import { getKitchenPrintStatus } from "@/app/r/[slug]/print/kitchen/actions";

/**
 * Cặp nút in "Phiếu bếp" + "Phiếu khách" dùng chung cho OrderPanel (bàn) và TakeawayPanel (quầy),
 * kèm CHIP TRẠNG THÁI in phiếu bếp hiện thường trực (không dùng toast — toast bay mất, nhân viên
 * bỏ sót; máy in bếp lại ở xa nên không nhìn thấy giấy ra).
 *
 * Sau khi in PHIẾU KHÁCH → hiện hộp NHẮC in tiếp phiếu bếp (chủ quán: lễ tân in tất, dễ quên phiếu
 * bếp). Bố cục: khối dọc — hàng nút ở trên, chip XUỐNG DÒNG dưới nút. Để chip cùng hàng với nút sẽ
 * ăn hết bề ngang và bóp nát cột thông tin đơn (số đơn/giờ/tên khách) bên trái.
 */
const BTN =
  "inline-flex h-8 items-center gap-xxs rounded-md border border-hairline-strong px-sm text-xs font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** Cầu in ESC/POS: phiếu bếp in tự động ở bếp → chữ trên chip nói theo "gửi bếp", không phải "in". */
const BRIDGE = process.env.NEXT_PUBLIC_PRINT_MODE === "bridge";

const POLL_MS = 2500;
const MAX_POLLS = 40; // ~100s rồi thôi, tránh gọi mãi khi cầu in tắt

function hhmm(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function TicketPrintButtons({
  slug,
  orderId,
  kitchenLabel,
}: {
  slug: string;
  orderId: string;
  /** Nhãn đơn hiển thị trong hộp nhắc, vd "#12". Bỏ trống thì không hiện số. */
  kitchenLabel?: string;
}) {
  const [remind, setRemind] = useState(false);
  const [print, setPrint] = useState<KitchenPrintState>({ status: "none", at: null });
  const polls = useRef(0);

  const refresh = useCallback(async () => {
    const next = await getKitchenPrintStatus(slug, orderId).catch(() => null);
    if (next) setPrint(next);
  }, [slug, orderId]);

  // Trạng thái đọc từ print_jobs → F5 hay đổi ca vẫn thấy đúng đơn nào đã gửi bếp.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Chờ cầu in xử lý: hỏi lại cho tới khi ra printed/failed.
  useEffect(() => {
    if (print.status !== "pending") return;
    const id = setInterval(() => {
      if (polls.current >= MAX_POLLS) {
        clearInterval(id);
        return;
      }
      polls.current += 1;
      refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [print.status, refresh]);

  const printKitchen = () => {
    polls.current = 0;
    setPrint({ status: "pending", at: null }); // phản hồi ngay, poll sẽ xác nhận bằng dữ liệu thật
    getPrintAdapter().printKitchenTicket({ slug, orderId });
    setTimeout(refresh, 1200); // in trình duyệt ghi 'printed' gần như tức thì
  };
  const printCustomer = () => {
    getPrintAdapter().printCustomerTicket({ slug, orderId });
    setRemind(true); // nhắc in phiếu bếp ngay sau khi in phiếu khách
  };

  useEffect(() => {
    if (!remind) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRemind(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [remind]);

  return (
    <>
      <div className="flex flex-col items-end gap-xxs">
        <div className="flex items-center gap-xs">
          <button type="button" onClick={printKitchen} className={BTN}>
            <Printer className="h-3.5 w-3.5" /> Phiếu bếp
          </button>
          <button type="button" onClick={printCustomer} className={BTN}>
            <Receipt className="h-3.5 w-3.5" /> Phiếu khách
          </button>
        </div>
        <KitchenPrintChip state={print} onRetry={printKitchen} />
      </div>

      {remind && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-remind-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-lg"
          onClick={() => setRemind(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-hairline-soft bg-canvas p-lg shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="print-remind-title" className="font-display text-lg text-ink">
              In phiếu bếp?
            </h3>
            <p className="mt-xs text-sm text-slate">
              Đã gửi lệnh in phiếu khách{kitchenLabel ? ` cho đơn ${kitchenLabel}` : ""}. In tiếp phiếu
              bếp để chuyển món xuống bếp?
            </p>
            <div className="mt-lg flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => setRemind(false)}
                className="inline-flex h-11 items-center rounded-md border border-hairline-strong bg-canvas px-lg text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  printKitchen();
                  setRemind(false);
                }}
                className="inline-flex h-11 items-center gap-sm rounded-md bg-primary px-lg text-sm font-medium text-primary-fg hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Printer className="h-4 w-4" /> In phiếu bếp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Chip thấp hơn nút (h-6) vì nằm dòng riêng — chỉ báo tin, không phải đích chạm chính. */
const CHIP = "inline-flex h-6 items-center gap-xxs rounded-full px-sm text-xs font-semibold";

/**
 * Chip trạng thái phiếu bếp. Thất bại là trường hợp nguy hiểm nhất (lễ tân tưởng bếp có phiếu)
 * nên tô đỏ, có role=alert và BẤM ĐƯỢC để in lại ngay — không bắt tìm lại nút.
 */
function KitchenPrintChip({
  state,
  onRetry,
}: {
  state: KitchenPrintState;
  onRetry: () => void;
}) {
  if (state.status === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        aria-live="assertive" // không dùng role=alert: sẽ nuốt mất vai trò button của phần tử
        className={`${CHIP} h-8 bg-status-late text-status-late-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-late focus-visible:ring-offset-2`}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Bếp CHƯA in — in lại
      </button>
    );
  }

  const chip =
    state.status === "pending" ? (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        {BRIDGE ? "Đang gửi bếp…" : "Đang in…"}
      </>
    ) : state.status === "printed" ? (
      <>
        <Check className="h-3.5 w-3.5" aria-hidden />
        {BRIDGE ? "Bếp đã in" : "Đã in bếp"} · {hhmm(state.at)}
      </>
    ) : (
      <>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        {BRIDGE ? "Chưa gửi bếp" : "Chưa in bếp"}
      </>
    );

  // "Chưa in bếp" = đỏ viền: món chưa xuống bếp là lỗi vận hành phải thấy ngay, nhưng để nhạt hơn
  // nền đỏ đặc của "in lỗi" — hai việc khác nhau (chưa bấm in ≠ máy in báo hỏng).
  const tone =
    state.status === "pending"
      ? "bg-status-new text-status-new-fg"
      : state.status === "printed"
        ? "bg-status-ready-bg text-status-ready"
        : "border border-status-late/50 bg-cream-soft text-status-late";

  return (
    <span className={`${CHIP} ${tone}`} aria-live="polite">
      {chip}
    </span>
  );
}
