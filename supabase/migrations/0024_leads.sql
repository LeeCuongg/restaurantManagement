-- 0024_leads.sql — Khách quan tâm để lại liên hệ ở trang giới thiệu (MKT-02/03).
--
-- KHÔNG có tenant_id: đây là khách của NỀN TẢNG (người đang cân nhắc mua), chưa thuộc
-- nhà hàng nào. Vì vậy không dùng được RLS theo auth_tenant_ids() như các bảng khác.
--
-- BẢO MẬT: bật RLS và CỐ Ý KHÔNG tạo policy nào. Postgres mặc định từ chối mọi thao tác
-- khi không có policy khớp ⇒ anon/authenticated không đọc cũng không ghi được. Toàn bộ
-- ghi (server action trang landing) và đọc (/super/leads) đi qua service role, vốn bỏ qua
-- RLS. Đây là dữ liệu cá nhân nên giữ tối thiểu: tên + SĐT + ghi chú, không gì khác.

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) >= 2),
  phone        text not null check (phone ~ '^0\d{9,10}$'),  -- đã chuẩn hóa ở tầng app
  note         text,
  source       text not null default 'landing',
  status       text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at   timestamptz not null default now(),
  contacted_at timestamptz
);

-- Màn /super/leads sắp xếp mới nhất trước; lọc chống-bấm-lặp tra theo (phone, created_at).
create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_phone_created on public.leads (phone, created_at desc);

alter table public.leads enable row level security;

-- Thu hồi quyền bảng của các role công khai cho chắc: RLS không policy đã chặn, nhưng
-- không cấp quyền thì ngay cả lỗi cấu hình RLS về sau cũng không làm lộ bảng.
revoke all on public.leads from anon, authenticated;
