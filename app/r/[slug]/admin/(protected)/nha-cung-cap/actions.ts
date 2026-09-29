"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionMembership } from "@/lib/auth/session";
import { canManage } from "@/lib/auth/rbac";
import { setFlash } from "@/lib/flash";
import { parseSupplierForm } from "@/lib/purchasing/supplier";

/** Guard chung: owner/manager (QD-027 C5). RLS `suppliers` chặn thêm một lớp ở DB. */
async function requirePurchasing(slug: string) {
  const session = await getSessionMembership(slug);
  if (!session || !canManage(session.role, "purchasing")) {
    redirect(`/r/${slug}/admin?error=${encodeURIComponent("Không đủ quyền.")}`);
  }
  return session!;
}

const base = (slug: string) => `/r/${slug}/admin/nha-cung-cap`;

function dbError(message: string, code?: string): string {
  if (code === "23505") return "Số điện thoại này đã có ở một nhà cung cấp khác.";
  return `Lưu lỗi: ${message}`;
}

/** "+ Nhà cung cấp" (PURCH-01). Mã NCC000001 do DB cấp (trigger 0076). */
export async function createSupplier(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const session = await requirePurchasing(slug);
  const parsed = parseSupplierForm(fd);
  if (!parsed.ok) {
    await setFlash("error", parsed.error);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ tenant_id: session.tenant.id, ...parsed.value })
    .select("id, code")
    .single();
  if (error) {
    await setFlash("error", dbError(error.message, error.code));
    return;
  }
  revalidatePath(base(slug));
  await setFlash("ok", `Đã thêm nhà cung cấp ${data.code}.`);
}

export async function updateSupplier(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const session = await requirePurchasing(slug);
  const id = String(fd.get("id") ?? "");
  const parsed = parseSupplierForm(fd);
  if (!parsed.ok) {
    await setFlash("error", parsed.error);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);
  if (error) {
    await setFlash("error", dbError(error.message, error.code));
    return;
  }
  revalidatePath(base(slug), "layout");
  await setFlash("ok", "Đã lưu nhà cung cấp.");
}

/** "Ngừng hoạt động" / "Cho hoạt động lại": ẩn khỏi ô chọn trên phiếu nhập, giữ nguyên lịch sử và công nợ. */
export async function setSupplierActive(fd: FormData) {
  const slug = String(fd.get("slug") ?? "");
  const session = await requirePurchasing(slug);
  const id = String(fd.get("id") ?? "");
  const active = String(fd.get("active") ?? "") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);
  if (error) {
    await setFlash("error", dbError(error.message, error.code));
    return;
  }
  revalidatePath(base(slug), "layout");
  await setFlash("ok", active ? "Nhà cung cấp hoạt động lại." : "Đã ngừng hoạt động nhà cung cấp.");
}
