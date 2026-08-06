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
    <div className="w-full">
      <h1 className="font-display text-2xl text-ink">Nhân viên</h1>
      <p className="mt-xxs max-w-3xl text-sm text-steel">
        Nhân viên trạm có email riêng + PIN 4 số, đăng nhập thẳng ở POS/KDS (QD-009).{" "}
        {canCreateManager
          ? "Vai trò Quản lý vào được khu quản trị nên dùng mật khẩu, không dùng PIN — và không xem được mục Cài đặt."
          : "Chỉ chủ nhà hàng mới cấp được tài khoản Quản lý."}
      </p>

      <StaffCreateForm slug={slug} canCreateManager={canCreateManager} />

      {/* Danh sách — thẻ trên điện thoại/tablet, bảng từ `xl` trở lên.
          Bảng 6 cột (2 form thao tác + badge vai trò) cần ~1000px nội dung mới không xuống dòng
          vỡ chữ; dưới ngưỡng đó dùng thẻ thay vì ép người dùng cuộn ngang. */}
      <div className="mt-lg grid gap-sm sm:grid-cols-2 xl:hidden">
        {(staff ?? []).map((s) => {
          const role = s.role as Role;
          const editable = canAssignRole(session.role, role);
          const isManagerRow = role === "manager";

          return (
            <div key={s.id} className="rounded-lg border border-hairline-soft bg-canvas p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{s.display_name}</p>
                  <p className="truncate font-mono text-xs text-steel">{s.email ?? "—"}</p>
                </div>
                <Badge variant={isManagerRow || role === "owner" ? "orange" : "cream"}>
                  {ROLE_LABEL[role] ?? role}
                </Badge>
              </div>

              <p className="mt-xs text-xs">
                {s.active ? (
                  <span className="text-status-ready">Đang bật</span>
                ) : (
                  <span className="text-steel">Đã tắt</span>
                )}
              </p>

              {editable ? (
                <div className="mt-sm flex flex-col gap-sm border-t border-hairline-soft pt-sm">
                  <ResetSecretForm
                    slug={slug}
                    id={s.id}
                    name={s.display_name}
                    isManager={isManagerRow}
                    stacked
                  />
                  <RowActions slug={slug} id={s.id} name={s.display_name} active={s.active} />
                </div>
              ) : (
                <p className="mt-sm border-t border-hairline-soft pt-sm text-xs text-stone">
                  Không thao tác được
                </p>
              )}
            </div>
          );
        })}
        {(staff ?? []).length === 0 && (
          <p className="rounded-lg border border-hairline-soft bg-canvas px-md py-lg text-center text-sm text-steel sm:col-span-2">
            Chưa có nhân viên. Thêm ở form phía trên.
          </p>
        )}
      </div>

      <div className="mt-lg hidden overflow-x-auto rounded-lg border border-hairline-soft xl:block">
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
                      <ResetSecretForm
                        slug={slug}
                        id={s.id}
                        name={s.display_name}
                        isManager={isManagerRow}
                      />
                    ) : (
                      <span className="text-xs text-stone">—</span>
                    )}
                  </td>
                  <td className="px-md py-sm">
                    {editable ? (
                      <RowActions slug={slug} id={s.id} name={s.display_name} active={s.active} />
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

/**
 * Ô đặt lại bí mật. Dùng chung cho thẻ mobile và ô bảng desktop để hai bề mặt không lệch nhau
 * (đúng field `secret`, đúng ràng buộc PIN 4 số vs mật khẩu ≥8 ký tự).
 * `stacked`: xếp dọc + ô nhập full-width cho thẻ mobile; bảng desktop giữ nguyên hàng ngang.
 */
function ResetSecretForm({
  slug,
  id,
  name,
  isManager,
  stacked,
}: {
  slug: string;
  id: string;
  name: string;
  isManager: boolean;
  stacked?: boolean;
}) {
  const inputCls = stacked
    ? "h-11 min-w-0 flex-1"
    : isManager
      ? "h-9 w-40"
      : "h-9 w-24";

  return (
    <form action={resetPin} className="flex items-center gap-xs">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      {isManager ? (
        <Input
          name="secret"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="Mật khẩu mới"
          className={inputCls}
          aria-label={`Mật khẩu mới cho ${name}`}
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
          className={inputCls}
          aria-label={`PIN mới cho ${name}`}
        />
      )}
      <Button type="submit" variant="secondary" size={stacked ? "md" : "sm"} className="shrink-0">
        Lưu
      </Button>
    </form>
  );
}

/** Bật/tắt + xóa một thành viên. Dùng chung cho thẻ mobile và ô bảng desktop. */
function RowActions({
  slug,
  id,
  name,
  active,
}: {
  slug: string;
  id: string;
  name: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-xs">
      <form action={setStaffActive}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <Button type="submit" variant="link" size="sm">
          {active ? "Tắt" : "Bật"}
        </Button>
      </form>
      <form action={deleteStaff}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmit
          message={`Xóa "${name}"? Thao tác không hoàn tác được.`}
          className="inline-flex h-9 items-center rounded-md px-sm text-sm text-status-late hover:bg-surface"
        >
          Xóa
        </ConfirmSubmit>
      </form>
    </div>
  );
}
