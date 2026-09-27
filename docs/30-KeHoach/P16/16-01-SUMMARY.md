# 16-01 — SUMMARY: dữ liệu nguồn sạch (làm sớm 27/09/2026)

> Chủ dự án yêu cầu sửa ngay ba lỗi phát hiện khi rà code cho P16. **Trạng thái: CODE XONG — CHỜ ÁP MIGRATION**
> (`.env.local` trỏ vào project Supabase duy nhất = production; chưa áp khi chưa có đồng ý).

## Ba lỗi và cách sửa

| # | Lỗi | Sửa |
|---|---|---|
| 1 | Xóa bàn → doanh thu cũ của bàn rơi vào "Không gắn bàn" (`table_sessions` CASCADE, `bills.table_session_id` SET NULL); xóa khu → "Chưa xếp khu" | `bills.table_label`, `bills.area_label` ghi bằng trigger lúc tạo bill; `report_by_area`: bàn còn thì tên hiện tại, bàn đã xóa thì snapshot |
| 2 | Chuyển món sang nhóm khác → doanh thu tháng trước đi theo; xóa nhóm → món cũ thành "Khác" | `order_items.category_name` ghi bằng trigger lúc gọi món; `report_by_category` ưu tiên snapshot |
| 3 | SĐT khách nhiều dạng; POS mang về không tên thì mất SĐT | `phoneForStorage` gọi ở server cho QR, online, POS mang về, đặt bàn; mang về lưu SĐT dù không có tên; migration chuẩn hóa dữ liệu cũ |

## Tệp đã đổi

- `lib/orders/guest-contact.ts` — thêm `phoneForStorage`.
- `lib/orders/create-order.ts` (QR + POS mang về), `lib/orders/online.ts`, `lib/reservations/reservations.ts` — dùng `phoneForStorage`.
- `supabase/migrations/0056_report_snapshots.sql` — cột snapshot, 2 trigger, backfill, 2 hàm báo cáo (thân lấy từ bản
  production ở 0040 — `bills_revenue.business_at`, **không** phải 0023), `normalize_vn_phone` + chuẩn hóa SĐT cũ.
- `tests/orders/phone-storage.test.ts` (mới, 5 test), `tests/rls/report-snapshots.test.ts` (mới, 4 test — chạy sau khi áp).

## Bằng chứng

```
npm run test            → Test Files 66 passed (66) · Tests 684 passed (684)
npx tsc --noEmit        → không lỗi
next lint (6 tệp đổi)   → No ESLint warnings or errors
```

`tests/rls/report-snapshots.test.ts` **chưa chạy** — cần migration 0056 trên DB.

## Việc còn lại (cần chủ dự án đồng ý)

1. Áp `0056` lên production **ngoài giờ bán** (backfill vài nghìn dòng → sự kiện realtime tới POS đang mở):
   `supabase db push`, rồi `npm run test:rls -- report-snapshots`, rồi `npm run schema:snapshot` và commit snapshot.
2. Sau khi áp, so ảnh báo cáo "Khu vực & bàn" và "Nhóm món" của qt-food 30 ngày trước/sau — phải **giống hệt**
   (thiết kế: số liệu không đổi ngay khi áp).
3. Kiểm: `select count(*) from orders where customer_contact->>'phone' !~ '^0[0-9]{9,10}$' and customer_contact ? 'phone'`
   — phần còn lại là chuỗi không phải SĐT, giữ nguyên có chủ đích.

## Chưa làm trong 16-01 (còn ở plan)

- Index biểu thức SĐT và `orders(tenant_id, created_at)` — để 16-05 (danh sách khách) khi có truy vấn dùng tới.
- Bàn/nhóm **đã** bị xóa trước ngày áp: không khôi phục được (dữ liệu gốc không còn).
- Xóa bàn đang có phiên **mở** vẫn cắt đơn đang ăn khỏi bàn — lỗi riêng, chưa sửa (cần chặn xóa bàn đang có khách).
