# QD-010 — Phân quyền chi tiết khu admin (per-section RBAC)

> Ngày: 2026-07-27 · Trạng thái: **Đã chốt** · Liên quan: [[QD-009-DangNhapNhanVienEmailPin]], AUTH-04, AUTH-05, AUTH-06, MENU-02.

## Bối cảnh

Rà soát code ngày 27/07/2026 cho câu hỏi *"nhân viên cần vào setup thực đơn, nhưng ai vào admin cũng xem được doanh thu"*:

| Điểm | Hiện trạng trong code |
|---|---|
| Vào khu admin | `canAccess(role,'admin')` (`lib/auth/rbac.ts`) → **owner \| manager**. Layout `admin/(protected)/layout.tsx:25` đá cashier/waiter/kitchen về route mặc định của họ. |
| Bên trong admin | `canManage(role, _section)` — tham số `_section` **có gạch dưới vì không hề được dùng**; thân hàm trả `role === 'owner' \|\| role === 'manager'`. 6 trang (menu, tables, staff, settings, onboarding, reports) quyền **y hệt nhau**. |
| Sidebar | `components/admin/AdminNav.tsx:12-19` hardcode 6 mục, **không nhận `role`** → ai vào được admin đều thấy đủ menu. |
| "Hết món" | Toggle chỉ có ở `/admin/menu` (`AvailabilityToggle` → `setItemAvailable`, guard `canManage(role,'menu')`). POS chỉ **lọc** món hết (`MenuPanel.tsx:39,52`), không bật/tắt được. |
| Tạo nhân viên | `staff/actions.ts:12` — `PIN_ROLES = ["cashier","waiter","kitchen"]`. **Không tạo được tài khoản `manager` từ UI**; chỉ super-admin hoặc sửa DB tay. |

Nên phát biểu chính xác vấn đề **không phải** "ai cũng xem được doanh thu" (nhân viên trạm không vào được `/admin`), mà là một cặp ràng buộc kẹt nhau:

1. Nhân viên **không có đường vào hợp lệ** để phụ setup thực đơn, cũng không báo được "hết món" lúc đang bán.
2. Cách duy nhất để mở là nâng lên `manager` — nhưng `manager` **bằng đúng** `owner` bên trong admin (thấy Báo cáo doanh thu, sửa %phí/%VAT trên hóa đơn, tạo/xóa PIN nhân viên). Và đúng lúc cần thì UI **lại không tạo được** `manager`.

## Quyết định

### 1. KHÔNG mở khu admin cho nhân viên trạm
`canAccess(role,'admin')` **giữ nguyên** owner|manager. Ai cần setup thực đơn thì **cấp tài khoản vai trò `manager`**, không hạ ngưỡng vào `/admin` cho cashier/waiter/kitchen.

Lý do: bất biến *"vào được `/admin` = người được chủ tin cậy"* là thứ dễ kiểm chứng và khó hỏng nhất. Mở admin cho vai trò trạm rồi chặn từng trang bằng `canManage` là mô hình **deny-by-exception** — mỗi trang admin thêm sau này mà quên guard sẽ **mặc định lộ**. Ngưỡng vào giữ chặt thì trang mới quên guard chỉ lộ cho owner/manager.

### 2. `canManage` thành ma trận thật (không còn `_section` bị bỏ)

| Mục (`ManageSection`) | owner | manager | cashier / waiter / kitchen / station |
|---|:--:|:--:|:--:|
| `menu` — danh mục, món, giá, ảnh, modifier | ✓ | ✓ | – |
| `tables` — khu vực, bàn, QR | ✓ | ✓ | – |
| `staff` — nhân viên & PIN | ✓ | ✓ (giới hạn ở §4) | – |
| `onboarding` — wizard khởi tạo | ✓ | ✓ | – |
| `reports` — **doanh thu, món bán chạy, phương thức TT** | ✓ | ✓ | – |
| `settings` — %phí phục vụ, %VAT, logo/bìa, footer hóa đơn, duyệt order QR | ✓ | **–** | – |

**`reports` cho manager: CÓ.** Quản lý ca cần đối soát tiền mặt cuối ca (REPORT-03 sinh ra chính vì việc này). Cấm manager xem doanh thu thì phải cấm luôn việc họ chốt ca — mâu thuẫn với vai trò.

**`settings` chỉ owner.** `service_charge_pct` / `vat_pct` đi thẳng vào `computeBillTotals` → đổi một con số là đổi số tiền in trên mọi hóa đơn kể từ lúc đó. Đây là quyết định thương mại của chủ, không phải thao tác vận hành. Cùng lý do với logo/tên nhà hàng (nhận diện) và footer hóa đơn (nội dung pháp lý/khuyến mại).

> **Chủ dự án xác nhận 27/07/2026: "Cài đặt chỉ owner" — CHỐT.** (Trước đó là đề xuất trong bản
> nháp quyết định này.) Nếu về sau muốn đảo, chỉ cần đổi 1 dòng trong ma trận `canManage` + 1 dòng
> trong `tests/auth/rbac.test.ts` — không kéo theo thay đổi nào khác.

