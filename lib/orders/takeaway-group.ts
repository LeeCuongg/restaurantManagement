import type { OnlineOrderView } from "./online";

/**
 * Gom đơn không gắn bàn thành NHÓM "gọi thêm" (QD-011, ORDER-14).
 *
 * Module THUẦN, KHÔNG `server-only`: `TakeawayPanel` là client component nên phải gom được ở
 * client. (`online.ts` chạm Supabase nên bị khóa server; type import ở đây bị xóa lúc biên dịch.)
 */

/** Một nhóm: đơn gốc + các lượt gọi thêm, tổng gộp. */
export type TakeawayGroup = {
  root: OnlineOrderView;
  children: OnlineOrderView[];
  /** Σ món chưa hủy của cả nhóm — đúng số tiền khách trả MỘT lần. */
  total: number;
};

/**
 * Gom danh sách phẳng theo `parentOrderId`, giữ thứ tự thời gian của đơn gốc.
 *
 * Đơn con "mồ côi" (gốc không còn trong danh sách vì đã hủy hoặc đã hoàn tất) được nâng thành
 * nhóm riêng thay vì biến mất khỏi màn hình — nhân viên vẫn phải thu được tiền món đó.
 *
 * `newestFirst`: đảo thứ tự NHÓM (đơn khách mới nhất lên đầu) — quán đông thì đơn vừa gõ phải nằm
 * ngay tầm mắt, không bắt nhân viên cuộn xuống đáy. Các lượt gọi thêm TRONG nhóm vẫn giữ thứ tự
 * thời gian tăng dần (đọc theo trình tự khách gọi).
 */
export function groupTakeawayOrders(
  orders: OnlineOrderView[],
  opts: { newestFirst?: boolean } = {}
): TakeawayGroup[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const childrenOf = new Map<string, OnlineOrderView[]>();
  const roots: OnlineOrderView[] = [];

  for (const o of orders) {
    if (o.parentOrderId && byId.has(o.parentOrderId)) {
      const list = childrenOf.get(o.parentOrderId) ?? [];
      list.push(o);
      childrenOf.set(o.parentOrderId, list);
    } else {
      roots.push(o); // gồm cả đơn con mồ côi
    }
  }

  const ordered = opts.newestFirst
    ? [...roots].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : roots;

  return ordered.map((root) => {
    const children = childrenOf.get(root.id) ?? [];
    return {
      root,
      children,
      total: root.total + children.reduce((s, c) => s + c.total, 0),
    };
  });
}
