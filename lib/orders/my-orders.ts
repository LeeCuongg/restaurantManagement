/**
 * Sổ đơn phía KHÁCH (client-only). Khách ẩn danh (D15) không có phiên → không truy được
 * đơn cũ từ server. Sau khi "Gửi order" thành công, ghi orderId vào sessionStorage theo
 * (slug + bàn) để panel "Đơn của bạn" trên trang chào bàn đọc lại. Mất khi đóng tab —
 * chấp nhận được vì đây chỉ là tiện ích tra cứu, nguồn sự thật vẫn ở DB.
 */

export type MyOrderRef = { id: string; at: string };

/** Phạm vi lưu: qr_token khi ăn tại bàn, "online" khi đặt mang về/giao. */
export function myOrdersKey(slug: string, scope: string | null): string {
  return `orders:${slug}:${scope ?? "online"}`;
}

const MAX = 20;

/** Đọc danh sách đơn đã gửi (mới nhất trước). Trả [] nếu không có/hỏng. */
export function listMyOrders(slug: string, scope: string | null): MyOrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(myOrdersKey(slug, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is MyOrderRef => !!o && typeof o.id === "string" && typeof o.at === "string"
    );
  } catch {
    return [];
  }
}

/** Ghi thêm một đơn vừa gửi (mới nhất lên đầu, khử trùng lặp, giữ tối đa 20). */
export function rememberOrder(slug: string, scope: string | null, id: string, at: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [{ id, at }, ...listMyOrders(slug, scope).filter((o) => o.id !== id)].slice(0, MAX);
    sessionStorage.setItem(myOrdersKey(slug, scope), JSON.stringify(next));
  } catch {
    /* quota */
  }
}
