import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bộ cài cầu in chung `cau-in.zip` (PRINT-17) — nằm ở bucket riêng, không công khai. `print-pack.ps1
 * -Upload` đưa bản mới lên (ghi đè cùng tên); màn Admin → Máy in cho owner/manager tải qua link ký hạn.
 * CHỈ server, với admin client (service role).
 */
export const BO_CAI_BUCKET = "bridge-installer";
export const BO_CAI_FILE = "cau-in.zip";
const HAN_LINK_GIAY = 60;

export type ThongTinBoCai = { kichThuoc: number; capNhatLuc: string };

/** Bộ cài hiện có trên Storage — `null` nếu chưa đóng gói lần nào. */
export async function thongTinBoCai(admin: SupabaseClient): Promise<ThongTinBoCai | null> {
  const { data, error } = await admin.storage.from(BO_CAI_BUCKET).list("", { search: BO_CAI_FILE });
  if (error) return null;
  const f = data?.find((o) => o.name === BO_CAI_FILE);
  if (!f) return null;
  const kichThuoc = Number((f.metadata as { size?: number } | null)?.size ?? 0);
  return { kichThuoc, capNhatLuc: f.updated_at ?? f.created_at ?? "" };
}

/** Link tải ký hạn 60 giây (trình duyệt lưu thành `cau-in.zip`) — `null` nếu chưa có bộ cài. */
export async function linkTaiBoCai(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(BO_CAI_BUCKET)
    .createSignedUrl(BO_CAI_FILE, HAN_LINK_GIAY, { download: BO_CAI_FILE });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
