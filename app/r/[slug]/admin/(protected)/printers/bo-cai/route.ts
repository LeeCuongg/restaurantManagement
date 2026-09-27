import { NextResponse } from "next/server";
import { getSessionMembership } from "@/lib/auth/session";
import { canManage } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkTaiBoCai } from "@/lib/print/bo-cai";

export const dynamic = "force-dynamic";

/**
 * GET /r/[slug]/admin/printers/bo-cai — tải bộ cài cầu in (PRINT-17). Chỉ owner/manager của quán (cùng
 * quyền xem màn Máy in). Trả 302 sang link Storage ký hạn 60 giây: file 35 MB không đi qua hàm server.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionMembership(slug);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canManage(session.role, "printers")) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });

  const link = await linkTaiBoCai(createAdminClient());
  if (!link) return NextResponse.json({ error: "Chưa có bộ cài — liên hệ quản trị hệ thống." }, { status: 404 });
  return NextResponse.redirect(link, 302);
}
