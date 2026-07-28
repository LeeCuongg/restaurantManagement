# Kế hoạch P6 — Phát hành V1.0

> Lập ngày 27/07/2026, cập nhật 28/07/2026. Nguồn: `00-TongQuan/Roadmap.md` (P6),
> `20-DanhSachYeuCau/00-Requirements.md` (AUTH-05, AUTH-06, MENU-04, ORDER-14, OPS-04 + tiêu chí V1),
> quyết định `15-QuyetDinh/QD-010`, `QD-011`.
> **Định dạng:** GSD PLAN.md như P3–P5 (frontmatter + task XML + acceptance_criteria + must_haves).

## Nguyên tắc chia P6

P6 vốn là "đóng gói phát hành", nhưng hai lỗ hổng vận hành phát hiện trong lúc dùng thử phải đóng
**trước** khi viết E2E — nếu không sẽ phải viết test hai lần theo hai mô hình khác nhau:

- **06-01** phân quyền khu admin: `canManage` trước đây bỏ qua tham số `section` nên mọi trang admin
  cùng một quyền; và không có đường tạo tài khoản `manager` từ UI.
- **06-02** gọi thêm cho đơn không gắn bàn: khách mang về / tại quầy gọi thêm thì buộc phải tạo đơn
  rời → trả tiền nhiều lần.

Sau đó mới tới E2E, PWA, seed prod, tài liệu phát hành.

| Plan | Tên | Wave | Phụ thuộc | Yêu cầu phủ | Trạng thái |
|---|---|---|---|---|---|
| 06-01 | Phân quyền chi tiết khu admin | 1 | — | AUTH-05, AUTH-06, MENU-04 | Code xong, chờ checkpoint |
| 06-02 | Gọi thêm cho đơn không gắn bàn | 2 | 06-01 | ORDER-14 | Code xong, chờ checkpoint |
| 06-03 | E2E (Playwright) luồng chính + RLS chạy CI | 3 | 06-01, 06-02 | tiêu chí V1 | Chưa lập |
| 06-04 | PWA (installable) khách/POS/KDS | 3 | — | OPS-04 | Chưa lập |
| 06-05 | Seed 2 tenant demo prod + smoke 3 loại thiết bị | 4 | 06-03 | tiêu chí V1 | Chưa lập |
| 06-06 | Tài liệu phát hành V1.0 + `50-PhienBan/` | 5 | tất cả | — | Chưa lập |

06-04 (PWA) độc lập với 06-03 → làm song song được.

## Quyết định P6 (chi tiết ở QD-010, QD-011)

1. **Ngưỡng vào khu admin KHÔNG hạ** (QD-010 §1): nhân viên cần setup thực đơn thì cấp vai trò
   `manager`, không mở `/admin` cho vai trò trạm. Trang admin thêm sau mà quên guard chỉ lộ cho
   owner/manager.
2. **`settings` chỉ owner** (QD-010 §2, chủ dự án chốt 27/07): %phí/%VAT đi thẳng vào tiền in trên
   hóa đơn. `reports` thì manager xem được — quản lý ca cần đối soát cuối ca.
3. **Manager dùng mật khẩu ≥8 ký tự, không dùng PIN 4 số** (QD-010 §4): tài khoản mở được
   `/admin/reports` + `/admin/staff` nên đánh đổi PIN của QD-009 không còn đúng.
4. **"Hết món" tách khỏi khu admin** (QD-010 §5): bật/tắt ngay ở POS và drawer KDS — bếp là người
   biết hết món đầu tiên mà vai trò `kitchen` không vào được `/pos`.
5. **Gọi thêm liên kết LÚC TẠO, không gộp bill lúc thu tiền** (QD-011 §1): gộp về sau bắt nhân viên
   nhớ ngược, quán đông thì không nhớ nổi đơn nào đi với đơn nào.
6. **Lượt gọi thêm là ĐƠN THẬT** (QD-011 §2): số bếp + phiếu bếp + vé KDS riêng, vì bếp làm theo
   lượt; nhưng bill neo vào đơn gốc nên **1 nhóm = 1 hóa đơn = 1 lần thu**.

## Migration P6

| Migration | Nội dung | Trạng thái |
|---|---|---|
| *(không có)* | 06-01 không cần migration — `memberships.role` đã có `'manager'` từ `0001` | — |
| `0021_order_parent.sql` | `orders.parent_order_id` + index; không đổi RLS | Đã áp dev |

> **Cảnh báo lịch sử migration**: `supabase_migrations.schema_migrations` trên dev mới ghi tới `0018`;
> `0014–0016`, `0019–0021` đã áp vào schema nhưng không có trong bảng lịch sử. Phải đối chiếu trước
> khi chạy `supabase db push` lên prod (xem `06-02-SUMMARY.md` §Rủi ro).
