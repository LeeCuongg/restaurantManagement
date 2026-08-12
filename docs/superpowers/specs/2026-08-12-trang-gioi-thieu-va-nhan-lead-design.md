# Thiết kế — Trang giới thiệu sản phẩm + nhận khách quan tâm

> Ngày 12/08/2026 · Trang: `/` (route group `app/(marketing)`) và `/super/leads` · Yêu cầu: MKT-01..03

## 1. Bối cảnh

`app/(marketing)/page.tsx` hiện là khung rỗng: một tiêu đề, một đoạn mô tả, hai nút trỏ vào trang nội bộ (`/style-guide`) và tenant demo. Không nói được sản phẩm làm gì, không có cách nào để người quan tâm liên hệ.

Mục tiêu: biến thành trang bán hàng cho **chủ nhà hàng nhỏ/vừa**, và thu được tên + số điện thoại của người quan tâm.

## 2. Phạm vi

**Làm:** trang giới thiệu 7 khối có ảnh chụp sản phẩm thật · form tên + SĐT (2 chỗ) · bảng `leads` + màn quản lý ở `/super/leads`.

**Bỏ:** hai nút "Xem style-guide" và "Thử tenant demo". Trang không còn lối vào demo nào — người xem phải để lại số.

**Không viết lên trang** (chưa có thật): PWA cài lên màn hình chính, tích hợp ví điện tử/cổng thanh toán, quản lý kho & nguyên liệu, lợi nhuận/biên lãi (`menu_items` chưa có giá vốn), ứng dụng di động native.

## 3. Nội dung trang

Mọi luận điểm phải truy được về tính năng đã chạy (`docs/00-TongQuan/GioiThieu.md`, `20-DanhSachYeuCau/00-Requirements.md`).

| # | Khối | Nội dung |
|---|---|---|
| 1 | Hero | Tiêu đề theo lợi ích + form tên & SĐT + dải sunset |
| 2 | 3 nỗi đau → cách xử lý | Order thất lạc · bếp làm sai món · không biết doanh thu (GioiThieu §3) |
| 3 | Ảnh lớn báo cáo | Doanh thu, cơ cấu nhóm món, khung giờ cao điểm |
| 4 | 4 bề mặt | Khách QR · POS · KDS · Quản trị — mỗi bề mặt 1 ảnh + 3 gạch đầu dòng |
| 5 | Lưới tính năng | 10 thẻ: tách/gộp bill, chia đều N người, in phiếu bếp & hóa đơn 80mm, đặt bàn, mang về/giao, gọi nhân viên tại bàn, báo hết món (86), phân quyền 5 vai trò, đa chi nhánh, gọi thêm gom 1 hóa đơn |
| 6 | Vì sao tin được | Cách ly dữ liệu RLS có test tự động · món xuống bếp ≤3s · doanh thu khớp 100% tiền thu · Vercel + Supabase |
| 7 | CTA cuối + footer | Form lần hai |

## 4. Ảnh chụp

Dữ liệu mẫu sinh cho tenant demo `pho-viet` (`scripts/seed-demo-data.mjs`, idempotent, **ở lại** để chụp lại về sau). Tuyệt đối không dùng dữ liệu tenant thật — ảnh nằm trên trang công khai.

4 ảnh trong `public/marketing/`: báo cáo · POS · KDS · menu khách (khổ dọc điện thoại). Mỗi ảnh ≤ ~200KB.

## 5. Nhận khách quan tâm

**Bảng `leads`** (migration `0024_leads.sql`) — không có `tenant_id` vì đây là khách của nền tảng, không thuộc nhà hàng nào:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | |
| `name` | text | ≥ 2 ký tự |
| `phone` | text | đã chuẩn hóa `0xxxxxxxxx` |
| `note` | text | tùy chọn, khách tự ghi |
| `source` | text | `landing` (chừa cho nguồn khác sau này) |
| `status` | text | `new` \| `contacted` \| `closed` |
| `created_at`, `contacted_at` | timestamptz | |

**Bảo mật:** bật RLS và **không tạo policy nào** → khách vãng lai không đọc cũng không ghi được. Ghi đi qua server action dùng service role; đọc ở `/super/leads` cũng qua service role sau khi `isSuperAdmin()`. Đây là dữ liệu cá nhân (PII) nên phạm vi giữ tối thiểu: chỉ tên + SĐT + ghi chú, không thu thập gì thêm.

**Kiểm tra đầu vào** (dùng lại `lib/orders/guest-contact.ts`, không viết lại regex):
- tên ≥ 2 ký tự, cắt còn ≤ 40 ký tự;
- SĐT phải hợp lệ VN (`normalizePhone` đổi `+84` → `0`, `isValidPhone` kiểm `^0\d{9,10}$`);
- ghi chú ≤ 300 ký tự;
- **chống bấm lặp**: cùng SĐT đã gửi trong 60 giây → không ghi thêm, vẫn trả về thành công (người dùng không thấy khác biệt, DB không sinh rác).

**Màn `/super/leads`:** bảng tên · SĐT (bấm gọi được qua `tel:`) · ghi chú · thời điểm · trạng thái, nút "Đã gọi" đổi `status`. Thêm liên kết từ `/super`.

## 6. Tiêu chí thành công (đo được)

1. `/` render 7 khối, không còn liên kết nào tới `/style-guide` hay `/r/pho-viet`.
2. Gửi form với tên hợp lệ + SĐT `0912345678` → bản ghi `leads` mới, form hiện lời cảm ơn.
3. SĐT sai (`123`) → báo lỗi ngay tại ô nhập, không ghi DB.
4. Gửi 2 lần liên tiếp cùng số → chỉ 1 bản ghi.
5. Khách vãng lai gọi thẳng PostgREST `select * from leads` bằng anon key → 0 dòng / bị từ chối.
6. `/super/leads` hiện đúng danh sách; bấm "Đã gọi" đổi trạng thái.
7. Không vỡ ở 360px. `npm run test`, `tsc --noEmit`, `npm run lint`, `npm run build` sạch.
