-- 0021_order_parent.sql — Gọi thêm cho đơn KHÔNG gắn bàn (QD-011, ORDER-14).
--
-- Đơn mang về / tại quầy thiếu khái niệm "phiên" nên mỗi lượt gọi thêm thành một đơn rời,
-- kéo theo mỗi đơn một bill → khách trả tiền nhiều lần. Cột này nối các lượt gọi của CÙNG
-- một khách lại ngay lúc tạo (không gộp lúc thu tiền — nhân viên không phải nhớ ngược).
--
-- Nhóm PHẲNG một tầng: đơn con không làm cha đơn khác (kiểm ở tầng ứng dụng, xem
-- lib/orders/order-group.ts). Nhờ vậy "cả nhóm" luôn là 1 truy vấn:
--     where id = :root or parent_order_id = :root
--
-- Đơn dine_in KHÔNG dùng cột này (đã có table_session_id gom theo phiên bàn).
-- RLS không đổi: orders vẫn chỉ cách ly theo tenant_id.

alter table public.orders
  add column if not exists parent_order_id uuid
    references public.orders (id) on delete set null;

comment on column public.orders.parent_order_id is
  'Đơn gốc của nhóm gọi thêm (QD-011). NULL = đơn gốc. Chỉ dùng cho đơn không gắn bàn.';

-- Đọc "các đơn con của gốc X" là truy vấn nóng nhất của panel bán mang về.
create index if not exists idx_orders_parent
  on public.orders (tenant_id, parent_order_id)
  where parent_order_id is not null;
