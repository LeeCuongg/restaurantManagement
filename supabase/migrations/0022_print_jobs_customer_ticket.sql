-- 0022_print_jobs_customer_ticket.sql — Ghi log in PHIẾU KHÁCH (PRINT-04).
--
-- Trước đây chỉ phiếu bếp được ghi vào print_jobs nên POS biết "bếp đã có phiếu chưa", còn phiếu
-- khách thì mù: in rồi hay chưa, in mấy lần đều không biết. Quán đông, lễ tân đưa nhầm/đưa hai
-- lần là chuyện thường. Thêm 'customer_ticket' vào ràng buộc type để dùng chung một bảng log,
-- một cách đọc trạng thái (0010).
--
-- Chỉ nới ràng buộc, không đụng dữ liệu cũ → an toàn chạy lại nhiều lần.

alter table public.print_jobs drop constraint if exists print_jobs_type_check;
alter table public.print_jobs
  add constraint print_jobs_type_check
  check (type in ('receipt', 'kitchen_ticket', 'customer_ticket'));

-- Đếm số lần in của MỘT đơn là truy vấn chạy mỗi lần POS vẽ lại cụm nút in.
create index if not exists idx_print_jobs_tenant_type_created
  on public.print_jobs (tenant_id, type, created_at desc);
