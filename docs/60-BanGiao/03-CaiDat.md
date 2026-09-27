# Cài đặt một quán

> Người lắp làm cùng chủ quán. Địa chỉ app: `https://restaurant-management-zeta.vercel.app`
> (bên dưới gọi là `<app>`). `<slug>` = mã quán trong đường dẫn, vd `qt-food`.

## 1. Tạo quán (quản trị hệ thống)

`<app>/super` → **+ Nhà hàng mới** → điền "Tên nhà hàng", "Email owner", "Mật khẩu tạm (owner đổi sau)"
(slug để trống = tự sinh) → **Tạo nhà hàng**.

Hệ thống **không gửi email**. Tự đưa cho chủ quán: địa chỉ `<app>/r/<slug>/admin/login`, email, mật khẩu
tạm. Chủ quán quên mật khẩu → quản trị hệ thống đặt lại ở `/super` (chủ quán chưa tự đổi được).

## 2. Thiết lập cơ bản (chủ quán đăng nhập)

Đăng nhập `<app>/r/<slug>/admin/login` → trang Tổng quan có thẻ "Hoàn tất thiết lập nhà hàng" →
**Bắt đầu thiết lập →**. Trình hướng dẫn có 4 bước: **Thông tin** (tên, logo) → **Menu mẫu** →
**Bàn + QR** (tạo nhanh N bàn) → **Xong** → **Hoàn tất thiết lập**. Bước nào cũng bỏ qua được.

Sau đó vào **Cài đặt** (chỉ chủ quán thấy):
- **Chế độ phục vụ**: "Theo bàn" hoặc "Gọi món tại quầy" (theo phiếu khảo sát §1).
- **Cách in phiếu**: "Trình duyệt" hoặc "Cầu in" (theo `02-ThietBiChuan.md`).
- Phí phục vụ %, VAT %, "Footer hóa đơn", "Tự động gửi order QR xuống bếp", "Cho phép giảm giá" → **Lưu cấu hình**.

## 3. Thực đơn và bàn

- **Thực đơn**: sửa tên/giá món mẫu, thêm danh mục, thêm **Nhóm tùy chọn** (size, topping…). Bấm
  "Xem thử thực đơn" để xem như khách thấy. **Đối chiếu giá với menu giấy của quán từng món.**
- **Bàn & QR**: khai báo khu vực + bàn đúng tên quán đang gọi → **Xuất QR** → **In (khổ A4)** → dán QR lên bàn.
  Quét thử 1 QR bằng điện thoại: phải ra đúng "Bàn X".

## 4. Nhân viên

**Nhân viên** → mỗi người một tài khoản: "Tên hiển thị", **Email** (tên đăng nhập — mỗi người một email
khác nhau; hệ thống không gửi thư nên không cần là hộp thư thật, vd `lan@<slug>.vn`), "Vai trò" (Thu ngân /
Phục vụ / Bếp / Quản lý), **PIN 4 số** (Quản lý dùng mật khẩu ≥ 8 ký tự) → **Thêm**. Đưa cho từng người
email + PIN của họ. Nhân viên nghỉ việc → **Tắt** (giữ lịch sử), không xóa.

## 5. In ấn

### 5a. Quán chọn "Trình duyệt"

1. Cài driver máy in quầy của hãng; đặt làm **máy in mặc định** của Windows; khổ giấy 80 mm.
2. Tạo lối tắt Chrome trên Desktop, ô *Target*:
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\pos-chrome" --app=<app>/r/<slug>/pos`
3. Mở POS bằng lối tắt này → in thử 1 hóa đơn: **giấy ra, không hiện hộp thoại chọn máy in**.

### 5b. Quán chọn "Cầu in"

1. Trên **chính laptop quầy**: chủ quán đăng nhập admin → **Máy in** → **Tải bộ cài cầu in** → giải nén
   `cau-in.zip` vào Desktop (bộ cài giống nhau cho mọi quán, không có mật khẩu).
