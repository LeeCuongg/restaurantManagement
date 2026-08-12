// scripts/shoot-marketing.mjs — Chụp ảnh sản phẩm cho trang giới thiệu (MKT-01).
//
// Chụp trên tenant DEMO đã có dữ liệu mẫu (`npm run seed:demo`). KHÔNG chụp tenant khách thật:
// ảnh nằm trong repo và hiện trên trang công khai.
//
//   1) npm run dev            (cổng 3005, hoặc đặt SHOT_BASE_URL)
//   2) npm run seed:demo
//   3) node scripts/shoot-marketing.mjs
//
// Ảnh ra `public/marketing/`. Kích thước phải KHỚP width/height khai trong app/(marketing)/page.tsx.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3005";
const SLUG = "pho-viet";
const OWNER = { email: "ownerA@pho-viet.test", password: "DemoPass123!" };
const OUT = "public/marketing";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

/** Ngữ cảnh riêng cho mỗi bề mặt — phiên admin và phiên POS/KDS không dùng chung cookie. */
async function fresh(width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // ảnh nét trên màn Retina; nhớ nén lại nếu file phình
    storageState: undefined,
  });
  return ctx.newPage();
}

async function shoot(page, path, name, clip) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200); // biểu đồ recharts vẽ xong
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  console.log("✓", name);
}

// ---- Khu quản trị: báo cáo + thực đơn --------------------------------------
{
  const page = await fresh(1280, 1000);
  await page.goto(`${BASE}/r/${SLUG}/admin/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="password"]', OWNER.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(`**/r/${SLUG}/admin`);

  // Cắt bỏ sidebar (256px) để ảnh tập trung vào nội dung; chiều cao dừng ngay sau khối
  // cuối cùng có nội dung, tránh mảng trắng thừa ở đáy ảnh.
  await shoot(page, `/r/${SLUG}/admin/reports?preset=30d`, "bao-cao", { x: 256, y: 0, width: 1024, height: 690 });
  await shoot(page, `/r/${SLUG}/admin/tables`, "admin", { x: 256, y: 0, width: 1024, height: 660 });
  await page.context().close();
}

// ---- POS quầy --------------------------------------------------------------
{
  const page = await fresh(1280, 900);
  await page.goto(`${BASE}/r/${SLUG}/pos/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="secret"]', OWNER.password);
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await page.waitForURL(`**/r/${SLUG}/pos`, { timeout: 30_000 });
  await shoot(page, `/r/${SLUG}/pos`, "pos", { x: 0, y: 0, width: 1280, height: 820 });
  await page.context().close();
}

// ---- KDS bếp ---------------------------------------------------------------
{
  const page = await fresh(1280, 900);
  await page.goto(`${BASE}/r/${SLUG}/kds/login`);
  await page.fill('input[name="email"]', OWNER.email);
  await page.fill('input[name="secret"]', OWNER.password);
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await page.waitForURL(`**/r/${SLUG}/kds`, { timeout: 30_000 });
  await shoot(page, `/r/${SLUG}/kds`, "kds", { x: 0, y: 0, width: 1280, height: 400 });
  await page.context().close();
}

// ---- Thực đơn của khách (điện thoại) ---------------------------------------
{
  const token = process.env.SHOT_TABLE_TOKEN;
  if (!token) {
    console.warn("Bỏ qua ảnh menu khách: thiếu SHOT_TABLE_TOKEN (qr_token của một bàn demo).");
  } else {
    // Trang chào bàn (đích của QR): nhận diện quán + bàn, gọi nhân viên / gọi thanh toán.
    // KHÔNG chụp màn thực đơn: menu demo chưa có ảnh món nên toàn ô "Không ảnh" — trông tệ.
    // Có ảnh món rồi thì thêm một bước chụp `/menu?t=` ở đây.
    const page = await fresh(420, 900);
    await page.goto(`${BASE}/r/${SLUG}?t=${token}`);
    await page.waitForLoadState("networkidle");
    // ORDER-10: modal hỏi tên chặn cả màn cho tới khi nhập tên (id="guest-name", nút "Bắt đầu").
    const nameBox = page.locator("#guest-name");
    if (await nameBox.isVisible().catch(() => false)) {
      await nameBox.fill("Chị Hằng");
      await page.getByRole("button", { name: "Bắt đầu" }).click();
      await nameBox.waitFor({ state: "hidden", timeout: 15_000 });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/chao-ban.png`, clip: { x: 0, y: 0, width: 420, height: 840 } });
    console.log("✓ chao-ban");
    await page.context().close();
  }
}

await browser.close();
console.log(`Xong. Ảnh trong ${OUT}/`);
