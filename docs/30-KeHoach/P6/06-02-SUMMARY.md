# 06-02 SUMMARY — Gọi thêm cho đơn không gắn bàn

**Ngày:** 28/07/2026 · **Trạng thái:** Code hoàn tất; `tsc`/`lint`/`build` xanh; **112 unit test** (gồm RLS 6/6) PASS; **smoke Playwright 3 spec / 13 khẳng định PASS** trên dev. Chờ checkpoint human-verify (12 bước ở `06-02-PLAN.md`).
**Yêu cầu:** ORDER-14 · **Quyết định:** [QD-011](../../15-QuyetDinh/QD-011-GoiThemChoDonKhongBan.md)
**Migration:** `0021_order_parent.sql` — **đã áp lên Supabase dev** (cột + index xác nhận tồn tại).

## File đã đổi/thêm

| File | Vai trò |
|---|---|
| `supabase/migrations/0021_order_parent.sql` | **Mới** — `orders.parent_order_id` (self-FK, `on delete set null`) + index partial `(tenant_id, parent_order_id)`. Không đụng RLS |
| `lib/orders/order-group.ts` | **Mới** (server) — `resolveGroupRoot` (chuẩn hóa về gốc, chặn dine_in/đơn đã kết thúc), `groupOrderIds`, `groupIsPaid` |
| `lib/orders/takeaway-group.ts` | **Mới** (THUẦN, không `server-only`) — `groupTakeawayOrders`: gom nhóm, giữ thứ tự đơn gốc, nâng đơn con mồ côi thành nhóm riêng |
| `lib/orders/create-order.ts` | `insertOrderGraph` + `createStaffTakeawayOrder` nhận `parentOrderId` |
| `lib/orders/online.ts` | `OnlineOrderView` thêm `parentOrderId`; SELECT thêm cột |
| `lib/billing/bill.ts` | `openBillForOrder` neo bill vào GỐC + gom món cả nhóm + **`syncGroupBillItems`** (đồng bộ lại bill đang mở); `payBill` hoàn tất **mọi đơn trong nhóm** |
| `app/r/[slug]/pos/actions.ts` | `createTakeawayOrderAction(..., addToOrderId?)` chuẩn hóa gốc + chặn nhóm đã thu tiền; `cancelOrder` hủy cả nhóm khi đích là đơn gốc |
| `components/pos/TakeawayPanel.tsx` | Khối nhóm (gốc + lượt gọi thêm, tổng gộp, 1 nút thu tiền), chế độ "Đang thêm vào Đơn #N", **2 cột cuộn riêng**, ô "Tìm số đơn" trong header + **lọc** hàng đợi |
| `components/pos/PosBoard.tsx` | Nới bề ngang panel khi ở chế độ đơn không bàn; `searchBox` tách thành biến để đặt được ở 2 vị trí; `filterOrderId` + `gotoTakeawayOrder` |
| `tests/orders/takeaway-group.test.ts` | **Mới** — 6 test gom nhóm |

## Logic then chốt

- **Liên kết lúc TẠO, không gộp lúc thu tiền** (QD-011 §1). Đây là điểm chủ dự án chốt: gộp về sau bắt nhân viên nhớ ngược, quán đông vài chục đơn thì không ai nhớ đơn nào đi với đơn nào.
- **Lượt gọi thêm là ĐƠN THẬT** — `kitchen_no` riêng, phiếu bếp riêng, vé KDS riêng. Nhét món vào đơn cũ rồi in lại cả phiếu sẽ khiến bếp nấu trùng món đã xong.
- **Bill neo vào đơn gốc qua cột SẴN CÓ `bills.online_order_id`** — không thêm cột bill nào. Gọi `openBillForOrder` bằng id của bất kỳ đơn nào trong nhóm đều ra cùng một bill.
- **`openBillForOrder` không còn "trả bill cũ rồi thôi"**: bill `open` mà nhóm có món mới thì đồng bộ lại `bill_items` (thêm món mới, bỏ món đã hủy) rồi `recomputeBill`. Thiếu bước này thì gọi thêm sau khi đã bấm "Thu tiền" một lần sẽ ra hóa đơn thiếu tiền — đây là cái bẫy nguy hiểm nhất của plan.
- **`payBill` nâng cả nhóm lên `completed`**, không chỉ đơn neo bill; nếu không, các lượt gọi thêm kẹt ở `served` và không bao giờ rời hàng đợi POS dù khách đã trả tiền.
- **Gom nhóm phải ở module THUẦN**: `online.ts` có `import "server-only"` nên `TakeawayPanel` (client) không import được — tách `takeaway-group.ts`.
- **Đơn con mồ côi vẫn hiện**: nếu đơn gốc rời hàng đợi (hủy/hoàn tất) mà con còn, con được nâng thành nhóm riêng thay vì biến mất — nhân viên vẫn phải thu được tiền món đó.

## Sai khác có chủ đích so với PLAN

