# QD-011 — Gọi thêm cho đơn không gắn bàn (liên kết lúc tạo)

> Ngày: 2026-07-27 · Trạng thái: **Đã chốt** · Liên quan: [[QD-008-KenhOnlineP5]] (§1 "1 đơn = 1 bill"), ORDER-14, ORDER-03.

## Bối cảnh

Khách mua mang về hoặc ăn tại quầy gọi thêm món sau khi đã gõ đơn. Hiện `TakeawayPanel` **không có đường thêm món vào đơn đang chờ**: ô "Đơn mới" luôn tạo đơn riêng (`createStaffTakeawayOrder` với `sessionId: null`), và `openBillForOrder` là **1 đơn = 1 bill** idempotent theo `online_order_id` (`bill.ts:160-161`). Hệ quả: khách trả tiền hai lần, cầm hai hóa đơn. Cách xoay xở duy nhất là hủy đơn cũ rồi gõ lại — trong khi bếp đã nhận phiếu, món có thể đã nấu.

Đơn **có bàn** không dính: `createStaffOrder` gọi `openOrJoinSession`, order mới rơi vào cùng phiên và bill gom trọn phiên. Gốc rễ là **đơn không bàn thiếu khái niệm "phiên"** để gom nhiều lượt gọi của cùng một khách.

## Quyết định

### 1. Liên kết LÚC TẠO, không gộp lúc thu tiền

Thêm `orders.parent_order_id` (tự tham chiếu, null = đơn gốc). Nhân viên bấm **"Gọi thêm"** ngay trên đơn đang chờ → đơn mới sinh ra đã trỏ về đơn gốc.

Lý do bác phương án "gộp nhiều bill lúc thu tiền": **bắt nhân viên nhớ ngược**. Quán đông, hàng chục đơn trong ca, tới lúc thu tiền không ai nhớ đơn nào đi với đơn nào — đúng nhận xét của chủ dự án. Liên kết tại thời điểm gõ thì thông tin được ghi ngay lúc nó còn hiển nhiên.

### 2. Đơn con là ĐƠN THẬT, không phải "món thêm vào đơn cũ"

Mỗi lượt gọi thêm có `kitchen_no` riêng, phiếu bếp riêng, vé KDS riêng.

Lý do: bếp làm theo **lượt**, không theo khách. Nhét món mới vào đơn cũ rồi in lại cả phiếu sẽ khiến bếp nấu trùng những món đã xong; còn in "phiếu bổ sung" thì phải theo dõi lô món nào đã in — phức tạp hơn hẳn mà không được gì.

### 3. Nhóm phẳng một tầng

Đơn con **không thể** làm cha của đơn khác. "Gọi thêm" trên một đơn con thì đơn mới vẫn trỏ về **gốc**. Kiểm ở tầng ứng dụng (cha phải có `parent_order_id IS NULL`).

Lý do: nhóm phẳng thì "cả nhóm" luôn là một truy vấn duy nhất (`id = root OR parent_order_id = root`). Cây nhiều tầng không thêm giá trị nghiệp vụ nào mà kéo theo đệ quy ở mọi chỗ đọc.

### 4. Bill neo vào đơn GỐC, gom món cả nhóm

`bills.online_order_id` = id **đơn gốc** (không thêm cột mới). `bill_items` gom `order_items` của gốc + mọi đơn con chưa hủy. Một nhóm = một bill = một hóa đơn = một lần thu tiền.

**`openBillForOrder` phải ĐỒNG BỘ LẠI bill đang mở**, không chỉ trả về bill sẵn có như hiện nay: gọi thêm sau khi đã bấm "Thu tiền" một lần sẽ khiến tổng bị thiếu món mới. Bill `paid` thì không đồng bộ nữa (đã chốt sổ).

`payBill` nay hoàn tất **mọi đơn trong nhóm**, không chỉ đơn neo bill — nếu không, đơn con kẹt ở `served` và không bao giờ rời hàng đợi.

### 5. Hủy đơn gốc = hủy cả nhóm; hủy đơn con = chỉ đơn đó

Một lý do, một lần duyệt PIN cho cả nhóm. Ràng buộc sẵn có giữ nguyên: đơn có món **đã phục vụ** (đã thu tiền) vẫn không hủy được.

Lý do: nếu chỉ hủy đúng đơn gốc thì nhóm mất mốc neo, đơn con thành mồ côi và bill không biết gom vào đâu. Bắt nhân viên hủy từng lượt gọi thêm trước cũng được, nhưng khách bỏ đi thì phải gõ lý do nhiều lần cho cùng một sự việc.

## Hệ quả

- **Migration `0021_order_parent.sql`**: 1 cột + 1 index. Không đụng bảng khác, không đổi RLS (`orders` vốn chỉ cách ly `tenant_id`).
- **Chỉ áp dụng cho đơn không bàn.** Đơn `dine_in` giữ nguyên cơ chế phiên bàn — `parent_order_id` luôn null. Không có đường nào trong UI đặt cha cho đơn dine-in.
- **Đơn khách tự đặt online** (`source='online'`) không có nút "Gọi thêm": khách đặt lại thì đó là đơn mới của người khác việc. Cột dùng chung nhưng luồng khách không sinh liên kết.
- **QD-008 §1 "1 đơn = 1 bill" được nới thành "1 NHÓM đơn = 1 bill"** cho đơn không bàn. Vẫn không tách/gộp/chia đều — thứ đó chỉ dine-in có.
- **Doanh thu không đổi cách tính**: vẫn Σ bill `paid`. Nhóm 3 đơn ra 1 bill nên không đếm trùng.

## Phương án đã loại

- **Gộp nhiều bill lúc thu tiền.** Đã bác ở §1 — bắt nhớ ngược.
- **Thêm món thẳng vào đơn đang chờ** (không sinh đơn mới). Đúng trực giác "gọi thêm" nhưng phải in phiếu bếp CHỈ món mới, theo dõi lô đã in, và chặn thêm sau khi mở bill. Đổi lấy độ phức tạp ở đúng chỗ nguy hiểm nhất (bếp nấu trùng).
- **Cho `table_sessions.table_id` nullable → "phiên khách" cho walk-in.** Sạch nhất về kiến trúc: dùng lại `openBillForSession`, tách bill, chia đều, đóng phiên. Nhưng `table_id` đang `not null` (`0008:11`) và nhiều nơi giả định phiên luôn có bàn — sửa lan rộng để đổi lấy những tính năng mà đơn mang về đã chốt là không dùng (QD-008 §1). Nếu sau này chế độ quầy cần tách/chia đều thì đây là đường nâng cấp.

## Kiểm chứng

Unit: `computeGroupTotal` (tổng nhóm = Σ món chưa hủy của gốc + con). Tích hợp qua smoke: tạo đơn → gọi thêm 2 lượt → panel hiện MỘT khối với MỘT nút thu tiền → tổng = tổng 3 lượt → thu 1 lần → cả 3 đơn `completed` và rời hàng đợi → doanh thu tăng đúng 1 bill.
