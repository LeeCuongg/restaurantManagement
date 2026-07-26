# Kế hoạch V2 — Hệ thống nhà hàng SaaS

> **Trạng thái:** ĐỀ XUẤT (nháp) — chờ chốt. Lập 25/07/2026.
> **Nguồn:** các hạng mục đã chủ động hoãn khỏi V1 trong `15-QuyetDinh/QD-005` (D11–D14), `QD-006` (F2),
> `00-TongQuan/BanDoLienKet.md`, `10-BanThietKe/02-FrontendChiTiet.md`, và báo cáo P3.
> **Điều kiện tiên quyết:** V1.0 đã phát hành (Roadmap P6 xong).
> **Quy trình (VibeCode):** tài liệu này chỉ là *khung định hướng*. Mỗi giai đoạn V2 vẫn phải có
> **1 QĐ (`QD-0xx`) + danh sách yêu cầu đo được (`20-DanhSachYeuCau/`) + kế hoạch chi tiết (`30-KeHoach/`)**
> được duyệt **trước khi code** — không code thẳng từ file này.

## V2 là gì (một câu)
V1 chứng minh **một nhà hàng vận hành trọn vẹn** (order → bếp → tiền → báo cáo → kênh online).
**V2 biến nó thành sản phẩm SaaS thương mại**: tự thu phí theo gói, mỗi tenant có thương hiệu riêng,
và bổ sung chiều sâu vận hành (giao hàng đầy đủ, báo cáo sâu, bếp bump-bar, offline).

## Nguồn gốc từng hạng mục (truy vết V1 → V2)
| Mã V2 (đề xuất) | Hạng mục | V1 đã làm gì | Nguồn |
|---|---|---|---|
| BILLING-* | Gói cước + subscription + giới hạn + thu phí | Super-admin tạo tenant thủ công, chưa gói/thu phí | QD-005 **D13** |
| BRAND-* | Subdomain riêng + màu thương hiệu theo tenant | Định tuyến bằng slug `/r/[slug]`; theme cố định, chỉ logo+tên | BanDoLienKet §subdomain, QD-006 **F2**, 02-FrontendChiTiet §V2 |
| DELIV-* | Giao/mang về đầy đủ: phí giao, vùng giao, tài xế | Tối thiểu — chỉ vòng đời trạng thái + liên hệ khách | QD-005 **D11** |
| REPORT-* (mở rộng) | Báo cáo theo nhân viên / khu vực | Doanh thu ngày/tuần/tháng + món bán chạy + theo phương thức TT | QD-005 **D12** |
| KDS-* | Bump-bar bếp (thao tác bắt đầu/xong) | KDS chỉ để xem; enum `preparing/ready` giữ sẵn | Báo cáo P3 (§KDS view-only) |
| PWA-* | PWA offline (đệm khi mất mạng) | Online-only; PWA chỉ cài được lên màn hình chính | QD-005 **D14** |

> **Không nằm trong V2 (là V1.x — hậu phần cứng):** cầu in cục bộ để tự in ≤5s (PrintAdapter đã chừa sẵn,
> chờ máy in thật). Xem `00-TongQuan/Roadmap.md` §Rủi ro.

---

## Hành trình V2 (đề xuất — thứ tự ưu tiên có thể chỉnh)
Thương mại hóa trước (mở doanh thu SaaS) → thương hiệu riêng (giữ chân + bán được giá) →
chiều sâu vận hành → độ tin cậy offline.

- **V2-A — Thương mại hóa SaaS** (BILLING): gói cước, subscription, hạn mức, cổng thanh toán chủ nhà hàng.
- **V2-B — Thương hiệu riêng tenant** (BRAND): subdomain + màu/theme per-tenant.
- **V2-C — Vận hành nâng cao** (DELIV + REPORT + KDS): giao hàng đầy đủ, báo cáo sâu, bump-bar bếp.
- **V2-D — Độ tin cậy** (PWA): đệm offline cho POS/KDS/khách.

Mỗi giai đoạn kết thúc bằng demo chạy trên môi trường `dev` + checkpoint human-verify (ràng buộc như V1).

---

