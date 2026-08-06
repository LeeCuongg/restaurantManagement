import { redirect } from "next/navigation";
import { getSessionMembership } from "@/lib/auth/session";
import { canAccess, defaultRouteForRole } from "@/lib/auth/rbac";
import { getKdsTickets } from "@/lib/orders/kds";
import { getCustomerMenu } from "@/lib/orders/customer-menu";
import { StationScreen } from "@/components/staff/StationScreen";
import { KdsBoard } from "@/components/kds/KdsBoard";

export const dynamic = "force-dynamic";

/**
 * Màn hình bếp KDS (03-03). StationScreen lo login trạm + chọn nhân viên (kitchen); khi đã chọn
 * → KdsBoard (3 cột realtime) với vé initial. Owner/manager thao tác như chính họ.
 */
export default async function KdsHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSessionMembership(slug);
  if (!session) redirect(`/r/${slug}/kds/login`);
  if (!canAccess(session.role, "kds")) redirect(defaultRouteForRole(slug, session.role));

  // `menu` cho drawer "Báo hết món" (MENU-04) — getCustomerMenu trả CẢ món đang hết.
  const [tickets, menu] = await Promise.all([
    getKdsTickets(session.tenant.id),
    getCustomerMenu(slug),
  ]);

  return (
    <StationScreen slug={slug} surface="kds" fill>
      <KdsBoard slug={slug} tenantId={session.tenant.id} initial={tickets} menu={menu} />
    </StationScreen>
  );
}
