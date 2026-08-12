import { test, expect, chromium } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Smoke báo cáo dòng tiền (REPORT-04..09). Chạy trên dev server đang chạy.
 * Cần env: E2E_REPORT_EMAIL / E2E_REPORT_PASSWORD / E2E_REPORT_SLUG (tài khoản owner có dữ liệu).
 */
const SLUG = process.env.E2E_REPORT_SLUG ?? "qt-food";
const EMAIL = process.env.E2E_REPORT_EMAIL ?? "";
const PASSWORD = process.env.E2E_REPORT_PASSWORD ?? "";

const REPORTS = `/r/${SLUG}/admin/reports`;

test.skip(!EMAIL || !PASSWORD, "Thiếu E2E_REPORT_EMAIL / E2E_REPORT_PASSWORD");

// Đăng nhập MỘT lần rồi tái dùng cookie: mỗi test tự login sẽ đụng giới hạn tần suất
// đăng nhập của Supabase Auth và rớt session giữa chừng.
const statePath = join(mkdtempSync(join(tmpdir(), "rp-")), "state.json");

test.beforeAll(async ({ baseURL }) => {
  const browser = await chromium.launch();
  // storageState: undefined — `chromium` của @playwright/test kế thừa `use` của project,
  // mà file state chính là thứ hook này đang đi tạo ra.
  const page = await browser.newPage({ baseURL, storageState: undefined });
  await page.goto(`/r/${SLUG}/admin/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(`**/r/${SLUG}/admin`, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.context().storageState({ path: statePath });
  await browser.close();
});

test.use({ storageState: statePath });

test("mặc định = tháng này, đủ KPI và 6 khối phân tích", async ({ page }) => {
  await page.goto(REPORTS);
  await expect(page.getByRole("heading", { name: "Báo cáo dòng tiền" })).toBeVisible();

  for (const kpi of ["Doanh thu", "Số hóa đơn", "TB/hóa đơn", "Giờ cao điểm"]) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible();
  }
  for (const panel of [
    "Cơ cấu theo nhóm món",
    "Theo kênh bán",
    "Món bán chạy",
    "Theo phương thức thanh toán",
    "Theo khu vực & bàn",
    "Khung giờ cao điểm",
  ]) {
    await expect(page.getByRole("heading", { name: panel })).toBeVisible();
  }
});

test("preset Hôm nay chuyển biểu đồ sang mốc giờ (REPORT-06)", async ({ page }) => {
  await page.goto(REPORTS);
  await page.getByRole("button", { name: "Hôm nay" }).click();
  await page.waitForURL(/preset=today/);
  await expect(page.getByRole("heading", { name: "Doanh thu theo giờ" })).toBeVisible();
});

test("khoảng tùy chọn từ URL render đúng nhãn kỳ (REPORT-05)", async ({ page }) => {
  await page.goto(`${REPORTS}?preset=custom&from=2026-07-01&to=2026-08-12`);
  await expect(page.getByText("01/07 – 12/08/2026")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doanh thu theo ngày" })).toBeVisible();
});

test("popover Tùy chọn chọn được ngày và áp dụng", async ({ page }) => {
  await page.goto(REPORTS);
  await page.getByRole("button", { name: "Tùy chọn" }).click();
  await expect(page.getByRole("dialog", { name: "Chọn khoảng thời gian" })).toBeVisible();
  await page.fill("#range-from", "2026-08-01");
  await page.fill("#range-to", "2026-08-10");
  await page.getByRole("button", { name: "Áp dụng" }).click();
  await page.waitForURL(/from=2026-08-01&to=2026-08-10/);
  await expect(page.getByText("01/08 – 10/08/2026")).toBeVisible();
});

test("tham số hỏng không làm sập trang (REPORT-05)", async ({ page }) => {
  for (const qs of ["?from=2026-08-20&to=2026-08-01", "?from=2024-01-01&to=2026-08-12", "?from=xx&to=yy"]) {
    await page.goto(`${REPORTS}${qs}`);
    await expect(page.getByRole("heading", { name: "Báo cáo dòng tiền" })).toBeVisible();
    await expect(page.getByText(/^Tháng \d+\/\d{4} · giờ Việt Nam$/)).toBeVisible();
  }
});

test("giữ tương thích link cũ ?bucket=&offset=", async ({ page }) => {
  await page.goto(`${REPORTS}?bucket=month&offset=-1`);
  await expect(page.getByText("Tháng 7/2026 · giờ Việt Nam")).toBeVisible();
});
