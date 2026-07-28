import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nhóm "gọi thêm" cho đơn KHÔNG gắn bàn (QD-011, ORDER-14).
 *
 * Nhóm PHẲNG một tầng: `parent_order_id` null = đơn gốc; đơn con luôn trỏ thẳng về gốc, không
 * bao giờ trỏ về đơn con khác. Nhờ vậy "cả nhóm" luôn là một truy vấn duy nhất, không đệ quy.
 *
 * Chỉ áp dụng cho `channel ∈ {takeaway, delivery}`. Đơn `dine_in` gom theo `table_session_id`.
 */

/** Kênh được phép gọi thêm — dine_in đã có phiên bàn, không dùng cơ chế này. */
export function isGroupableChannel(channel: string): boolean {
  return channel === "takeaway" || channel === "delivery";
}

/**
 * Chuẩn hóa "cha" mà một đơn mới nên trỏ tới: bấm "Gọi thêm" trên một ĐƠN CON thì đơn mới vẫn
 * phải trỏ về GỐC (giữ nhóm phẳng — QD-011 §3). Trả `null` nếu đơn đích không hợp lệ để nối.
 */
export async function resolveGroupRoot(
  client: SupabaseClient,
  tenantId: string,
  orderId: string
): Promise<
  | { rootId: string; channel: string }
  | { error: string }
> {
  const { data: target } = await client
    .from("orders")
    .select("id, channel, status, parent_order_id")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();
  if (!target) return { error: "Không tìm thấy đơn để gọi thêm." };
  if (!isGroupableChannel(target.channel as string))
    return { error: "Đơn tại bàn gọi thêm bằng cách chọn bàn." };
  if (target.status === "cancelled" || target.status === "completed")
    return { error: "Đơn đã kết thúc, không gọi thêm được." };

  const rootId = (target.parent_order_id as string | null) ?? (target.id as string);

  // Gốc có thể khác đơn đích (bấm "Gọi thêm" trên đơn con) → kiểm lại chính gốc.
  if (rootId !== target.id) {
    const { data: root } = await client
      .from("orders")
      .select("id, channel, status")
      .eq("tenant_id", tenantId)
      .eq("id", rootId)
      .maybeSingle();
    if (!root) return { error: "Không tìm thấy đơn gốc của nhóm." };
    if (root.status === "cancelled") return { error: "Đơn gốc đã hủy." };
    return { rootId, channel: root.channel as string };
  }

  return { rootId, channel: target.channel as string };
}

/** Id mọi đơn trong nhóm (gốc + con), kể cả đơn đã hủy. Luôn có ít nhất `rootId`. */
export async function groupOrderIds(
  client: SupabaseClient,
  tenantId: string,
  rootId: string
): Promise<string[]> {
  const { data } = await client
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("parent_order_id", rootId);
  return [rootId, ...(data ?? []).map((r) => r.id as string)];
}

/**
 * Nhóm đã chốt sổ chưa — có bill `paid` neo vào gốc. Dùng để chặn gọi thêm sau khi thu tiền
 * (bill đã đóng thì món mới sẽ không bao giờ được tính tiền).
 */
export async function groupIsPaid(
  client: SupabaseClient,
  tenantId: string,
  rootId: string
): Promise<boolean> {
  const { data } = await client
    .from("bills")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("online_order_id", rootId)
    .eq("status", "paid")
    .maybeSingle();
  return !!data;
}
