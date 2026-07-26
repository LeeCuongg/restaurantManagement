"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { ChevronRight, Loader2, ReceiptText } from "lucide-react";
import { formatVnd } from "@/lib/orders/cart";
import { ORDER_STATUS_LABEL } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/orders/types";
import { listMyOrders } from "@/lib/orders/my-orders";
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

  const load = useCallback(async () => {
    const refs = listMyOrders(slug, qrToken);
    if (refs.length === 0) {
      setOrders([]);
      return;
    }
    const results = await Promise.all(
      refs.map(async (r) => {
        try {
          const res = await fetch(`/r/${slug}/api/order/${r.id}`, { cache: "no-store" });
          if (!res.ok) return null;
          return (await res.json()) as FetchedOrder;
        } catch {
          return null;
        }
      })
    );
    setOrders(results.filter((o): o is FetchedOrder => !!o));
  }, [slug, qrToken]);

  // Nạp lại mỗi lần mở (trạng thái có thể đã đổi ở POS/KDS trong lúc sheet đóng).
  useEffect(() => {
    if (!open) return;
    setOrders(null);
    load();
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
