import { NextResponse } from "next/server";
import { getSessionMembership } from "@/lib/auth/session";
import { canManage } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { BO_CAI_FILE, linkTaiBoCai } from "@/lib/print/bo-cai";
import { taoMaChoChuQuan, type CAU_LOI } from "@/lib/print/ma-chu-quan";

export const dynamic = "force-dynamic";

/**
 * POST /r/[slug]/admin/printers/bo-cai — tải bộ cài cầu in (PRINT-17). Owner/manager của quán.
 *
 * Chủ quán: tạo mã kích hoạt và GẮN VÀO TÊN FILE (`cau-in-K7M2P9QX.zip`). Windows "Extract All" tạo thư mục
 * cùng tên → `print-activate.ps1` đọc mã từ đó → cài không phải gõ mã. Không sửa được nội dung zip ở đây:
 * file 33 MB nằm trên Storage, hàm server Vercel chỉ trả được ~4,5 MB.
 * Quản lý: bộ cài không kèm mã (lúc cài sẽ hỏi).
 *
 * POST (không phải GET) vì mỗi lần bấm tạo một mã: GET có thể bị trình duyệt/tiện ích tải trước.
 * Trả 303 sang link Storage ký hạn 60 giây — trình duyệt tải file, trang đứng yên.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionMembership(slug);
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canManage(session.role, "printers")) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  // Form của chính trang Máy in — chặn trang lạ tự gửi form để phát mã.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const veTrang = (loi: keyof typeof CAU_LOI) =>
    NextResponse.redirect(new URL(`/r/${slug}/admin/printers?loi=${loi}`, req.url), 303);

  let tenFile = BO_CAI_FILE;
  if (session.role === "owner") {
    const ma = await taoMaChoChuQuan(session);
    if ("error" in ma) return veTrang(ma.error);
    tenFile = `cau-in-${ma.code}.zip`;
  }

  const link = await linkTaiBoCai(createAdminClient(), tenFile);
  if (!link) return veTrang("chua-co-bo-cai");
  return NextResponse.redirect(link, 303);
}
