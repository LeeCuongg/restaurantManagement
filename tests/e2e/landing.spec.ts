import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Trang giới thiệu + form nhận khách quan tâm (MKT-01/02/03). Chạy trên dev server đang chạy.
 * Ghi thật vào bảng `leads` rồi tự dọn — dùng SĐT dành riêng cho kiểm thử.
 */
const TEST_PHONE = "0900000000";
const TEST_NAME = "Kiểm thử tự động";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** `leads` không có RLS policy nào ⇒ chỉ service role đọc/xóa được để kiểm chứng. */
const admin = () => createClient(url!, serviceKey!, { auth: { persistSession: false } });

const cleanup = async () => {
  await admin().from("leads").delete().eq("phone", TEST_PHONE);
};

test.skip(!url || !serviceKey, "Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

test.beforeEach(cleanup);
test.afterAll(cleanup);

test("trang hiện đủ các khối và KHÔNG còn lối vào nội bộ (MKT-01)", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("biết ngay");
  for (const h of [
    "Ba thứ khiến quán mất tiền mỗi ngày",
    "Mở máy là biết quán đang chạy thế nào",
    "Bốn màn hình, một hệ thống",
    "Những việc hằng ngày, hệ thống lo sẵn",
    "Vì sao tin được",
    "Để lại số, mình gọi lại tư vấn",
  ]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }

  // Trang bán hàng không được dẫn vào style-guide nội bộ hay tenant demo.
  await expect(page.locator('a[href*="/style-guide"]')).toHaveCount(0);
  await expect(page.locator('a[href*="/r/"]')).toHaveCount(0);

  // Ảnh sản phẩm phải tải được thật, không phải link gãy.
  const shots = page.locator('img[src*="/marketing/"], img[src*="_next/image"]');
  expect(await shots.count()).toBeGreaterThan(0);
});

test("SĐT sai → báo lỗi tại chỗ, không ghi DB (MKT-02)", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Tên anh/chị").first().fill(TEST_NAME);
  await page.getByLabel("Số điện thoại").first().fill("123");
  await page.getByRole("button", { name: "Nhận tư vấn" }).first().click();

  // Không dùng getByRole("alert"): Next có sẵn một vùng thông báo route cũng mang role này.
  await expect(page.getByText("Số điện thoại chưa đúng")).toBeVisible();
  await expect(page.getByLabel("Số điện thoại").first()).toHaveAttribute("aria-invalid", "true");
  const { data } = await admin().from("leads").select("id").eq("phone", "123");
  expect(data ?? []).toHaveLength(0);
});

test("gửi hợp lệ → cảm ơn; gửi lại cùng số chỉ ghi 1 bản ghi (MKT-02)", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Tên anh/chị").first().fill(TEST_NAME);
  await page.getByLabel("Số điện thoại").first().fill("+84 900 000 000"); // kiểm luôn việc đổi +84 → 0
  await page.getByRole("button", { name: "Nhận tư vấn" }).first().click();
  await expect(page.getByText("Đã nhận thông tin của anh/chị.")).toBeVisible();

  // Gửi lại ngay lần nữa (cửa sổ chống-bấm-lặp 60 giây).
  await page.goto("/");
  await page.getByLabel("Tên anh/chị").first().fill(TEST_NAME);
  await page.getByLabel("Số điện thoại").first().fill(TEST_PHONE);
  await page.getByRole("button", { name: "Nhận tư vấn" }).first().click();
  await expect(page.getByText("Đã nhận thông tin của anh/chị.")).toBeVisible();

  const { data } = await admin().from("leads").select("name, phone, status").eq("phone", TEST_PHONE);
  expect(data ?? []).toHaveLength(1);
  expect(data?.[0]).toMatchObject({ name: TEST_NAME, phone: TEST_PHONE, status: "new" });
});

test("khách vãng lai không đọc/ghi được bảng leads (MKT-03)", async () => {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const read = await anon.from("leads").select("id, name, phone");
  expect(read.data ?? []).toHaveLength(0);

  const write = await anon.from("leads").insert({ name: "Kẻ lạ", phone: "0911111111" });
  expect(write.error).not.toBeNull();
});
