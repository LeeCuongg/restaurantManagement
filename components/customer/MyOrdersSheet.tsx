"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { ChevronRight, Loader2, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatVnd } from "@/lib/orders/cart";
import { ORDER_STATUS_LABEL, isTerminalOrderStatus } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";
import { forgetOrder, listMyOrders } from "@/lib/orders/my-orders";
import { cn } from "@/lib/utils";

type FetchedItem = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  status: string;
};

type FetchedOrder = {
  id: string;
  status: OrderStatus;
  created_at: string;
  items: FetchedItem[];
};

/** Màu chip theo trạng thái đơn — dùng thang status của design token. */
const STATUS_CLASS: Record<OrderStatus, string> = {
  pending_confirm: "bg-status-new text-status-new-fg",
  confirmed: "bg-status-active text-status-active-fg",
  preparing: "bg-status-active text-status-active-fg",
  ready: "bg-status-ready-bg text-status-ready",
  served: "bg-status-ready-bg text-status-ready",
  completed: "bg-surface text-status-done",
  cancelled: "bg-cream-soft text-status-late",
};

/**
 * MyOrdersSheet — panel "Đơn của bạn" mở từ nút chat nổi ở trang chào bàn. Đọc orderId đã lưu
 * ở sessionStorage (lib/orders/my-orders) rồi GET /api/order/{id} từng đơn để lấy trạng thái +
 * món + tạm tính. Chỉ thấy đơn gửi từ CHÍNH máy này (khách ẩn danh, không có phiên).
 *
 * REALTIME khi panel đang mở: subscribe Broadcast `order:{id}` cho từng đơn CHƯA kết thúc
 * (giống trang theo dõi đơn — postgres_changes qua RLS không tới được khách anon), kèm polling
 * 15s dự phòng khi kênh lỗi/mất mạng. Không có phần này thì POS bấm "Duyệt" mà panel vẫn
 * đứng ở "Chờ xác nhận" tới khi khách đóng/mở lại.
 */