2. Cùng màn đó: **Tạo mã kích hoạt** (chỉ tài khoản chủ quán). Mã dùng một lần, sống 30 phút — tạo khi đã
   ngồi trước máy. Quản trị hệ thống vẫn tạo hộ được ở `/super` → quán → "Mã cài cầu in".
   **Cài bằng mã mới thì cầu in đang chạy ở máy khác ngừng in** — chỉ tạo mã khi lắp mới / thay laptop.
3. Thư mục giải nén chỉ có `CAI-DAT.bat` và thư mục `bo-cai` → double-click `CAI-DAT.bat` → Yes → gõ mã → làm
   theo màn cài (xuống bếp xem giấy thử ra ở đâu, chọn máy in quầy). Hướng dẫn đầy đủ + công cụ sửa lỗi: `bo-cai\HUONG-DAN.txt`,
   sau khi cài có bản sao ở `C:\cau-in`.
4. Làm đủ **4 phép thử** in ở cuối màn cài. Chủ quán mở **Máy in** trong admin: "Cầu in bếp — Đang kết nối",
   "Máy in bếp — Phản hồi bình thường".

## 6. Thiết bị nhân viên

- **POS (máy quầy)**: mở lối tắt POS → đăng nhập bằng **email + PIN** của người đang trực ca.
- **Màn bếp**: mở `<app>/r/<slug>/kds` trên tablet/màn hình bếp → đăng nhập tài khoản vai trò Bếp.
- **Điện thoại / tablet phục vụ**: mở `<app>/r/<slug>/pos` — **cùng POS với máy quầy**, tự co theo màn
  hình (điện thoại có thanh tab dưới Bàn · Thực đơn · Đơn) → lưu thành lối tắt trên màn hình chính → đăng
  nhập email + PIN. Lối tắt cũ `…/pos/m` vẫn mở được (tự chuyển về `/pos`).
  Phục vụ trên điện thoại làm được **mọi** việc của máy quầy, kể cả thu tiền — muốn phục vụ không thu tiền
  thì dặn nhân viên, hệ thống chưa chặn theo vai trò.

### Khai máy in cho từng thiết bị (quán dùng cầu in)

Hóa đơn / phiếu khách bấm từ máy **không nối máy in** được gửi ra **máy in quầy** qua cầu in; máy **có** máy in
in thẳng. Hệ thống tự đoán theo khổ màn hình: màn rộng ≥ 1024 px (laptop, máy POS quầy, **tablet để ngang**)
coi là **có** máy in; điện thoại, tablet dọc coi là **không**.

Chỉ phải khai tay khi đoán sai — thường gặp nhất: **tablet để ngang không nối máy in**. Trên CHÍNH thiết bị đó:
đăng nhập bằng tài khoản chủ quán/quản lý → **Admin → Máy in** → thẻ **"Thiết bị này"** → chọn
**Không có máy in** (hoặc **Có máy in**). Dòng "Hiện: …" cho biết hóa đơn của máy này sẽ đi đường nào.
Lựa chọn lưu trên trình duyệt của máy: vẫn giữ khi đăng xuất / nhân viên khác đăng nhập; **mất** nếu xóa dữ
liệu trình duyệt hoặc đổi trình duyệt — khi đó khai lại.

Chưa có chế độ "cài như ứng dụng" (PWA) — lối tắt trên màn hình chính sẽ mở bằng trình duyệt.

## 7. Thử trọn một vòng (bắt buộc trước khi hướng dẫn nhân viên)

1. Điện thoại quét QR bàn → gọi 2 món → **Gửi order**.
2. POS: "Chờ duyệt" → **Duyệt** → phiếu bếp ra (hoặc bấm "Phiếu bếp").
3. Màn bếp: vé hiện trong vài giây.
4. POS: **Tính tiền** → **Thu tiền** → Tiền mặt → **Xác nhận thu · đóng bill** → **In hóa đơn**.
5. Màn bếp: vé biến mất. **Báo cáo**: có đúng doanh thu vừa thu.

Ghi thời gian từ bước 1 tới 5 vào biên bản (`09-BienBanNghiemThu.md`).
