# V1.x — Cầu in bếp ESC/POS (tự in phiếu bếp)

Hiện thực nhánh Bridge của `PrintAdapter` (PRINT-01, quyết định D1 trong
[QD-005](../15-QuyetDinh/QD-005-KienTrucKyThuat.md)). POS/KDS **không đổi nghiệp vụ**.

## Vì sao cần tiến trình chạy tại quán
App chạy trên Vercel nên server không với tới máy in trong mạng LAN của quán. Vì vậy có một
tiến trình nhỏ chạy trên máy tại quán làm cầu nối:

```
POS bấm "Phiếu bếp"
  → server action queueKitchenTicketPrint  → print_jobs (status=pending, target_station=kitchen)
  → scripts/print-bridge.mjs (chạy tại quán) poll mỗi 2s
  → gửi raw ESC/POS tới máy in bếp qua TCP 9100
  → print_jobs.status = printed | failed
```

Hóa đơn và phiếu khách **vẫn in qua trình duyệt** (máy in ở quầy, ngay trước mặt thu ngân).

## Cài đặt

**1. Bật chế độ bridge cho web** — Vercel env (hoặc `.env.local` khi chạy máy):

```
NEXT_PUBLIC_PRINT_MODE=bridge
```

Bỏ trống hoặc `browser` = quay lại cách cũ (hộp thoại in của trình duyệt). Đổi biến này phải
deploy lại vì là biến `NEXT_PUBLIC_*`.

**2. Máy tính tại quán** (bất kỳ máy nào cùng mạng với máy in, có Node 20+): clone repo,
`npm install`, tạo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PRINT_TENANT_SLUG=pho-viet       # slug trong URL /r/<slug>
PRINTER_HOST=192.168.1.234       # IP máy in bếp
PRINTER_PORT=9100
PRINTER_CHARS=48                 # 80mm=48, 58mm=32
POLL_MS=2000
```

`SUPABASE_SERVICE_ROLE_KEY` bỏ qua RLS — máy này phải là máy tin cậy của quán, không dùng chung.

**3. Thử máy in** (không cần DB, in 1 phiếu mẫu):

```
npm run print:bridge:test
```

**4. Chạy thật:**

```
npm run print:bridge
```

Để tự chạy lại khi mất điện: đặt lệnh trên vào Task Scheduler (Windows, trigger "At startup")
hoặc `pm2 start scripts/print-bridge.mjs`.

## Nhân viên biết bếp đã nhận phiếu chưa
Cạnh nút "Phiếu bếp" trên POS có **chip trạng thái thường trực** (không dùng toast — toast bay mất
là bỏ sót). Trạng thái đọc từ `print_jobs` nên F5 hay đổi ca vẫn đúng:

| Chip | Nghĩa |
| --- | --- |
| `Chưa gửi bếp` (đỏ viền) | Đơn này chưa in phiếu bếp lần nào — món chưa xuống bếp |
| `Đang gửi bếp…` (vàng, quay) | Job đang chờ cầu in lấy — hỏi lại mỗi 2.5s |
| `Bếp đã in · 19:12` (xanh) | Máy in bếp đã nhận xong, kèm giờ in |
| `Bếp CHƯA in — in lại` (đỏ, bấm được) | Cầu in báo lỗi; bấm thẳng vào chip để in lại |

## Lưu ý vận hành
- **Chỉ chạy MỘT tiến trình cầu in cho mỗi quán** — hai tiến trình sẽ in trùng phiếu.
- **Phiếu in không dấu** (PHO BO TAI). Máy in nhiệt phổ thông không có bảng mã tiếng Việt sẵn;
  ép in có dấu dễ ra ký tự rác. Nếu sau này cần có dấu: chọn máy in hỗ trợ CP1258 rồi thêm lệnh
  `ESC t <n>` + bảng mã trong `ascii()` của `scripts/print-bridge.mjs`.
- **Máy in hỏng / mất mạng LAN**: job chuyển `status=failed`, cầu in ghi log và POS hiện chip đỏ
  "Bếp CHƯA in" — bấm vào chip để in lại sau khi sửa. Nếu hàng đợi ghi lỗi (mất mạng internet, hết
  phiên đăng nhập) thì POS **tự động rơi về in trình duyệt** để không mất phiếu.
- Máy in phải hỗ trợ **raw ESC/POS trên cổng 9100** (hầu hết máy in nhiệt LAN đều có). Nếu máy in
  chỉ nói giao thức khác (IPP/LPD) thì đổi `sendToPrinter()`.

## File liên quan
| File | Vai trò |
| --- | --- |
| `lib/print/adapter.ts` | `BridgePrintAdapter` + chọn adapter theo `NEXT_PUBLIC_PRINT_MODE` |
| `app/r/[slug]/print/kitchen/actions.ts` | `queueKitchenTicketPrint` — ghi job pending (guard POS/KDS) |
| `scripts/print-bridge.mjs` | Cầu in: poll → ESC/POS → TCP 9100 → printed/failed |
| `supabase/migrations/0010_print_jobs.sql` | Bảng hàng đợi (đã có sẵn từ P3) |
