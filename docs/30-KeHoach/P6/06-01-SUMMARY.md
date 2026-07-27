# 06-01 SUMMARY — Phân quyền chi tiết khu admin

**Ngày:** 27/07/2026 · **Trạng thái:** Code hoàn tất; `tsc`/`lint`/`build` xanh; 100 unit test + RLS 6/6 PASS; **smoke Playwright 2/2 PASS trên dev**. Chờ checkpoint human-verify (13 bước ở `06-01-PLAN.md`).
**Yêu cầu:** AUTH-05, AUTH-06, MENU-04 · **Quyết định:** [QD-010](../../15-QuyetDinh/QD-010-PhanQuyenKhuAdmin.md)
**Migration:** KHÔNG có — `memberships.role` đã chứa `'manager'` từ `0001_core_tenant.sql:37`.

## File đã đổi/thêm

| File | Vai trò |
|---|---|
| `lib/auth/rbac.ts` | `ManageSection` thêm `"staff"`; `canManage` thành **ma trận thật** dạng `switch` (settings → chỉ owner); `canManageStaff` ủy quyền về `canManage(role,"staff")`; **mới** `canToggleAvailability`, `canAssignRole` |
| `lib/auth/pin.ts` | **Mới** `isValidManagerPassword` + `MANAGER_PASSWORD_MIN=8` (loại cả chuỗi đúng 4 chữ số — tránh đụng quy ước suy dẫn PIN của QD-009) |
| `components/admin/AdminShell.tsx` | Truyền `role` xuống `AdminNav` |
| `components/admin/AdminNav.tsx` | Nhận `role`, mỗi item gắn `section`, lọc bằng chính `canManage` — mục không có quyền **ẩn hẳn** |
| `app/r/[slug]/admin/(protected)/page.tsx` | Ẩn thẻ "Cài đặt" theo `canManage`; comment cảnh báo: thêm KPI doanh thu vào Tổng quan thì phải bọc `canManage(role,"reports")` |
| `app/r/[slug]/admin/(protected)/staff/page.tsx` | Thêm guard cấp trang; liệt kê CẢ owner/manager; nút thao tác ẩn theo `canAssignRole`; ô đặt lại đổi PIN↔mật khẩu theo vai trò hàng |
| `app/r/[slug]/admin/(protected)/staff/actions.ts` | Bỏ `PIN_ROLES` làm điều kiện chặn → `canAssignRole`; 2 nhánh bí mật (PIN / mật khẩu); **mới** `loadTarget` đọc vai trò đích TỪ DB rồi mới kiểm quyền |
| `components/admin/staff/StaffCreateForm.tsx` | **Mới** (client) — ô bí mật đổi theo vai trò đang chọn; option "Quản lý" chỉ hiện khi được phép cấp |
| `app/r/[slug]/admin/(protected)/menu/actions.ts` | `setItemAvailable` đổi guard sang `canToggleAvailability` + ném lỗi thay vì redirect + revalidate cả `/pos`, `/kds`, `/menu`. Các action còn lại GIỮ `requireMenuManager` |
| `components/menu/AvailabilityToggle.tsx` | Thêm prop `className` (bề mặt dày đặc nâng vùng chạm ≥44px) + `touch-action: manipulation` |
| `lib/menu/search.ts` | **Mới** — `normalizeVi` tách từ `MenuPanel` để POS + KDS dùng chung |
| `components/pos/MenuPanel.tsx` | Nhận `slug`; **bỏ lọc `is_available`** → món hết vẫn hiện (mờ, icon Ban, không thêm được) + switch Còn/Hết; thẻ món đổi từ 1 `<button>` sang card có thanh toggle **anh em** |
| `components/pos/PosBoard.tsx` | Truyền `slug` xuống `MenuPanel` |
| `components/kds/SoldOutDrawer.tsx` | **Mới** — drawer "Báo hết món" (vaul, mở từ phải): tìm không dấu + danh sách phẳng + toggle |
| `components/kds/KdsBoard.tsx` | Nhận `slug` + `menu`; nút "Báo hết món" ở header kèm badge số món đang hết |
| `app/r/[slug]/kds/page.tsx` | Nạp song song `getKdsTickets` + `getCustomerMenu` |
| `tests/auth/rbac.test.ts` | **Mới** — 73 test: ma trận 6 vai trò × 6 mục, `canAccess` không hồi quy, `canToggleAvailability`, `canAssignRole` |

## Logic then chốt

- **Ngưỡng vào admin KHÔNG đổi** (QD-010 §1): `canAccess(role,"admin")` vẫn owner|manager. Nhân viên phụ setup thực đơn thì cấp vai trò `manager` — nay owner tự làm được ở `/admin/staff`.
- **Một nguồn sự thật cho quyền**: `AdminNav`, thẻ Tổng quan, guard trang và server action đều gọi `canManage`. Không có bảng vai trò chép tay lần hai.
- **`canManage` viết dạng `switch` trên `section`**: thêm mục mới vào `ManageSection` mà quên khai quyền thì TypeScript báo thiếu nhánh, thay vì im lặng rơi vào mặc định.
- **Chống leo thang quyền** (QD-010 §4): `loadTarget` đọc `role` của thành viên đích **từ DB** rồi mới `canAssignRole` — không tin `formData`. Nhờ đó `setStaffActive` cũng được vá: trước đây nó **không kiểm vai trò**, một manager có thể ban tài khoản owner.
- **Manager dùng mật khẩu ≥8 ký tự, không dùng PIN**: tài khoản manager mở được `/admin/reports` + `/admin/staff` nên đánh đổi "PIN 4 số cho bề mặt nội bộ" của QD-009 không còn đúng. `pin_hash = null` cho manager.
- **Nới quyền đúng một cột**: `setItemAvailable` chỉ `update({ is_available })`, không nhận field nào khác từ client. RLS `menu_items` vốn chỉ cách ly `tenant_id` nên phiên cashier ghi được — không cần service role.
- **Toggle là anh em của nút thêm món**, không lồng bên trong: nút trong nút là HTML không hợp lệ và bấm "Hết" sẽ nổi bọt lên mở `ModifierSheet`.

