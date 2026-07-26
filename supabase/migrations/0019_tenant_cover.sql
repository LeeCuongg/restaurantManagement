-- 0019_tenant_cover.sql — Ảnh bìa nhà hàng cho trang chào bàn (khách quét QR).
--
-- Trước đây tenant chỉ góp logo (logo_url) và dải nhận diện là gradient cố định. Thêm
-- cover_url để chủ quán tự đặt ảnh bìa; logo hiển thị thành AVATAR tròn đè lên bìa.
-- Không có ảnh bìa → vẫn dùng gradient sunset như cũ (không bắt buộc upload).
--
-- Cột nullable, additive → không cần backfill, không phá dữ liệu sẵn có. Ảnh nằm cùng
-- bucket menu-images (như logo, xem 0005) nên không cần policy Storage mới.

alter table public.tenants
  add column if not exists cover_url text;

comment on column public.tenants.cover_url is
  'Public URL ảnh bìa trong bucket menu-images. NULL = dùng gradient mặc định.';