## V2-A — Thương mại hóa SaaS
**Mục tiêu:** Chủ nhà hàng tự đăng ký, chọn gói, thanh toán định kỳ; hệ thống tự cấp/khóa quyền theo gói.
**Phụ thuộc:** V1 (tenant + super-admin + auth).
**Yêu cầu (đề xuất — chi tiết hóa ở `20-DanhSachYeuCau/`):**
- BILLING-01 — Danh mục **gói cước** (ví dụ Free / Pro / Chain) + hạn mức mỗi gói (số bàn, số nhân viên, số tenant, tính năng bật/tắt).
- BILLING-02 — **Đăng ký tự phục vụ**: tạo tenant + chọn gói không cần super-admin thao tác tay.
- BILLING-03 — **Subscription định kỳ** (tháng/năm) + trạng thái `active/past_due/canceled` + hết hạn dùng thử.
- BILLING-04 — **Thu phí**: tích hợp cổng thanh toán (đề xuất — cần QĐ chọn nhà cung cấp: Stripe quốc tế vs cổng nội địa VN như VNPay/MoMo/Casso). Webhook cập nhật trạng thái.
- BILLING-05 — **Enforcement hạn mức**: chặn vượt gói (ví dụ tạo bàn thứ N+1 khi gói giới hạn N) + trang nâng cấp.
- BILLING-06 — **Trang quản trị super-admin**: xem MRR, subscription, gia hạn/hủy thủ công (fallback).

**Mô hình dữ liệu (phác thảo):**
```
plans(id, code, name, price_month, price_year, limits jsonb, features jsonb, active)
subscriptions(id, tenant_id fk, plan_id fk, status, current_period_end,
              trial_ends_at, external_customer_id, external_sub_id, created_at)
usage_counters(tenant_id, metric, value)   -- hoặc đếm động qua count()
billing_events(id, tenant_id, type, payload jsonb, created_at)  -- audit webhook
```
- RLS: `subscriptions` — owner đọc gói của tenant mình; super-admin đọc tất cả. `plans` public-read.
- Enforcement đặt ở **server action + middleware** (không tin client); nguồn sự thật = `subscriptions.status` + `plans.limits`.

**Quyết định cần chốt trước khi code (mở QĐ mới):**
1. **Cổng thanh toán:** nội địa (VNPay/MoMo/Casso — hợp thị trường VN, hóa đơn VND) **vs** Stripe (đơn giản kỹ thuật, khó thu VND). ⟵ quyết định lớn nhất.
2. Mô hình gói: theo **số bàn** hay **số chi nhánh** hay **doanh thu**? Có gói Free vĩnh viễn không?
3. Xử lý khi `past_due`: khóa mềm (chỉ đọc) hay khóa cứng? Ân hạn bao lâu?

**Nghiệm thu:** chủ mới đăng ký → dùng thử → hết hạn/thanh toán → gói `active`; vượt hạn mức bị chặn có thông báo nâng cấp; super-admin thấy danh sách subscription + trạng thái đúng.

---

## V2-B — Thương hiệu riêng cho tenant
**Mục tiêu:** Mỗi nhà hàng có địa chỉ + màu sắc riêng, cảm giác "app của chính họ".
**Phụ thuộc:** V1 (routing slug, design system CSS vars), nên gắn gói (BRAND thường là quyền của gói trả phí).
**Yêu cầu (đề xuất):**
- BRAND-01 — **Subdomain per-tenant**: bật cờ `ENABLE_SUBDOMAIN` (đã chừa sẵn ở middleware V1); `pho-viet.<domain>` ⇄ `/r/pho-viet`. Cấu hình wildcard DNS + Vercel domains.
- BRAND-02 — **Màu thương hiệu**: mở nguồn biến `--tenant-primary` từ `tenants.settings.brand_color` (cơ chế CSS var đã chừa ở V1); admin đổi màu trong Cài đặt, xem trước.
- BRAND-03 — (tùy chọn) **Domain riêng của khách** (`order.nhahang.com`) — cần QĐ về xác minh domain + SSL; có thể hoãn V2.1.

**Ghi chú kỹ thuật:** V1 đã cố ý chừa 2 điểm mở này (subdomain code sẵn nhưng TẮT; CSS var `--tenant-primary` mặc định `#fa520f`). BRAND-01/02 **không cần refactor component**, chỉ mở nguồn biến + bật cờ + kiểm tương phản (accessibility: màu tenant phải đạt contrast tối thiểu — cần guard).

**Nghiệm thu:** truy cập `pho-viet.<domain>` ra đúng tenant; đổi màu trong admin → toàn bộ bề mặt khách/POS đổi màu, vẫn đạt tương phản AA; tenant khác không ảnh hưởng.

---

