# 12-01 → 12-03 SUMMARY — In hóa đơn từ điện thoại, tablet qua cầu in

> Thực hiện 27/09/2026. Yêu cầu: PRINT-14, PRINT-15, PRINT-16. Quyết định: QD-020 D3–D6.
> Gộp một báo cáo vì ba plan chỉ có ý nghĩa khi đi cùng nhau (ảnh → cầu in → thiết bị).
> **Trạng thái: code xong; ĐẦU-CUỐI chạy thật (điện thoại → server → cầu in thật → máy in giả nhận byte →
> dựng ngược ra tờ giấy có dấu). Còn: in ra MÁY THẬT ở qt-food (USB quầy + LAN bếp).**

## Chủ dự án chốt trong lúc làm

| # | Chốt | Hệ quả |
|---|---|---|
| 1 | Giữ laptop quầy chạy cầu in như qt-food (bếp LAN, quầy USB) | Không bỏ USB, không cần thiết bị mới |
| 2 | Không làm gói in thử trước (bước 0 của 12-01) | Làm luôn; thay bằng thử đầu-cuối với máy in giả + dựng ngược tờ giấy; **in máy thật là nghiệm thu tại quán** |

## Lệch khỏi plan — có chủ đích

| Plan / QD-020 | Làm | Vì sao |
|---|---|---|
| D3: quán `bridge` → **mọi** thiết bị in hóa đơn qua cầu in | Chỉ thiết bị **không có máy in** qua cầu in; **máy quầy (≥1024 px) in trình duyệt như cũ** | Chưa in ảnh trên máy thật của quán — không đổi đường in hóa đơn của máy quầy đang bán thật cho tới khi thử. Đổi lại sau chỉ cần một dòng |
| Route ảnh `/r/[slug]/print/receipt/[billId]/image` | `/api/print/jobs/[id]/image`, dựng từ **bản chụp** trong `print_jobs.payload.anh` | Đúng hóa đơn lúc bấm in; cầu in không cần quyền đọc hóa đơn; `buildReceiptView` chạy theo phiên nhân viên — không dùng được với token cầu in |
| "Nút in khóa kèm lý do" trên điện thoại ở quán `browser` | Bấm thì báo lý do (thông báo nổi), không mở hộp thoại in | Cùng kết quả cho người dùng, không phải đổi từng nút in |
| "Máy này có máy in" tự khai trong POS | Mặc định theo khổ (≥1024 = có); khai tay ở **Admin → Máy in → "Thiết bị này"** (bổ sung 27/09) | Việc làm một lần lúc lắp, không cần nằm trên POS hằng ngày; chủ quán/quản lý đăng nhập trên chính thiết bị để khai |

## Tệp đã đổi

| Tệp | Việc |
|---|---|
| `lib/print/anh-phieu.tsx` (mới), `assets/fonts/BeVietnamPro-*.ttf` + `OFL.txt` (mới) | Dựng hóa đơn / phiếu khách thành PNG 576 (80mm) / 384 (58mm) chấm bằng `next/og`, font có dấu (OFL), nhãn y như bản in trình duyệt |
| `app/api/print/jobs/[id]/image/route.ts` (mới) | Ảnh cho cầu in: `Bearer` của tài khoản `printer` đúng quán; quán khác / bị thu hồi / không phải printer → 404 |
| `supabase/migrations/0054_printer_counter.sql` (mới) | Nhịp tim kèm `counter_ok/target/checked_at`; thay hàm 3 → 5 tham số (drop trước) |
| `lib/print/cau-in-db.ts` | `quayCoCauIn`: cầu in sống **và** đã khai máy in quầy |
| `app/r/[slug]/print/actions.ts` | `queueReceiptPrint`, `queueCustomerTicketPrint` — kèm bản chụp; từ chối khi quầy không nhận |
| `lib/print/adapter.ts`, `device.ts` (mới), `thong-bao-in.ts` (mới), `print-mode.tsx` | Định tuyến theo chế độ quán × thiết bị; thông báo nổi "đã gửi ra máy in quầy" / "cầu in không chạy" |
| `scripts/print-bridge.mjs` (BRIDGE_VERSION 3) | Giải mã PNG bằng `zlib` (5 kiểu lọc, 5 kiểu màu), đen trắng + cắt đáy, lệnh `GS v 0` chia dải, định tuyến bếp/quầy, in quầy qua USB/LAN, nhịp tim báo máy quầy. **Không khai `COUNTER_PRINTER` → chạy y như trước** |
| `scripts/print-raw.ps1` (mới) | Gửi byte thô qua hàng đợi Windows theo TÊN máy in (RAW, P/Invoke winspool) |
| `scripts/print-setup.ps1`, `print-pack.ps1`, `print-huongdan.txt` | Chọn máy in quầy → ghi `COUNTER_PRINTER=usb:<tên>`; chép `print-raw.ps1` |
| `app/r/[slug]/admin/(protected)/printers/page.tsx` | Thẻ "Máy in quầy" (cùng quy tắc sống/chết với máy bếp) |
| `vitest.config.ts` | Biên dịch JSX khi test (tsconfig `jsx: preserve` cho Next) |
| `tests/e2e/don-ban.ts` (mới) | Dọn bàn demo dùng chung cho các spec (có rào chỉ quán demo) |

