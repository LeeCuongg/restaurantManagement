# P16 — SUMMARY: báo cáo sâu và danh sách khách (16-02 → 16-05)

> **Trạng thái: CODE XONG, migration 0068–0071 đã áp production 27/09/2026** (chỉ thêm hàm / bảng / index; báo cáo cũ
> không đổi; tập `(user, quán)` của cổng khóa giữ 11). 16-01 xem `16-01-SUMMARY.md`.
> Tra đối thủ trước khi làm: `00-TongQuan.md` §Đối thủ làm thế nào — làm theo Sapo (hai thẻ phục vụ / thu ngân),
> KiotViet (phân tích phòng bàn, danh sách khách), CUKCUK (nhóm món theo thời gian), mọi đối thủ (xuất Excel).

## Đã làm

| Plan | Nội dung | Tệp chính |
|---|---|---|
| 16-02 | RPC `report_by_staff` (mảng chi nhánh): mỗi người đơn/món/tiền hàng **nhận**, hóa đơn/tiền **thu** (tiền mặt, chuyển khoản), món **hủy**, giảm giá **đã duyệt**; dòng "Khách tự gọi", "Không rõ", "Nhân viên đã xóa". Chỉ chủ / quản lý (`manager_tenants`) — thu ngân gọi thẳng nhận 0 dòng. Khối **Nhân viên** hai thẻ **Theo phục vụ / Theo thu ngân** ở báo cáo chi nhánh và chuỗi | `0068_report_staff_table.sql`, `lib/reports/deep.ts`, `components/admin/reports/StaffPanel.tsx` |
| 16-03 | `report_table_usage` (lượt, phút ngồi TB, doanh thu, /lượt, /giờ ngồi — tên bàn/khu chụp lúc bán), `report_category_trend` (tuần bắt đầu thứ Hai giờ VN), `report_branch_extra` (giảm giá, hủy, lượt bàn cho bảng so sánh chi nhánh). Khối **Hiệu quả bàn** (ẩn với quán bán tại quầy), **Nhóm món theo tuần** (kỳ ≥ 14 ngày, cột chồng), bảng so sánh chi nhánh thêm cột Giảm giá % / Hủy món % / DT mỗi lượt bàn | `TableUsagePanel.tsx`, `CategoryTrendChart.tsx`, `BaoCaoChuoiView.tsx` |
| 16-04 | Nút **Xuất Excel** trên trang Báo cáo: xuất đúng báo cáo đang xem (kỳ + phạm vi chi nhánh), **một file `.xlsx`, mỗi khối một trang tính**; cùng hàm lấy số với màn hình; chỉ chủ / quản lý; ghi `export_logs` | `lib/reports/xlsx.ts`, `lib/reports/export-sheets.ts`, `reports/export/route.ts`, `0071_export_logs.sql` |
| 16-05 | `customer_list` / `customer_history` / `customer_coverage` (gom theo SĐT chuẩn hóa từ hóa đơn đã trả + đặt bàn; một hóa đơn quy cho MỘT SĐT — đơn gốc online/mang về, hoặc đơn đầu tiên có SĐT; khách đến nhiều chi nhánh gộp một dòng khi xem "Tất cả chi nhánh"); `customer_notes`; mục **Khách hàng** (tìm tên/SĐT, sắp theo cột, 50 dòng/trang, tỷ lệ doanh thu có SĐT), trang chi tiết (lịch sử + ghi chú), **Xuất Excel** danh sách khách (chỉ chủ) | `0069_customers.sql`, `0070_customer_valid_phone.sql`, `lib/reports/customers.ts`, `app/r/[slug]/admin/(protected)/khach-hang/` |

## Quyết định trong lúc làm

- **`.xlsx` ngay, không qua CSV, không thêm thư viện.** Excel bản Việt dùng `;` làm dấu phân cách vùng ⇒ CSV mở dồn một
  cột; đối thủ đều xuất Excel. `.xlsx` là zip chứa XML — dựng bằng bộ zip có sẵn của cầu in (`lib/print/zip-them.ts`).
  Kiểm bằng openpyxl (thư viện Excel của Python): mở không cảnh báo, số là số, tiếng Việt đúng.
- **Không che SĐT với quản lý** (plan để ngỏ): không đối thủ nào che theo vai; chỉ **xuất** danh sách khách là của riêng chủ.
- Danh sách khách chỉ nhận SĐT đúng định dạng `0xxxxxxxxx` (0070) — chuỗi thử "0000000" trên qt-food không thành "khách".
- Báo cáo nhân viên: hóa đơn tính theo `business_at` (cùng quy ước khối món / phương thức), giảm giá theo `paid_at`,
  hủy theo `cancelled_at` — như các khối cũ tương ứng, để số khớp chéo.

## Bằng chứng

```
npm run test      → Test Files 78 passed · Tests 809 passed   (xlsx 4, export-sheets 3 — mới)
npm run test:rls  → 355 passed (p16-reports 10 — mới); brand-isolation cố ý bỏ qua khi quán demo thuộc thương hiệu thử
schema:check khớp · tsc + next lint sạch
```

- qt-food, hôm nay 27/09 (đọc bằng phiên chủ quán, giao dịch chỉ đọc rồi hoàn tác): Σ thu theo nhân viên = Σ tiền hàng
  theo phục vụ = doanh thu ngày = **14.975.000đ** (mọi đơn hôm nay nhập bằng tài khoản chủ quán).
- pho-viet 30 ngày: file Excel tải về 9 trang tính; trang "NV theo thu ngân" tổng thu 8.285.000đ = doanh thu kỳ. Ảnh `anh/1…3`.
- Test RLS: Σ thu theo NV = Σ phương thức TT; Σ tiền hàng = Σ món bán chạy; Σ theo bàn = doanh thu; nhóm theo tuần = nhóm
  món cùng kỳ, mọi mốc là thứ Hai 00:00 giờ VN; nhân viên đã xóa có nhãn; một hóa đơn gộp hai đơn hai SĐT chỉ quy cho SĐT
  đơn đầu; `p_limit` 500 → ≤ 100; thu ngân / quán khác 0 dòng ở báo cáo NV, khách, ghi chú, nhật ký xuất.

## Còn mở

- **qt-food hầu như không có SĐT khách**: 1/6.341 đơn có SĐT (0% doanh thu) ⇒ danh sách khách gần như trống cho tới khi
  thu ngân nhập SĐT lúc bán mang về. Màn Khách hàng đã nhắc điều này.
- Mở file trên Excel Windows tiếng Việt + Google Sheets bằng tay (nghiệm thu 16-04) — đã kiểm bằng openpyxl, chưa mở bằng
  Excel thật.
- "Bấm vào một nhân viên → danh sách hóa đơn đã thu" (16-02) chưa làm — khối hiện tổng theo người.
- Bảng xếp hạng bàn chưa kiểm tay trên quán có bàn thật (qt-food bán tại quầy, pho-viet demo cũng tại quầy).
