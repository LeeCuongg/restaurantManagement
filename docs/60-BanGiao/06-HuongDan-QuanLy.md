# Hướng dẫn QUẢN LÝ / CHỦ QUÁN

**Đăng nhập quản trị:** `<app>/r/<slug>/admin/login` bằng email + mật khẩu. Menu trái: Tổng quan · Nhân viên ·
Thực đơn · Nguyên liệu · Bàn & QR · Báo cáo · Máy in · Cài đặt (chỉ chủ quán thấy). Ô **Gói dịch vụ** ở chân menu trái (chủ quán) cho biết còn bao nhiêu ngày và có nút **Gia hạn**.

## Việc hằng ngày / hằng tuần

| Việc | Ở đâu |
|---|---|
| Xem doanh thu ngày/tuần/tháng, món bán chạy, theo cách thu | **Báo cáo** |
| Sửa giá, thêm món, bật/tắt món | **Thực đơn** |
| Thêm/tắt nhân viên, đặt lại PIN | **Nhân viên** (quản lý tạo được Thu ngân/Phục vụ/Bếp; chủ quán tạo thêm được Quản lý) |
| Xem cầu in/máy in bếp còn chạy không, phiếu lỗi hôm nay | **Máy in** (tự làm mới 30 giây) |
| Thêm bàn, in lại QR | **Bàn & QR** → Xuất QR → In (khổ A4) |
| Nhập nguyên liệu buổi sáng, kiểm kê cuối ngày (nếu quán dùng) | **Nguyên liệu** |
| Phí phục vụ, VAT, footer hóa đơn, cách in phiếu, chế độ phục vụ | **Cài đặt** (chủ quán) |
| Tài khoản nhận chuyển khoản (in QR lên hóa đơn), bật/tắt in QR | **Cài đặt → Tài khoản nhận chuyển khoản** (chủ quán). Để trống số TK rồi lưu = gỡ |
| Xem hạn dùng, gia hạn | Ô **Gói dịch vụ** chân menu trái, hoặc **Cài đặt → Gói dịch vụ** (chủ quán) |

## Hạn dùng và gia hạn (SUB-01..04)

- Còn ≤ 7 ngày: dải **vàng** trên đầu trang quản trị và POS (chủ quán + quản lý thấy; nhân viên không thấy).
- Quá hạn: dải **đỏ**, **vẫn bán bình thường** thêm 7 ngày ân hạn.
- Hết ân hạn: mọi màn (POS, bếp, trang khách) hiện **"Hết hạn sử dụng"**. Khóa đổi ngày lúc **04:00 sáng** (giờ VN),
  nên không bị khóa giữa ca đêm. **Dữ liệu không mất.**
- **Cách gia hạn:** chủ quán bấm **Gia hạn** ở ô Gói dịch vụ. Nếu quán đang bị khóa: mở `<app>/r/<slug>/admin/login` → đăng nhập → tự vào
  trang Gia hạn. Chọn 1 tháng / 1 năm / 2 năm → quét QR bằng app ngân hàng, hoặc bấm **Chép** từng dòng để chuyển tay; **giữ nguyên nội dung** `GIAHAN <MÃQUÁN> <số tháng>T` → chuyển.
  Bên hỗ trợ xác nhận tiền về và ghi nhận → hạn mới hiện ngay, quán đang khóa mở lại khi tải lại trang.

Duyệt hủy món / giảm giá tại quầy: thu ngân chọn tên bạn và bạn nhập PIN (hoặc bạn đăng nhập POS bằng tài khoản của mình — không phải nhập PIN).

## 3 lỗi hay gặp

1. **Máy in: "Cầu in bếp — Mất kết nối"** → máy tính quầy tắt, mất mạng hoặc ngủ. Bật lại, chờ 1 phút. Vẫn mất → gọi hỗ trợ.
2. **Nhân viên quên PIN / bị "tạm khóa do sai nhiều lần"** → **Nhân viên** → **Đặt lại** PIN mới; khóa tạm tự hết sau ít phút.
3. **Quên mật khẩu chủ quán** → gọi hỗ trợ để đặt lại (hiện chưa tự đổi được).

## Chuỗi nhiều chi nhánh (P15)

Quán lẻ vẫn như cũ; mục **Chi nhánh** ở menu trái có nút tạo chi nhánh.

- **Tạo chi nhánh** (chủ quán): **Chi nhánh → + Tạo chi nhánh** — tên + mã. Chép phí phục vụ, VAT, tài khoản nhận chuyển
  khoản, logo; không chép bàn, nhân viên, thực đơn. Lần đầu, quán đang mở thành **chi nhánh gốc**. Chi nhánh mới dùng ngay,
  hết hạn cùng ngày với cả chuỗi; lần gia hạn sau tính thêm chi nhánh đó.
- **Một tài khoản cho mọi chi nhánh:** góc trên màn quản trị và POS có **ô chọn chi nhánh** — chọn là sang đúng trang đó ở
  chi nhánh kia (POS: món chưa gửi bếp không mang theo). "— Tổng quan chuỗi —" mở mục Chi nhánh.
- **Chi nhánh** (menu trái): bảng hôm nay từng chi nhánh — doanh thu, hóa đơn, bàn đang mở, cầu in, hạn dùng — và cả chuỗi.
- **Báo cáo** → **Tất cả chi nhánh**: báo cáo gộp, bấm tên chi nhánh để lọc, bảng so sánh chi nhánh.
- **Đồng bộ thực đơn** (chủ chuỗi, trong mục Chi nhánh): sửa thực đơn ở chi nhánh gốc như bình thường, rồi xem trước và bấm
  **Đồng bộ**. Chi nhánh giữ **giá riêng** nếu đã tự sửa (thực đơn ghi "Giá riêng chi nhánh · Theo giá chuỗi") và giữ **hết món**.
- **Gia hạn**: một lần chuyển khoản cho cả chuỗi, số tiền = giá gói × số chi nhánh đang hoạt động.
- **Nhân viên** vẫn thuộc **một** chi nhánh; ai làm hai nơi thì mỗi nơi một tài khoản.
- **Trang cho khách chọn chi nhánh:** `<app>/b/<mã-chuỗi>` — điền **Cài đặt → Thông tin quán** (địa chỉ, SĐT, giờ mở).
