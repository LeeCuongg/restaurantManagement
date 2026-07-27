"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionMembership, type Role } from "@/lib/auth/session";
import { canManageStaff, canAssignRole } from "@/lib/auth/rbac";
import { hashPin, isValidPin, isValidManagerPassword, MANAGER_PASSWORD_MIN } from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { derivePinPassword } from "@/lib/auth/staff-credentials";
import { setFlash } from "@/lib/flash";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Guard chung: chỉ owner/manager của tenant theo slug được quản lý nhân viên. */
async function requireManager(slug: string) {
  const session = await getSessionMembership(slug);
  if (!session || !canManageStaff(session.role)) {
    redirect(`/r/${slug}/admin/staff?error=${encodeURIComponent("Không đủ quyền.")}`);
  }
  return session!;
}

function staffPath(slug: string) {
  return `/r/${slug}/admin/staff`;
}

type TargetMember = { user_id: string | null; email: string | null; role: Role };
type LoadResult = { ok: false; error: string } | { ok: true; target: TargetMember };

/**
 * Đọc thành viên đích + kiểm quyền tác động lên vai trò của họ (QD-010 §4).
 * Vai trò đích LUÔN đọc từ DB, không lấy từ `formData` — nếu tin form thì manager chỉ cần
 * sửa hidden input là xóa được owner.
 */
async function loadTarget(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  actorRole: Role,
  id: string
): Promise<LoadResult> {
  const { data } = await admin
    .from("memberships")
    .select("user_id, email, role")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Không tìm thấy nhân viên." };
  if (!canAssignRole(actorRole, data.role as Role)) {
    return { ok: false, error: "Không đủ quyền với thành viên này." };
  }
  return { ok: true, target: data as TargetMember };
}

/**
 * Tạo thành viên (QD-009 + QD-010 §4). Hai nhánh cấp bí mật:
 *  - cashier/waiter/kitchen → PIN 4 số, mật khẩu Supabase suy dẫn (`derivePinPassword`).
 *  - manager → MẬT KHẨU ≥8 ký tự đặt thẳng, `pin_hash` để null (không dùng PIN-gate).
 * Vai trò gán được do `canAssignRole` quyết định — chặn ở ĐÂY, không chỉ ẩn option trong form.
 */
export async function createStaff(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await requireManager(slug);

  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const secret = String(formData.get("secret") ?? "");

  if (!displayName) return setFlash("error", "Thiếu tên nhân viên.");
  if (!EMAIL_RE.test(email)) return setFlash("error", "Email không hợp lệ.");
  if (!canAssignRole(session.role, role)) {
    return setFlash("error", "Không đủ quyền cấp vai trò này.");
  }

  const isManager = role === "manager";
  if (isManager) {
    if (!isValidManagerPassword(secret)) {
      return setFlash(
        "error",
        `Mật khẩu quản lý phải từ ${MANAGER_PASSWORD_MIN} ký tự (không dùng 4 chữ số).`
      );
    }
  } else if (!isValidPin(secret)) {
    return setFlash("error", "PIN phải gồm đúng 4 chữ số.");
  }

  const admin = createAdminClient();

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: isManager ? secret : derivePinPassword(email, secret),
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (cErr || !created?.user) {
    const dup = /registered|already/i.test(cErr?.message ?? "");
    return setFlash(
      "error",
      dup ? "Email đã được dùng." : `Không tạo được tài khoản: ${cErr?.message ?? "lỗi"}`
    );
  }

  const userId = created.user.id;
  const pin_hash = isManager ? null : await hashPin(secret);
  const { error: mErr } = await admin.from("memberships").insert({
    tenant_id: session.tenant.id,
    user_id: userId,
    role,
    display_name: displayName,
    email,
    pin_hash,
    active: true,
  });
  if (mErr) {
    // Rollback tài khoản vừa tạo để tránh mồ côi.
    await admin.auth.admin.deleteUser(userId);
    return setFlash("error", `Không tạo được nhân viên: ${mErr.message}`);
  }

  revalidatePath(staffPath(slug));
  await setFlash(
    "ok",
    isManager ? `Đã thêm quản lý ${displayName} (${email}).` : `Đã thêm ${displayName} (${email}).`
  );
}

/**
 * Đặt lại bí mật đăng nhập. Nhánh theo vai trò ĐÍCH (đọc từ DB):
 *  - vai trò trạm → PIN 4 số: cập nhật mật khẩu suy dẫn + `pin_hash`.
 *  - manager → mật khẩu ≥8 ký tự: cập nhật thẳng, `pin_hash` giữ null.
 */
export async function resetPin(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await requireManager(slug);
  const id = String(formData.get("id") ?? "");
  const secret = String(formData.get("secret") ?? "");

  const admin = createAdminClient();
  const loaded = await loadTarget(admin, session.tenant.id, session.role, id);
  if (!loaded.ok) return setFlash("error", loaded.error);
  const { target } = loaded;

  const isManager = target.role === "manager";
  if (isManager) {
    if (!isValidManagerPassword(secret)) {
      return setFlash(
        "error",
        `Mật khẩu quản lý phải từ ${MANAGER_PASSWORD_MIN} ký tự (không dùng 4 chữ số).`
      );
    }
  } else if (!isValidPin(secret)) {
    return setFlash("error", "PIN phải 4 chữ số.");
  }

  if (target.user_id && target.email) {
    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      password: isManager ? secret : derivePinPassword(target.email, secret),
    });
    if (error) return setFlash("error", `Không đặt lại được: ${error.message}`);
  }

  const { error } = await admin
    .from("memberships")
    .update({ pin_hash: isManager ? null : await hashPin(secret) })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);
  if (error) return setFlash("error", error.message);

  revalidatePath(staffPath(slug));
  await setFlash("ok", isManager ? "Đã đặt lại mật khẩu." : "Đã đặt lại PIN.");
}

/**
 * Bật/tắt thành viên (giữ lịch sử). Tắt = ban tài khoản Supabase để không đăng nhập được.
 * Void: cập nhật tại chỗ (badge trạng thái đổi ngay), không đổi link.
 */
export async function setStaffActive(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await requireManager(slug);
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const admin = createAdminClient();
  const loaded = await loadTarget(admin, session.tenant.id, session.role, id);
  if (!loaded.ok) return setFlash("error", loaded.error);
  const { target } = loaded;

  await admin
    .from("memberships")
    .update({ active })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (target.user_id) {
    await admin.auth.admin.updateUserById(target.user_id, {
      ban_duration: active ? "none" : "876000h",
    });
  }

  revalidatePath(staffPath(slug));
  await setFlash("ok", active ? "Đã bật nhân viên." : "Đã tắt nhân viên.");
}

/**
 * Xóa cứng thành viên: xóa membership + tài khoản Supabase.
 * `loadTarget` + `canAssignRole` đảm bảo không ai xóa được owner/station, và manager không
 * xóa được manager khác.
 */
export async function deleteStaff(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await requireManager(slug);
  const id = String(formData.get("id") ?? "");

  const admin = createAdminClient();
  const loaded = await loadTarget(admin, session.tenant.id, session.role, id);
  if (!loaded.ok) return setFlash("error", loaded.error);
  const { target } = loaded;

  await admin
    .from("memberships")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (target.user_id) await admin.auth.admin.deleteUser(target.user_id);

  revalidatePath(staffPath(slug));
  await setFlash("ok", "Đã xóa nhân viên.");
}
