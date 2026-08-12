# Thiết kế — Nâng cấp màn Báo cáo dòng tiền

> Ngày 12/08/2026 · Liên quan: REPORT-01..03 (đã có), REPORT-04..09 (mới) · Trang: `/r/[slug]/admin/reports`

## 1. Bối cảnh & vấn đề

Màn báo cáo hiện tại (04-05) có 3 khối: KPI, biểu đồ doanh thu theo ngày, món bán chạy + phương thức thanh toán. Hai vấn đề:

**(a) Không chọn được khoảng thời gian cụ thể.** `RangePicker` chỉ có Ngày/Tuần/Tháng + nút lùi/tiến kỳ. Không xem được "từ 01/07 đến 15/08".

**(b) Doanh thu bị tính THIẾU khi vượt 1000 hóa đơn.** `getReportData` fetch từng dòng `bills` rồi `reduce` trong JS. PostgREST/Supabase mặc định trả tối đa **1000 dòng**/request. Ảnh chụp thực tế của tenant hiển thị "Số hóa đơn = đúng 1000" — dấu hiệu rõ ràng của việc bị cắt. Query `bill_items` (món bán chạy) cũng bị cắt tương tự. Đây là vi phạm tiêu chí phát hành **BILL-05 "doanh thu khớp 100%"**, phải sửa trước khi thêm tính năng.

## 2. Phạm vi

**Làm:**
- Chọn khoảng thời gian: preset nhanh + lịch tùy chọn từ ngày → đến ngày.
- Dồn toàn bộ tính toán xuống SQL (sửa lỗi cắt 1000 dòng).
- Phân tích **thời gian & so sánh**: độ mịn biểu đồ thích ứng, so sánh kỳ trước, heatmap giờ × thứ, giờ cao điểm.
- Phân tích **cơ cấu doanh thu**: theo nhóm món, theo kênh bán, theo khu vực & bàn.

**Không làm (đợt sau):** đối soát giảm giá/phụ thu/VAT, hóa đơn hủy (void), món bị hủy, doanh thu theo thu ngân, bảng chi tiết hóa đơn, xuất CSV.

**Không làm được:** lợi nhuận / biên lãi — bảng `menu_items` chưa có trường giá vốn.

## 3. Quy ước doanh thu (giữ nguyên BILL-05)

Không thay đổi định nghĩa hiện hành:
- **Doanh thu, số HĐ** = `bills` có `status='paid'` **và** `split_count IS NULL` (loại "vỏ" chia đều, chỉ đếm phần con → khớp tiền thật thu).
- **Món bán chạy / nhóm món / kênh** = `bill_items` của mọi bill `paid` (bill con của lượt chia đều không mang `bill_items` nên không đếm trùng).
- **Phương thức thanh toán** = bảng `payments` theo `received_at`.
- Mốc thời gian theo **ngày Việt Nam**. Đổi từ phép cộng thủ công `+7h` sang `AT TIME ZONE 'Asia/Ho_Chi_Minh'` trong SQL.

Doanh thu chia theo nhóm món / kênh / khu vực phân bổ theo `bill_items.amount`, nên tổng các phần luôn khớp KPI tổng.

## 4. Lớp dữ liệu — `supabase/migrations/0023_report_rpcs.sql`

Các hàm `security invoker` (RLS theo `tenant_id` vẫn áp dụng — không dùng `service_role`), `set search_path = public`, `stable`. Mọi hàm nhận `(p_tenant uuid, p_from timestamptz, p_to timestamptz)`, khoảng nửa mở `[from, to)`.

| Hàm | Trả về | Nguồn |
|---|---|---|
| `report_summary` | `total_revenue, bill_count, avg_per_bill` | `bills` |
| `report_series(p_grain text)` | `bucket_start timestamptz, revenue, bill_count` — grain ∈ `hour\|day\|week\|month` | `bills` |
| `report_top_items(p_limit int)` | `name, qty, revenue` | `bill_items → order_items` |
| `report_by_category` | `category_id, name, qty, revenue` | `→ menu_items → menu_categories` |
| `report_by_channel` | `channel, source, revenue, item_count` | `→ orders` |
| `report_by_area` | `area_name, table_name, revenue, bill_count` | `bills → table_sessions → tables → areas` |
| `report_payments` | `method, amount, count` | `payments` |
| `report_hour_dow` | `dow int (0=CN), hour int, revenue, bill_count` | `bills` |

Ràng buộc chung: mọi hàm lọc `tenant_id = p_tenant` tường minh (phòng thủ nhiều lớp cùng RLS). Món/nhóm/bàn bị xóa → gộp vào nhãn `—` thay vì mất dòng.

## 5. Lớp logic khoảng thời gian — `lib/billing/report-range.ts` (file mới)

Tách khỏi `reports.ts` để **thuần hàm, không `server-only`** → unit test bằng vitest.

**Tham số URL:**
- `?preset=today|yesterday|7d|30d|week|month|last_month`
- hoặc `?from=YYYY-MM-DD&to=YYYY-MM-DD` (bao gồm cả ngày `to`)
- `?bucket=day|week|month&offset=n` — dạng cũ, vẫn hỗ trợ để link cũ không gãy.
- Mặc định khi không có tham số: `month` (kỳ hiện tại) — giữ hành vi cũ.

