import Link from "next/link";
import { getSessionMembership } from "@/lib/auth/session";
import { canManage } from "@/lib/auth/rbac";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOnboardingState } from "./onboarding/actions";

export const dynamic = "force-dynamic";

/**
 * Tổng quan admin — hiện CHỈ là thẻ điều hướng, không có số liệu tiền, nên không cần guard
 * `canManage` riêng (layout đã lọc owner|manager).
 *
 * ⚠️ AUTH-05: nếu sau này thêm KPI doanh thu vào đây thì PHẢI bọc bằng
 * `canManage(role, "reports")` — không thì rò rỉ đúng thứ trang Báo cáo đang chặn.
 * Thẻ điều hướng cũng ẩn/hiện theo cùng `canManage` như sidebar, để không dẫn người dùng
 * tới trang họ sẽ bị đá ra.
 */

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { slug } = await params;
  const { ok } = await searchParams;
  const session = await getSessionMembership(slug);
  const state = await getOnboardingState(slug);

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl text-ink">
        Chào {session?.tenant.name ?? slug}
      </h1>
      <p className="mt-sm text-sm text-slate">
        Bảng điều khiển quản trị. Quản lý thực đơn, bàn & QR, cấu hình nhà hàng ở thanh bên.
      </p>

      {ok && (
        <p
          role="status"
          className="mt-md rounded-md border border-status-ready bg-status-ready-bg px-md py-sm text-sm text-status-ready"
        >
          {ok}
        </p>
      )}

      {/* CTA onboarding — ẩn khi đã hoàn tất */}
      {!state.done && (
        <Card variant="cream" className="mt-lg flex flex-wrap items-center justify-between gap-md">
          <div>
            <CardTitle>Hoàn tất thiết lập nhà hàng</CardTitle>
            <CardContent>
              Chạy trình hướng dẫn 4 bước: thông tin → menu mẫu → bàn + QR → xong. Chỉ mất vài phút.
            </CardContent>
          </div>
          <Button asChild variant="primary" size="md">
            <Link href={`/r/${slug}/admin/onboarding`}>Bắt đầu thiết lập →</Link>
          </Button>
        </Card>
      )}

      <div className="mt-xl grid gap-md sm:grid-cols-2">
        <Card>
          <CardTitle>Thực đơn</CardTitle>
          <CardContent>
            Tạo danh mục, món (ảnh, giá), nhóm tùy chọn và bật &quot;hết món&quot; ở mục{" "}
            <Link href={`/r/${slug}/admin/menu`} className="text-primary hover:underline">
              Thực đơn
            </Link>
            .
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Bàn & QR</CardTitle>
          <CardContent>
            Khai báo khu vực/bàn và xuất mã QR ở mục{" "}
            <Link href={`/r/${slug}/admin/tables`} className="text-primary hover:underline">
              Bàn & QR
            </Link>
            .
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Nhân viên & PIN</CardTitle>
          <CardContent>
            Tạo nhân viên trạm (thu ngân / phục vụ / bếp) và đặt PIN 4 số ở mục{" "}
            <span className="text-ink">Nhân viên</span>.
          </CardContent>
        </Card>
        {session && canManage(session.role, "settings") && (
          <Card>
            <CardTitle>Cài đặt</CardTitle>
            <CardContent>
              Logo, tên nhà hàng, %phí/%VAT, footer hóa đơn ở mục{" "}
              <Link href={`/r/${slug}/admin/settings`} className="text-primary hover:underline">
                Cài đặt
              </Link>
              .
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