export function MyOrdersSheet({
  slug,
  qrToken,
  open,
  onOpenChange,
}: {
  slug: string;
  qrToken: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [orders, setOrders] = useState<FetchedOrder[] | null>(null);
  // Danh sách id đang theo dõi — lấy từ sessionStorage, cố định trong lượt mở sheet.
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  // Kênh Broadcast đang chết? Chỉ khi đó mới bật polling dự phòng.
  const [channelDown, setChannelDown] = useState(false);
  const mountedRef = useRef(false);

  const fetchOne = useCallback(
    async (id: string): Promise<FetchedOrder | null> => {
      try {
        const res = await fetch(`/r/${slug}/api/order/${id}`, { cache: "no-store" });
        // 404 = đơn không còn trong DB → bỏ khỏi sổ để không fetch lại mãi.
        if (res.status === 404) {
          forgetOrder(slug, qrToken, id);
          return null;
        }
        if (!res.ok) return null;
        return (await res.json()) as FetchedOrder;
      } catch {
        return null; // lỗi mạng: GIỮ id, lần sau thử lại
      }
    },
    [slug, qrToken]
  );

  const load = useCallback(async () => {
    const ids = listMyOrders(slug, qrToken).map((r) => r.id);
    if (ids.length === 0) {
      setTrackedIds((prev) => (prev.length === 0 ? prev : []));
      setOrders([]);
      return;
    }
    const results = await Promise.all(ids.map(fetchOne));
    if (!mountedRef.current) return;
    const found = results.filter((o): o is FetchedOrder => !!o);
    setOrders(found);
    // Chỉ theo dõi realtime các đơn CÒN tồn tại (id đã 404 thì kênh cũng vô nghĩa).
    // GIỮ NGUYÊN tham chiếu khi tập id không đổi: nếu trả array mới mỗi lần load, effect
    // realtime bên dưới sẽ huỷ + subscribe lại toàn bộ kênh, tạo khoảng trống mất message.
    setTrackedIds((prev) => {
      const next = found.map((o) => o.id);
      const same = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return same ? prev : next;
    });
  }, [slug, qrToken, fetchOne]);

  // Nạp lại mỗi lần mở (trạng thái có thể đã đổi ở POS/KDS trong lúc sheet đóng).
  useEffect(() => {
    if (!open) return;
    mountedRef.current = true;
    setOrders(null);
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [open, load]);

  /**
   * Realtime khi sheet mở: 1 kênh Broadcast cho mỗi đơn còn theo dõi (Supabase ghép chung
   * MỘT WebSocket nên N kênh không mở N kết nối). Payload đủ để đổi chip ngay; refetch đơn
   * đó để lấy giá (payload không có unit_price).
   *
   * Dep là `idsKey` (chuỗi) chứ không phải mảng: chỉ dựng lại kênh khi TẬP id thật sự đổi.
   */
  const idsKey = trackedIds.join(",");
  useEffect(() => {
    if (!open || idsKey === "") return;
    const ids = idsKey.split(",");
    const supabase = createClient();
    // Cờ theo từng lần chạy effect: sau khi dọn, MỌI báo trạng thái của kênh cũ phải bị bỏ
    // qua. removeChannel() tự bắn 'CLOSED' — nếu coi đó là lỗi thì (React StrictMode ở dev
    // mount→cleanup→mount) 'CLOSED' của lần dọn có thể về SAU 'SUBSCRIBED' của lần mới,
    // làm channelDown mắc ở true và polling chạy mãi.
    let disposed = false;

    const channels = ids.map((id) => {
      const ch = supabase.channel(`order:${id}`);
      ch.on("broadcast", { event: "status" }, ({ payload }) => {
        if (disposed) return;
        setOrders((prev) =>
          prev ? prev.map((o) => (o.id === id ? { ...o, status: payload.status } : o)) : prev
        );
        // Lấy lại bản đầy đủ (giá món) — không chặn việc đổi chip ở trên.
        void fetchOne(id).then((fresh) => {
          if (!fresh || !mountedRef.current) return;
          setOrders((prev) => (prev ? prev.map((o) => (o.id === id ? fresh : o)) : prev));
        });
      });
      ch.subscribe((status) => {
        if (disposed) return; // báo trạng thái của kênh đã dọn → không tin
        // CHỈ 'CHANNEL_ERROR'/'TIMED_OUT' là lỗi thật. 'CLOSED' là trạng thái bình thường
        // khi chính mình gỡ kênh, không được coi là mất realtime.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setChannelDown(true);
        else if (status === "SUBSCRIBED") setChannelDown(false);
      });
      return ch;
    });

    return () => {
      disposed = true;
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [open, idsKey, fetchOne]);

  /**
   * Polling CHỈ khi kênh Broadcast đang chết — không poll khi realtime hoạt động (đỡ tải
   * server và pin máy khách). Dừng khi mọi đơn đã ở trạng thái cuối.
   */
  // Dep là BOOLEAN, không phải mảng `orders`: mỗi lần load tạo mảng mới, nếu để mảng làm dep
  // thì interval bị huỷ + dựng lại liên tục và thời điểm poll trôi không kiểm soát được.
  const hasLiveOrder = !!orders && orders.some((o) => !isTerminalOrderStatus(o.status));
  useEffect(() => {
    if (!open || !channelDown || !hasLiveOrder) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [open, channelDown, hasLiveOrder, load]);

  /**
   * Máy khách khoá màn / đổi tab lâu → WebSocket có thể đã bỏ lỡ message trước khi kịp báo
   * lỗi. Quay lại thì refetch MỘT lần cho chắc, thay vì poll liên tục.
   */
  useEffect(() => {
    if (!open) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open, load]);

  const orderTotal = (o: FetchedOrder) =>
    o.items
      .filter((i) => i.status !== "cancelled")
      .reduce((s, i) => s + i.unit_price * i.qty, 0);

  const grandTotal = (orders ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + orderTotal(o), 0);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-md flex-col rounded-t-xl bg-canvas shadow-modal outline-none">
          <div className="mx-auto mt-sm h-1.5 w-10 shrink-0 rounded-full bg-hairline-strong" />
          <Drawer.Title className="shrink-0 px-lg pt-sm font-display text-xl text-ink">
            Đơn của bạn
          </Drawer.Title>
          <Drawer.Description className="shrink-0 px-lg pt-xxs text-sm text-steel">
            Các đơn đã gửi từ thiết bị này.
          </Drawer.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
            {orders === null ? (
              <div className="flex items-center justify-center gap-sm py-xl text-steel">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Đang tải…</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-sm py-xl text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-surface text-muted">
                  <ReceiptText className="h-7 w-7" />
                </span>
                <p className="text-base font-medium text-ink">Chưa có đơn nào</p>
                <p className="text-sm text-steel">
                  Đơn bạn gửi sẽ hiện ở đây để theo dõi trạng thái.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-sm">
                {orders.map((o, idx) => (
                  <li key={o.id}>
                    <Link
                      href={qrToken ? `/r/${slug}/order/${o.id}?t=${qrToken}` : `/r/${slug}/order/${o.id}`}
                      className="block rounded-lg border border-hairline-soft p-md shadow-card transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <div className="flex items-center justify-between gap-sm">
                        <span className="text-sm font-medium text-ink">
                          Lượt gọi {orders.length - idx}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-sm py-xxs text-xs font-medium",
                            STATUS_CLASS[o.status] ?? "bg-surface text-steel"
                          )}
                        >
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <p className="mt-xs line-clamp-2 text-sm text-steel">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                      </p>
                      <div className="mt-sm flex items-center justify-between">
                        <span className="text-sm font-semibold tabular-nums text-ink">
                          {formatVnd(orderTotal(o))}
                        </span>
                        <span className="inline-flex items-center gap-xxs text-xs font-medium text-primary">
                          Chi tiết
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {orders !== null && orders.length > 0 && (
            <div className="shrink-0 border-t border-hairline-soft bg-canvas px-lg py-md pb-[max(12px,env(safe-area-inset-bottom))]">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-steel">Tạm tính</span>
                <span className="font-display text-xl tabular-nums text-ink">
                  {formatVnd(grandTotal)}
                </span>
              </div>
              <p className="mt-xxs text-xs text-muted">
                Chưa gồm thuế/phí dịch vụ. Hóa đơn cuối do nhân viên chốt.
              </p>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
