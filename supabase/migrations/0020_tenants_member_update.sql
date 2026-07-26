-- 0020_tenants_member_update.sql — Cho owner/manager LƯU ĐƯỢC nhận diện nhà hàng.
--
-- LỖI TRƯỚC ĐÓ: bảng tenants chỉ có policy SELECT (thành viên) + ALL (super-admin). Owner/manager
-- update tenants → khớp 0 dòng. PostgREST/Supabase coi "0 dòng" là THÀNH CÔNG (error = null) nên
-- updateIdentity/updateProfile/uploadLogo báo "Đã lưu" mà không ghi gì: tên, logo, ảnh bìa đều
-- mất im lặng. Đây là lý do tenants.logo_url luôn NULL dù chủ quán đã upload.
--
-- Nguyên tắc 0002 giữ nguyên: RLS lo CÁCH LY TENANT, vai trò kiểm ở tầng app
-- (requireSettingsManager + canManage). Policy dưới đây chỉ mở đúng phạm vi tenant của mình.
--
-- Siết theo CỘT thay vì mở cả bảng: `status` (tạm ngưng) và `slug` (đang được QR mã hoá) phải
-- do super-admin đổi. Super-admin ghi qua service role nên KHÔNG bị grant này chặn.

alter table public.tenants enable row level security;

drop policy if exists tenants_member_update on public.tenants;
create policy tenants_member_update on public.tenants
  for update
  using (id in (select public.auth_tenant_ids()) or public.is_super_admin())
  with check (id in (select public.auth_tenant_ids()) or public.is_super_admin());

-- Quyền cột: bỏ UPDATE toàn bảng (Supabase mặc định grant ALL), chỉ mở các cột nhận diện +
-- cấu hình vận hành. Không mở: id, slug, subdomain, status, created_at.
revoke update on public.tenants from authenticated;
revoke update on public.tenants from anon;
grant update (name, logo_url, cover_url, settings, updated_at)
  on public.tenants to authenticated;
