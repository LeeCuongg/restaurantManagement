import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * PRINT-17 — chủ quán tải bộ cài cầu in ngay ở Admin → Máy in. Cần bộ cài đã đưa lên
 * (`print-pack.ps1 -Upload`). Chỉ owner/manager ĐÚNG quán tải được; bucket không công khai.
 */
const SLUG = "pho-viet";
const ROUTE = `/r/${SLUG}/admin/printers/bo-cai`;

async function dangNhapAdmin(page: Page, slug: string, email: string) {
  await page.goto(`/r/${slug}/admin/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "DemoPass123!");
  await Promise.all([page.waitForLoadState("networkidle"), page.click('button[type="submit"]')]);
}

test("chủ quán bấm 'Tải bộ cài' → nhận cau-in.zip đúng kích thước", async ({ page }) => {
  await dangNhapAdmin(page, SLUG, "ownerA@pho-viet.test");
  await page.goto(`/r/${SLUG}/admin/printers`, { waitUntil: "networkidle" });
  const nut = page.getByRole("link", { name: /^Tải bộ cài cầu in \(\d+ MB\)$/ });
  await expect(nut).toBeVisible();
  await expect(page.getByText(/Đóng gói lúc \d/)).toBeVisible();

  const [tai] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), nut.click()]);
  expect(tai.suggestedFilename()).toBe("cau-in.zip");
  const duongDan = await tai.path();
  const fs = await import("node:fs");
  const buf = fs.readFileSync(duongDan);
  expect(buf.subarray(0, 2).toString()).toBe("PK");
  expect(buf.length).toBeGreaterThan(20 * 1024 * 1024); // kèm node.exe
});

test("chưa đăng nhập → 401, không có link", async ({ request }) => {
  const r = await request.get(ROUTE, { maxRedirects: 0 });
  expect(r.status()).toBe(401);
});

test("chủ quán KHÁC (bun-bo) → 401 ở route của pho-viet", async ({ page }) => {
  await dangNhapAdmin(page, "bun-bo", "ownerB@bun-bo.test");
  const r = await page.request.get(ROUTE, { maxRedirects: 0 });
  expect(r.status()).toBe(401);
});

test("tài khoản trạm (không quản lý máy in) → 403", async ({ page }) => {
  await page.goto(`/r/${SLUG}/pos/login`);
  await page.fill('input[name="email"]', "station@pho-viet.test");
  await page.fill('input[name="secret"]', "StationPass123!");
  await Promise.all([page.waitForURL(new RegExp(`/r/${SLUG}/pos$`)), page.click('button[type="submit"]')]);
  const r = await page.request.get(ROUTE, { maxRedirects: 0 });
  expect(r.status()).toBe(403);
});

test("bucket không công khai: anon không tải thẳng được", async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.storage.from("bridge-installer").download("cau-in.zip");
  expect(data).toBeNull();
  expect(error).not.toBeNull();
  const pub = anon.storage.from("bridge-installer").getPublicUrl("cau-in.zip").data.publicUrl;
  expect((await fetch(pub)).status).toBeGreaterThanOrEqual(400);
});

test("chủ quán tự tạo mã kích hoạt → mã hiện một lần, DB lưu bản băm, chưa dùng, hết hạn sau 30 phút", async ({ page }) => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const tenantId = (await admin.from("tenants").select("id").eq("slug", SLUG).single()).data!.id as string;
  await dangNhapAdmin(page, SLUG, "ownerA@pho-viet.test");
  await page.goto(`/r/${SLUG}/admin/printers`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Tạo mã kích hoạt" }).click();
  const o = page.getByRole("status", { name: "Mã kích hoạt" });
  await expect(o).toBeVisible({ timeout: 15_000 });
  const hien = (await o.locator("span").first().textContent())!.trim();
  expect(hien).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  await expect(o).toContainText(/hết hạn lúc \d{2}:\d{2}/);

  const crypto = await import("node:crypto");
  const bam = crypto.createHash("sha256").update(`cau-in:${hien.replace("-", "")}`).digest("hex");
  const { data: dong } = await admin
    .from("bridge_activation_codes")
    .select("tenant_id, used_at, expires_at, created_by")
    .eq("code_hash", bam)
    .single();
  try {
    expect(dong!.tenant_id).toBe(tenantId);
    expect(dong!.used_at).toBeNull();
    expect(dong!.created_by).not.toBeNull();
    const conLai = new Date(dong!.expires_at).getTime() - Date.now();
    expect(conLai).toBeGreaterThan(25 * 60_000);
    expect(conLai).toBeLessThanOrEqual(30 * 60_000 + 5_000);
    // Mã không lưu thô ở đâu trong trang sau khi tải lại.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(hien)).toHaveCount(0);
  } finally {
    await admin.from("bridge_activation_codes").delete().eq("code_hash", bam);
  }
});

test("tài khoản trạm vào màn Máy in cũng không có nút tạo mã", async ({ page }) => {
  // Trạm không vào được admin (bị đưa về POS) — kiểm chắc: không có nút, không có mã.
  await page.goto(`/r/${SLUG}/pos/login`);
  await page.fill('input[name="email"]', "station@pho-viet.test");
  await page.fill('input[name="secret"]', "StationPass123!");
  await Promise.all([page.waitForURL(new RegExp(`/r/${SLUG}/pos$`)), page.click('button[type="submit"]')]);
  await page.goto(`/r/${SLUG}/admin/printers`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Tạo mã kích hoạt" })).toHaveCount(0);
});