## V2-C — Vận hành nâng cao
**Mục tiêu:** Bổ sung chiều sâu cho nhà hàng có giao hàng thật, quản lý cần số liệu sâu, bếp muốn thao tác.
**Phụ thuộc:** V1 (orders/channel, reports, KDS).
**Yêu cầu (đề xuất):**
- DELIV-01 — **Vùng giao + phí giao**: cấu hình vùng (theo bán kính/khu vực) + phí theo vùng; cộng vào bill.
- DELIV-02 — **Tài xế**: gán đơn cho tài xế + trạng thái `assigned → picked → delivered`; màn hình tài xế tối giản.
- DELIV-03 — (tùy chọn) tích hợp bên thứ ba (Grab/ShopeeFood) — **cân nhắc, có thể để V3** (V1 đã ghi "giao hàng tự quản").
- REPORT-04 — **Báo cáo theo nhân viên** (doanh thu/đơn/ca) — cần gắn `order`/`bill` với membership người thao tác.
- REPORT-05 — **Báo cáo theo khu vực/bàn** (công suất, doanh thu theo khu).
- KDS-01 — **Bump-bar**: bật lại thao tác `preparing/ready` mức món ở KDS (enum đã giữ sẵn từ P3) — chế độ **cấu hình được** (nhà hàng chọn "chỉ xem" như V1 hay "bump-bar"), vì P3 đã chốt bếp thật tay bận.

**Ghi chú:** `orders.channel` (takeaway/delivery) + `customer_contact.address` đã có từ V1 (migration 0008). DELIV chủ yếu thêm bảng `delivery_zones`, cột phí, và (nếu làm) `drivers` + gán đơn. KDS-01 tái dùng enum `preparing/ready` còn nguyên trong DB.

**Nghiệm thu:** đặt đơn giao → tính đúng phí theo vùng → gán tài xế → giao xong; báo cáo lọc theo nhân viên/khu vực khớp số; bật bump-bar → bếp đổi trạng thái món, khách stepper phản ánh đúng.

---

## V2-D — Độ tin cậy (offline)
**Mục tiêu:** POS/KDS/khách vẫn dùng được khi mạng chập chờn — không mất order.
**Phụ thuộc:** V1 (PWA installable đã có ở P6).
**Yêu cầu (đề xuất):**
- PWA-01 — **Đệm đọc offline**: menu/bàn/đơn đang mở cache được (service worker) để xem khi rớt mạng.
- PWA-02 — **Hàng đợi ghi offline**: order tạo lúc offline được xếp hàng + đồng bộ khi có mạng lại (idempotent, chống trùng).
- PWA-03 — Chỉ báo trạng thái mạng rõ ràng + xử lý xung đột khi đồng bộ.

**Rủi ro:** đồng bộ offline + realtime + RLS + đa thiết bị là phần **khó nhất V2** — cần QĐ mô hình đồng bộ (last-write-wins vs hàng đợi lệnh) và có thể tách thành nhiều lát nhỏ. Cân nhắc chỉ làm PWA-01 (đọc) ở V2, để PWA-02/03 (ghi) sang V2.1 nếu rủi ro cao.

**Nghiệm thu:** ngắt mạng → POS vẫn xem menu/bàn; tạo order offline → nối mạng → đồng bộ đúng, không trùng, không mất.

---

## Rủi ro & ghi chú xuyên suốt V2
| Rủi ro | Xử lý đề xuất |
|---|---|
| Chọn sai cổng thanh toán (khóa vào vendor) | Trừu tượng hóa `PaymentProvider` (như PrintAdapter V1); chốt VN vs quốc tế qua QĐ trước khi code BILLING-04 |
| Màu tenant phá vỡ tương phản/accessibility | Guard contrast AA khi lưu `brand_color`; giới hạn tô ở token an toàn |
| Offline-sync xung đột dữ liệu | Ưu tiên PWA-01 (đọc); PWA-02 (ghi) chỉ làm khi có mô hình idempotent rõ |
| Enforcement hạn mức bị bypass từ client | Kiểm ở server action + middleware, nguồn sự thật ở `subscriptions`/`plans` |
| Phình phạm vi V2 | Mỗi giai đoạn 1 QĐ + requirements đo được trước khi code; món "tùy chọn" (DELIV-03, BRAND-03, PWA-02) tách sang V2.1 nếu cần |

## Bước tiếp theo (nếu chốt kế hoạch này)
1. Xác nhận **thứ tự ưu tiên** 4 giai đoạn (A→B→C→D) và phạm vi tối thiểu mỗi giai đoạn.
2. Mở **QĐ đầu tiên** cho V2-A (`15-QuyetDinh/QD-010-*`) — trọng tâm: **chọn cổng thanh toán + mô hình gói**.
3. Viết `20-DanhSachYeuCau/` cho BILLING-01..06 (tiêu chí đo được), rồi `30-KeHoach/V2-A/` theo GSD như P4/P5.

> Ghi chú: các mã yêu cầu (BILLING-*, BRAND-*, DELIV-*, REPORT-*, KDS-*, PWA-*) là **đề xuất**; chốt chính thức khi đưa vào `20-DanhSachYeuCau/00-Requirements.md`.