- **PLAN dự kiến ô "Tìm số đơn" cuộn tới đơn; thực tế làm LỌC.** Chủ dự án yêu cầu rõ: *"không phải cuộn tới mà tôi cần lọc ra đơn đó"*. Kèm chip "Đang lọc: Đơn #N ✕" để thoát.
- **Ô "Tìm số đơn" chuyển hẳn vào header panel ở chế độ quầy** (PLAN không nêu). Chế độ quầy không có bàn để tìm nên nó chỉ lọc hàng đợi — đặt ở thanh trên cùng là sai chỗ. Chế độ bàn giữ nguyên vị trí cũ vì vẫn tìm cả bàn.
- **Bố cục 2 cột + hàng riêng cho thông tin khách** là kết quả của 3 vòng phản hồi trực tiếp trong lúc làm, không có trong PLAN ban đầu. Ghi lại nguyên nhân đo được: panel ~26rem chỉ vừa đúng 3 nút một hàng — nút thứ 4 làm vỡ tiêu đề "Đơn #N"; và với chục đơn chờ thì ô gõ đơn bị cuộn khuất.

## Bằng chứng

**Tĩnh** — `npx tsc --noEmit` → 0 lỗi · `npm run lint` → ✔ No ESLint warnings or errors · `npm run build` → thành công.

**Unit** — `npx vitest run` → **112 passed (7 files)**, gồm `takeaway-group` 6/6 và `test:rls` 6/6 (không hồi quy cách ly tenant).

**Smoke Playwright trên dev** (`pho-viet`, chế độ quầy) — 3 spec PASS. Spec lưu ở scratchpad phiên làm việc; **không đưa vào repo** vì E2E chính thức thuộc 06-03.

| # | Khẳng định | KQ |
|---|---|---|
| 1 | Panel đơn không bàn sẵn sàng | ✓ |
| 2 | Tạo đơn gốc (50.000₫) | ✓ |
| 3 | "Gọi thêm" → băng "Đang thêm vào Đơn #N" + "Bỏ liên kết" + ẩn ô tên/SĐT | ✓ |
| 4 | Gửi lượt gọi thêm → nhóm hiện "gồm 1 lượt gọi thêm" | ✓ |
| 5 | Lượt gọi thêm **KHÔNG** sinh mục thu tiền mới (số nút thu tiền không đổi) | ✓ |
| 6 | Tổng nhóm 100.000₫ = 2× 50.000₫ | ✓ |
| 7 | Hóa đơn mở ra mang tổng **cả nhóm** | ✓ |
| 8 | Thu tiền thành công, bill đóng | ✓ |
| 9 | Cả nhóm (gốc + lượt gọi thêm) rời hàng đợi | ✓ |
| 10 | "Tìm số đơn" → có gợi ý | ✓ |
| 11 | Chọn kết quả → hàng đợi **lọc còn đúng 1 nhóm** + chip "Đang lọc" | ✓ |
| 12 | Bấm chip → hiện lại đủ danh sách | ✓ |
| 13 | Ảnh chụp panel: tiêu đề không vỡ, khách hiện đủ tên + SĐT, 2 cột cạnh nhau | ✓ |

**Đối chiếu DB sau smoke** (trước khi dọn): mỗi nhóm 2 đơn → **1 bill, total 100.000, 2 dòng `bill_items`, status `paid`**, và **cả đơn gốc lẫn đơn con đều `completed`**. Đúng cam kết "1 nhóm = 1 bill = 1 lần thu, doanh thu không đếm trùng".

**Dọn dữ liệu:** đã xóa toàn bộ đơn test (`Khach QD011`) + 4 hóa đơn giả 100.000₫ + payments kèm theo, để không làm lệch báo cáo doanh thu trên dev. Kiểm lại: còn 0 bản ghi.

## Việc còn lại

1. **Checkpoint human-verify 12 bước** ở `06-02-PLAN.md`. Phần smoke **chưa phủ**: in phiếu bếp cho lượt gọi thêm (bước 4), vé KDS của lượt gọi thêm (bước 5), doanh thu ở `/admin/reports` (bước 7), đồng bộ bill khi gọi thêm sau lúc mở bill (bước 8), hủy nhóm (bước 9), và cách ly tenant bằng mắt (bước 12).
2. Sau khi approved: đánh ☑ ORDER-14 ở Requirements.

## Ghi chú rủi ro còn mở

- **Lịch sử migration trên dev không đầy đủ**: bảng `supabase_migrations.schema_migrations` chỉ ghi tới `0018`; các bản `0014–0016`, `0019–0020` đã áp vào schema nhưng **không được ghi lịch sử** (tình trạng có từ trước). `0021` áp theo đúng cách đó (chạy SQL trực tiếp, không ghi lịch sử) để không tạo trạng thái nửa vời. Trước khi chạy `supabase db push` lên prod cần đối chiếu lại lịch sử này, nếu không CLI sẽ áp lại loạt migration cũ.
- **Đơn khách tự đặt online** (`source='online'`) không có nút "Gọi thêm" — khách đặt lại là đơn mới. Cột dùng chung nhưng luồng khách không sinh liên kết. Nếu sau này muốn khách gọi thêm từ trang theo dõi thì cần một QD riêng.
- **Chế độ quầy chưa có tách bill / chia đều** cho nhóm. QD-011 §Phương án đã loại có nêu đường nâng cấp (cho `table_sessions.table_id` nullable) nếu nhu cầu đó xuất hiện.
