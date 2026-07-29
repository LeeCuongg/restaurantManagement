import { redirect } from "next/navigation";
import { getSessionMembership, type Role } from "@/lib/auth/session";
import { canManage, canAssignRole, defaultRouteForRole } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { StaffCreateForm } from "@/components/admin/staff/StaffCreateForm";
import { resetPin, setStaffActive, deleteStaff } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ nhà hàng",
  manager: "Quản lý",
  cashier: "Thu ngân",
  waiter: "Phục vụ",
  kitchen: "Bếp",
  station: "Trạm",
};

export default async function StaffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSessionMembership(slug);
  if (!session) redirect(`/r/${slug}/admin/login`);
  if (!canManage(session.role, "staff")) redirect(defaultRouteForRole(slug, session.role));

  const supabase = await createClient();
  // Liệt kê CẢ owner/manager để thấy trọn đội ngũ; nút thao tác tự ẩn theo `canAssignRole`.
  const { data: staff } = await supabase
    .from("memberships")
    .select("id, display_name, email, role, active, created_at")
    .eq("tenant_id", session.tenant.id)
    .in("role", ["owner", "manager", "cashier", "waiter", "kitchen"])
    .order("created_at", { ascending: true });

  const canCreateManager = canAssignRole(session.role, "manager");

  return (
    <div className="w-full max-w-4xl">
      <h1 className="font-display text-2xl text-ink">Nhân viên</h1>
      <p className="mt-xxs text-sm text-steel">
        Nhân viên trạm có email riêng + PIN 4 số, đăng nhập thẳng ở POS/KDS (QD-009).{" "}
        {canCreateManager
          ? "Vai trò Quản lý vào được khu quản trị nên dùng mật khẩu, không dùng PIN — và không xem được mục Cài đặt."
          : "Chỉ chủ nhà hàng mới cấp được tài khoản Quản lý."}
      </p>

      <StaffCreateForm slug={slug} canCreateManager={canCreateManager} />

      {/* Danh sách */}
      <div className="mt-lg overflow-x-auto rounded-lg border border-hairline-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-steel">
            <tr>
              <th className="px-md py-sm font-medium">Tên</th>
              <th className="px-md py-sm font-medium">Email</th>
              <th className="px-md py-sm font-medium">Vai trò</th>
              <th className="px-md py-sm font-medium">Trạng thái</th>
              <th className="px-md py-sm font-medium">Đặt lại</th>
              <th className="px-md py-sm font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => {
              const role = s.role as Role;
              const editable = canAssignRole(session.role, role);
              const isManagerRow = role === "manager";

              return (
                <tr key={s.id} className="border-t border-hairline-soft align-middle">
                  <td className="px-md py-sm text-ink">{s.display_name}</td>
                  <td className="px-md py-sm font-mono text-xs text-steel">{s.email ?? "—"}</td>
                  <td className="px-md py-sm">
                    <Badge variant={isManagerRow || role === "owner" ? "orange" : "cream"}>
                      {ROLE_LABEL[role] ?? role}
                    </Badge>
                  </td>
                  <td className="px-md py-sm">
                    {s.active ? (
                      <span className="text-status-ready">Đang bật</span>
                    ) : (
                      <span className="text-steel">Đã tắt</span>
                    )}
                  </td>
                  <td className="px-md py-sm">
                    {editable ? (
                      <form action={resetPin} className="flex items-center gap-xs">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={s.id} />
                        {isManagerRow ? (
                          <Input
                            name="secret"
                            type="password"
                            minLength={8}
                            required
                            autoComplete="new-password"
                            placeholder="Mật khẩu mới"
                            className="h-9 w-40"
                            aria-label={`Mật khẩu mới cho ${s.display_name}`}
                          />
                        ) : (
                          <Input
                            name="secret"
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            required
                            autoComplete="off"
                            placeholder="••••"
                            className="h-9 w-24"
                            aria-label={`PIN mới cho ${s.display_name}`}
                          />
                        )}
                        <Button type="submit" variant="secondary" size="sm">
                          Lưu
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-stone">—</span>
                    )}
                  </td>
                  <td className="px-md py-sm">
                    {editable ? (
                      <div className="flex items-center gap-xs">
                        <form action={setStaffActive}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                          <Button type="submit" variant="link" size="sm">
                            {s.active ? "Tắt" : "Bật"}
                          </Button>
                        </form>
                        <form action={deleteStaff}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmSubmit
                            message={`Xóa "${s.display_name}"? Thao tác không hoàn tác được.`}
                            className="inline-flex h-9 items-center rounded-md px-sm text-sm text-status-late hover:bg-surface"
                          >
                            Xóa
                          </ConfirmSubmit>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-stone">Không thao tác được</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {(staff ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-md py-lg text-center text-steel">
                  Chưa có nhân viên. Thêm ở form phía trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