## Sai khác có chủ đích so với PLAN

- **PLAN nói tách `norm` "của MenuPanel"; thực tế đưa hẳn ra `lib/menu/search.ts`** (`normalizeVi`) để KDS import không phải kéo theo cả `MenuPanel`.
- **Trang Tổng quan không chỉ thêm comment mà còn ẩn thẻ "Cài đặt"** với manager — PLAN §2b có nêu, ghi lại đây cho rõ đây là thay đổi hành vi chứ không phải chỉ chú thích.
- **Danh sách `/admin/staff` nay liệt kê cả owner/manager** (trước chỉ 3 vai trò trạm). Cần thiết để owner thấy và quản lý được tài khoản manager vừa cấp; hàng không có quyền tác động hiện "Không thao tác được".
- **Trường form đổi tên `pin` → `secret`** ở `createStaff`/`resetPin` vì một ô phục vụ cả PIN lẫn mật khẩu. Đã rà: không còn caller nào khác dùng tên cũ.

## Bằng chứng

**Tĩnh** — `npx tsc --noEmit` → 0 lỗi · `npm run lint` → ✔ No ESLint warnings or errors · `npm run build` → thành công (tất cả route biên dịch).

**Unit** — `npx vitest run tests/auth tests/billing tests/orders tests/ui` → **100 passed (5 files)**, trong đó `tests/auth/rbac.test.ts` **73 passed**.

**RLS** — `npm run test:rls` → **6/6 PASS** (không hồi quy cách ly tenant).

**Smoke Playwright trên dev (localhost:3000, tenant `pho-viet`)** — 2 spec, cả hai PASS. Bản spec lưu ở scratchpad phiên làm việc (`qd010-smoke.spec.ts`, `menu04-smoke.spec.ts`); **chưa đưa vào repo** vì E2E chính thức thuộc 06-02.

| # | Khẳng định (AUTH-05/06) | KQ |
|---|---|---|
| 1 | Owner: sidebar có cả "Cài đặt" và "Báo cáo" | ✓ |
| 2 | Owner tạo được `manager` bằng mật khẩu; ô bí mật tự đổi `type=password` | ✓ |
| 3 | Tài khoản manager đăng nhập được vào `/admin` | ✓ |
| 4 | Manager: sidebar **ẩn "Cài đặt"**, vẫn có "Báo cáo" | ✓ |
| 5 | Manager gõ thẳng `/admin/settings` → redirect `/admin` | ✓ |
| 6 | Manager xem được `/admin/reports` | ✓ |
| 7 | Manager: form nhân viên **không có** option "Quản lý" | ✓ |
| 8 | Owner xóa được tài khoản manager (dọn dữ liệu test) | ✓ |

| # | Khẳng định (MENU-04) | KQ |
|---|---|---|
| 1 | POS hiện switch Còn/Hết trên thẻ món | ✓ |
| 2 | Bấm "Hết" → `aria-checked=false`, nút thêm món bị vô hiệu | ✓ |
| 3 | Bấm toggle **không** mở `ModifierSheet` | ✓ |
| 4 | Tải lại POS vẫn "Hết" (đã ghi DB) | ✓ |
| 5 | Trang khách `/menu` hiện nhãn "Hết" | ✓ |
| 6 | KDS drawer "Báo hết món" bật lại được món | ✓ |
| 7 | Tìm không dấu trong drawer khớp tên có dấu | ✓ |

Dữ liệu test đã dọn sạch (kiểm lại `memberships like 'trang.qd010%'` → rỗng); món dùng để test đã bật lại "Còn".

## Việc còn lại

1. **Checkpoint human-verify 13 bước** ở `06-01-PLAN.md` — phần smoke chưa phủ: đăng nhập bằng tài khoản **cashier/kitchen thật** (email + PIN) để xác nhận đúng trải nghiệm nhân viên, và kiểm cách ly tenant bằng mắt (owner Bún Bò).
2. Sau khi approved: cập nhật `00-TongQuan/BanDoLienKet.md` §3 (`/admin/settings` → owner; bỏ dòng `/admin/data-scope` đã lệch) và đánh ☑ AUTH-05/06 + MENU-04 ở `20-DanhSachYeuCau/00-Requirements.md`.

## Ghi chú rủi ro còn mở

- **RBAC vẫn thuần tầng ứng dụng.** Manager bị chặn `settings` ở page + server action, **không** ở DB: token hợp lệ về lý thuyết vẫn ghi được `tenants.settings` qua PostgREST. Chấp nhận ở V1 (đồng nhất mọi guard vai trò hiện có — QD-009); siết thì cần policy theo vai trò cho riêng `tenants.settings`, ghi thành QD mới.
- ~~Điểm chủ nhà hàng chưa xác nhận~~ — **đã chốt 27/07/2026**: `settings` chỉ owner. Code không đổi (vốn đã làm đúng vậy); QD-010 §2 nay ghi là quyết định chính thức thay vì đề xuất.