## Bằng chứng

**Ảnh có dấu** (xem bằng mắt `test-results/mau-*.png`): hóa đơn 80 mm & 58 mm đủ ă â đ ê ô ơ ư, 5 thanh, chữ hoa,
tên món dài xuống dòng, ghi chú đậm, giảm giá/phí/VAT/tiền thối; phiếu khách "ĐƠN #17". Lần dựng đầu **vỡ bố cục**
(Satori không xếp con của Fragment theo cột) — sửa bằng div cột thật.

**Đầu-cuối** (`tests/e2e/in-tu-dien-thoai.spec.ts`, 3/3): máy in giả TCP + **cầu in thật** kích hoạt bằng mã +
điện thoại 390×844:
```
thu tiền → "In hóa đơn" → thông báo "đã gửi ra máy in quầy" (không mở hộp thoại in)
→ máy in quầy nhận lệnh in ảnh sau 3,8–5,8 giây (30 KB, ảnh 576×417) → phiếu `printed`, target `counter`
"Phiếu khách" → máy quầy nhận → dựng ngược: "ĐƠN #118 … Vui lòng giữ phiếu"
cầu in CHẾT → thông báo "Cầu in ở quầy không chạy" + KHÔNG phiếu nào vào hàng đợi
```
Tờ giấy dựng ngược từ byte máy quầy nhận (`test-results/giay-hoa-don-tu-dien-thoai.png`): "Phở Việt · HÓA ĐƠN ·
Bàn T3 #70 · 09:30 27/09/2026 · Phở bò tái / Nhỏ · TỔNG 55.000₫ · Chuyển khoản" — đủ dấu, đúng giờ VN.

```
unit 664 (mới: ảnh 3 · đường ống ESC/POS 12 · định tuyến thiết bị 7) · test:rls 274 (mới 12: nhịp tim quầy,
quayCoCauIn, route ảnh đúng/sai quán/thiếu token/không phải printer/bị thu hồi) · tsc · lint · build · schema:check
E2E: điện thoại 7/7 · tablet 4/4 · cầu in cũ 5/5 · chế độ in 2/2 · in từ điện thoại 3/3
print-raw.ps1: máy in không tồn tại → "Khong mo duoc may in … (loi 1801)", mã 1
```

**Cổng ảnh ≥1024:** 6/6 khớp từng pixel. Ghi đúng như đã xảy ra: lượt chụp gốc mới từ commit 12-05 **build lỗi**
nên gốc không được làm mới; so sánh dùng gốc cũ (code 12-04, phiên trước) — code hiện tại vẫn trùng từng pixel.

## Lỗi của tôi / của test — bắt được trong lúc làm