**Độ mịn biểu đồ (grain) tự chọn theo độ dài kỳ:**

| Số ngày | Grain | Ví dụ nhãn |
|---|---|---|
| ≤ 2 | `hour` | `08:00` |
| 3 – 92 | `day` | `12/08` |
| 93 – 366 | `week` | `10/08` (thứ Hai đầu tuần) |
| > 366 | `month` | `T8/26` |

**Kỳ đang dở cắt tới hôm nay:** preset `week`/`month` của kỳ **hiện tại** kết thúc ở hôm nay, không kéo tới hết tuần/tháng — ngày chưa tới chỉ tạo cột 0 vô nghĩa. Nhãn ghi rõ `Tháng 8/2026 · đến 12/08`. Tuần/tháng đã trôi qua (offset < 0) vẫn lấy trọn kỳ.

**Kỳ so sánh:** kỳ liền trước. Khi kỳ này đang dở thì kỳ trước cũng cắt cho bằng số ngày — so 12 ngày đầu tháng 8 với 12 ngày đầu tháng 7, không so với trọn tháng 7.
- Preset `today/yesterday` → ngày trước đó; `week` → tuần trước; `month` → tháng trước (theo lịch, không phải "31 ngày trước"); `last_month` → tháng trước nữa.
- `7d/30d`/custom → lùi đúng số ngày của kỳ.

**Kiểm tra đầu vào:** `to ≥ from`; độ dài tối đa **400 ngày**; ngày sai định dạng/không tồn tại → fallback về preset `month`. Không cho chọn ngày trong tương lai quá hôm nay (VN).

## 6. Lớp dữ liệu ứng dụng — `lib/billing/reports.ts` (viết lại)

- `getReportData(tenantId, range)` gọi song song 8 RPC bằng `Promise.all`.
- `getComparisonSummary(tenantId, prevRange)` gọi riêng `report_summary` cho kỳ trước.
- **Xử lý lỗi:** RPC lỗi → ném lên để trang hiện khối báo lỗi rõ ràng, **không** âm thầm trả 0 như code cũ (`const { data } = await ...` nuốt error).
- `series` được điền đủ mốc trống (ngày/giờ không có bill vẫn hiện cột 0) ở phía JS từ `range`.

## 7. Lớp giao diện

```
┌ Báo cáo dòng tiền           [Hôm nay][7 ngày][30 ngày][Tháng này][📅 Tùy chọn]  ‹ ›
├ KPI ×4: Doanh thu ▲12% · Số HĐ ▲8% · TB/HĐ ▼3% · Giờ cao điểm 19:00
├ Doanh thu theo <giờ|ngày|tuần>   — cột đậm = kỳ này, cột mờ = kỳ trước
├ Cơ cấu theo nhóm món        │ Theo kênh bán
├ Món bán chạy                │ Theo phương thức thanh toán
└ Theo khu vực & bàn          │ Heatmap giờ × thứ (chỉ khi kỳ ≥ 7 ngày)
```

**Component:**

| File | Trạng thái | Vai trò |
|---|---|---|
| `RangePicker.tsx` | viết lại | Preset chips + popover "Tùy chọn" chứa 2 `<input type="date">` gốc + nút ‹ › |
| `KpiCard.tsx` | mới | Nhãn, giá trị, delta % so kỳ trước (▲ xanh / ▼ đỏ / – khi kỳ trước = 0) |
| `RevenueChart.tsx` | mở rộng | Nhận `grain` + series kỳ trước, cột mờ chồng phía sau |
| `CategoryBreakdown.tsx` | mới | Thanh ngang theo nhóm món + % tỷ trọng |
| `ChannelBreakdown.tsx` | mới | Tại bàn / mang về / giao hàng; phụ chú QR vs nhân viên |
| `AreaBreakdown.tsx` | mới | Khu vực (gộp) → bàn top trong khu |
| `HourHeatmap.tsx` | mới | Lưới 7 × 24, đậm nhạt theo doanh thu |
| `TopItemsTable.tsx`, `PaymentBreakdown.tsx` | giữ nguyên | — |

**Ràng buộc UI:** không thêm dependency mới (lịch dùng `<input type="date">` gốc trình duyệt); dùng lại token có sẵn (`hairline`, `steel`, `ink`, `primary`, `canvas`, `surface`); toàn bộ nhãn tiếng Việt; chạy tốt ở 360px (heatmap cuộn ngang trong khung riêng).

## 8. Tiêu chí thành công (đo được)

1. Chọn `from=2026-07-01&to=2026-08-12` → tiêu đề hiện "01/07 – 12/08/2026", biểu đồ đúng 43 cột ngày.
2. Tenant có > 1000 hóa đơn trong kỳ → `summary.bill_count` khớp `SELECT count(*)` chạy thẳng trên Postgres (không còn dừng ở 1000).
3. Σ doanh thu các nhóm món = Σ doanh thu các kênh = tổng doanh thu KPI.
4. Preset "Hôm nay" → grain = `hour`, biểu đồ 24 cột.
5. KPI hiện delta % đúng dấu so với kỳ trước; kỳ trước = 0 → hiện "–", không chia cho 0.
6. `from > to` hoặc kỳ > 400 ngày → tự về preset tháng này, không lỗi 500.
7. `npm run test`, `npx tsc --noEmit`, `npm run lint` sạch.
