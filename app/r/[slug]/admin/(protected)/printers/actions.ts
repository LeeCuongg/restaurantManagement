"use server";

import { getSessionMembership } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivationCode } from "@/lib/print/activation";
import { checkRateLimit, RULES, tooManyMessage } from "@/lib/security/rate-limit";

export type MaKichHoatState = { code: string; expiresAt: string } | { error: string } | null;

/**
 * Chủ quán tự tạo mã kích hoạt cầu in (PRINT-17) — không phải xin quản trị hệ thống. CHỈ owner: cài
 * bằng mã mới xoay mật khẩu tài khoản cầu in, cầu in đang chạy ở máy khác ngừng in ngay (QD-019 D6,
 * cập nhật 27/09). Quản lý ca bấm nhầm là bếp mất phiếu giữa ca — quyền này để cho chủ.
 */
export async function taoMaKichHoat(slug: string): Promise<MaKichHoatState> {
  const session = await getSessionMembership(slug);
  if (!session) return { error: "Phiên đăng nhập đã hết — đăng nhập lại." };
  if (session.role !== "owner") return { error: "Chỉ chủ quán tạo được mã kích hoạt." };

  const admin = createAdminClient();
  const { data: quan } = await admin.from("tenants").select("status").eq("id", session.tenant.id).maybeSingle();
  // Quán tạm ngưng (TENANT-06) không được nhận thêm cầu in — cùng quy tắc với lúc đổi mã.
  if (quan?.status !== "active") return { error: "Nhà hàng đang tạm ngưng — không tạo được mã." };

  const rl = await checkRateLimit(RULES.bridgeCode, [session.tenant.id]);
  if (!rl.ok) return { error: tooManyMessage(rl.retryAfterS) };

  try {
    return await createActivationCode(admin, { tenantId: session.tenant.id, createdBy: session.userId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không tạo được mã kích hoạt." };
  }
}