| Lỗi | Bắt bằng |
|---|---|
| Satori: con của Fragment xếp hàng ngang; `fontSize: undefined` ném lỗi | Xem ảnh dựng ra |
| Chuỗi lệnh `tsc && build` — tsc lỗi nên **server chạy bản build cũ**, test đỏ không nói gì về code mới | Đọc lại chuỗi lệnh trước khi tin kết quả |
| Máy in giả ghi cả lượt cầu in THỬ KẾT NỐI (0 byte) là một tờ in | Test phiếu khách đỏ vì ảnh rộng ≠ 576 |
| Spec in để lại đơn trên bàn demo → chip "Bàn T2 #…" làm selector của spec tablet mơ hồ | E2E tablet đỏ; dọn bàn sau spec + khớp tên nút chính xác |

## Giới hạn đã biết

- **Chưa in ra máy thật.** Ảnh `GS v 0` đúng chuẩn và đã dựng ngược kiểm, nhưng chất lượng giấy, tốc độ, giới hạn dải
  (`RASTER_BAND`, mặc định 128) trên máy Xprinter thật của qt-food chưa đo. USB qua hàng đợi Windows chỉ kiểm được
  đường lỗi (máy dev không có máy in thật).
- **Thời gian ra giấy phụ thuộc nhịp poll:** quán vắng lâu, cầu in giãn nhịp tới 10 giây (PERF-03) ⇒ hóa đơn đầu
  tiên sau lúc vắng có thể mất tới ~12 giây.
- Tablet **ngang** (≥1024 px) không nối máy in bị coi là "có máy in" cho tới khi khai tay (Admin → Máy in →
  "Thiết bị này" → Không có máy in). Lựa chọn lưu trên trình duyệt của máy — xóa dữ liệu trình duyệt là mất,
  phải khai lại.
- qt-food phải **cài lại cầu in bằng bộ cài chung** để có `COUNTER_PRINTER` + `POS_URL` (bộ cài cũ không có).

## Việc tại quán (chủ dự án)

1. Deploy (migration 0054 **đã áp** database dùng chung — tương thích bản đang chạy; cầu in cũ vẫn báo sống).
2. qt-food: chạy `CAI-DAT.bat` của bộ cài chung (tự dùng lại tài khoản cũ), chọn máy in quầy USB.
3. Điện thoại phục vụ: thu tiền → "In hóa đơn" → hóa đơn ra máy quầy **có dấu, rõ** — chụp tờ giấy; đo thời gian.
4. Nếu chữ nhòe / máy kẹt: chỉnh `RASTER_BAND` (nhỏ hơn) hoặc ngưỡng đen trắng — báo lại để sửa.

## Bổ sung 27/09 — khai thiết bị trong giao diện

| Tệp | Việc |
|---|---|
| `lib/print/device.ts` | `cheDoKhaiMayIn()` (tự động / có / không), `datThietBiCoMayIn(true / false / null)` |
| `components/admin/ThietBiNayCard.tsx` (mới), `admin/printers/page.tsx` | Thẻ "Thiết bị này": 3 lựa chọn + dòng "Hiện: in thẳng… / gửi ra máy in quầy" |
| `tests/print/in-tu-thiet-bi.test.ts` | + test khai / bỏ khai (8/8) |
| `tests/e2e/in-tu-dien-thoai.spec.ts` | + tablet NGANG 1366: mặc định "Tự động = in thẳng" → khai "Không có máy in" → giữ qua tải lại → POS bấm "Phiếu khách" → **máy in quầy nhận byte** → trả về "Tự động" xóa khóa |

```
E2E in-tu-dien-thoai 4/4 (chạy 2 lần) · cau-in 5/5 · print-mode 2/2 · ảnh thẻ ở 360 và 1366: không tràn
```
Ghi đúng như đã xảy ra: lượt chạy đầu đỏ 2 — (1) lỗi của test: chữ "gửi hóa đơn ra máy in quầy" trùng mô tả của
lựa chọn → sửa bằng `exact`; (2) test "cầu in CHẾT" không thấy nút "Phiếu khách", lượt đó không lưu ảnh. Hai lượt
sau (có bật chụp ảnh khi lỗi) đều xanh — chưa rõ nguyên nhân lần (2); nghi do chạy sau test (1) hỏng giữa chừng.