### 3. Sidebar render theo quyền
`AdminShell` đã có `role` sẵn (dùng để hiện nhãn vai trò) → truyền xuống `AdminNav`, lọc `items` bằng chính `canManage`. Mục không có quyền thì **ẩn hẳn**, không hiện rồi chặn khi bấm.

Nguyên tắc: **một nguồn sự thật**. Nav và guard trang cùng gọi `canManage`, không có bảng quyền thứ hai chép tay trong component.

### 4. Owner tạo được `manager` từ UI; manager thì không

- Mở rộng `/admin/staff` để **owner** tạo được thành viên vai trò `manager`.
- **Manager chỉ tạo/sửa/xóa được cashier / waiter / kitchen.** Manager không tạo manager khác, không sửa vai trò của chính mình hay của owner.
- **Manager đăng nhập bằng mật khẩu mạnh, KHÔNG phải PIN 4 số.** Form tạo tách 2 nhánh: vai trò trạm → ô PIN 4 số (QD-009); vai trò `manager` → ô mật khẩu ≥8 ký tự.

Lý do nhánh mật khẩu: QD-009 chấp nhận PIN 4 số (không gian 10⁴) vì *"đây là bề mặt POS/KDS nội bộ, không phải cổng khách hàng"*. Tài khoản manager mở được `/admin/reports` và `/admin/staff` — đánh đổi đó không còn đúng. Trang login admin (`/admin/login`) cũng vốn dùng mật khẩu, không có luồng PIN.

Lý do chặn manager tự tạo manager: không có nó thì phân quyền chỉ là hình thức — một manager bị lộ tài khoản có thể tự nhân bản quyền, và `canManageStaff` hiện cho manager xóa được cả membership của owner.

### 5. "Hết món" tách khỏi khu admin, đưa xuống POS/KDS

Thêm quyền **riêng**, không nằm trong `ManageSection`:

```
canToggleAvailability(role) → owner | manager | cashier | waiter | kitchen | station
```

Nhân viên bật/tắt `is_available` **ngay trên POS** (và KDS) khi bếp báo hết, không phải vào khu quản trị. Thao tác này **chỉ đổi đúng cột boolean `is_available`** — không chạm tên, giá, ảnh, modifier.

Đây mới là nhu cầu hằng ngày đứng sau câu "nhân viên cần vào setup": báo hết món lúc 7h tối, không phải sửa bảng giá.

## Hệ quả

- **Không cần migration.** `memberships.role` đã có `'manager'` trong CHECK constraint từ `0001_core_tenant.sql:37`. RLS không đổi — vẫn chỉ cách ly theo `tenant_id` (`auth_tenant_ids()`), không phân biệt vai trò ở tầng DB.
- **RBAC vẫn thuần tầng ứng dụng.** Manager bị chặn `settings` ở server action + page guard, **không** ở DB: một manager có token hợp lệ về lý thuyết vẫn ghi được `tenants.settings` qua PostgREST. Chấp nhận ở V1 (đồng nhất với mọi guard vai trò hiện có, xem QD-009 §"RLS không đổi"); nếu sau này cần siết thì thêm policy theo vai trò cho riêng `tenants.settings`, ghi thành QD mới.
- **`setItemAvailable` rời khỏi guard `canManage('menu')`** sang `canToggleAvailability` — nới quyền có chủ đích, phải có test chặn: cashier gọi được `setItemAvailable` nhưng **không** gọi được `updateItem`.
- **Tài khoản manager đang tồn tại không bị ảnh hưởng** trừ việc mất quyền vào `/admin/settings`.
- **BanDoLienKet.md** phải cập nhật cột "Truy cập" sau khi code xong (`/admin/settings` → owner).

## Phương án đã loại

- **Mở `canAccess(admin)` cho cashier/waiter rồi chặn từng trang.** Cho nhân viên sửa thực đơn mà không cần nâng vai trò, nhưng là deny-by-exception (§1): trang admin mới quên guard sẽ mặc định lộ cho cả nhân viên. Không chọn.
- **Thêm vai trò mới `menu_editor`.** Sạch về ngữ nghĩa nhưng phải sửa CHECK constraint (migration), `Role` union, `defaultSectionForRole`, form tạo nhân viên, và mọi bảng phân quyền trong tài liệu — chi phí lớn cho một nhu cầu mà `manager` đã phủ. Để dành nếu sau này thật sự cần tách "người sửa menu" khỏi "người quản lý ca".
- **Ẩn số liệu doanh thu thay vì ẩn trang Báo cáo.** Nửa vời: vẫn lộ số bill, món bán chạy — đủ để suy ra doanh thu.
- **Giữ "hết món" trong admin, chỉ nới quyền cho nhân viên vào riêng trang đó.** Bắt nhân viên rời POS giữa ca để vào khu quản trị — sai chỗ về mặt vận hành.

## Kiểm chứng

Ma trận trên là hàm thuần → test bằng vitest, không cần DB (`tests/auth/rbac.test.ts`): với **6 vai trò × 6 mục** khẳng định đúng bảng §2, cộng `canToggleAvailability` và quy tắc §4. Bổ sung checkpoint thủ công: đăng nhập manager → sidebar **không** có "Cài đặt", gõ thẳng `/admin/settings` → bị đá về `/admin`.
