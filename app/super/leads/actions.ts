"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/auth/session";
import { setLeadStatus, type LeadStatus } from "@/lib/marketing/leads";

const ALLOWED: LeadStatus[] = ["new", "contacted", "closed"];

/** Đổi trạng thái một lead. Chỉ super-admin (bảng `leads` không có RLS policy nào). */
export async function updateLeadStatus(formData: FormData) {
  const su = await isSuperAdmin();
  if (!su) redirect("/super/login");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (!id || !ALLOWED.includes(status)) return;

  await setLeadStatus(id, status);
  revalidatePath("/super/leads");
}
