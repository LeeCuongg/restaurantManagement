"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionMembership } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/rbac";
import { buildKitchenTicket } from "@/lib/print/kitchen-ticket";
import type { KitchenPrintState } from "@/lib/print/adapter";

/** Ghi 1 dòng print_jobs (type=kitchen_ticket) sau khi guard membership POS/KDS. */
async function insertKitchenPrintJob(
  slug: string,
  orderId: string,
  status: "printed" | "pending"
): Promise<{ ok: boolean }> {
  const session = await getSessionMembership(slug);
  if (!session) return { ok: false };
  if (!canAccess(session.role, "pos") && !canAccess(session.role, "kds")) return { ok: false };

  const ticket = await buildKitchenTicket(orderId, session.tenant.id);
  if (!ticket) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from("print_jobs").insert({
    tenant_id: session.tenant.id,
    type: "kitchen_ticket",
    target_station: "kitchen",
    payload: ticket,
    status,
    printed_at: status === "printed" ? new Date().toISOString() : null,
  });
  return { ok: !error };
}

/**
 * Ghi log 1 lần in phiếu bếp vào print_jobs (type=kitchen_ticket, status=printed).
 * Gọi từ route in khi trang mở (client → action). Guard membership POS/KDS.
 */
export async function logKitchenTicketPrint(
  slug: string,
  orderId: string
): Promise<{ ok: boolean }> {
  return insertKitchenPrintJob(slug, orderId, "printed");
}

/**
 * Xếp hàng đợi cho cầu in ESC/POS (BridgePrintAdapter, V1.x): status=pending, cầu in cục bộ
 * (scripts/print-bridge.mjs) poll và in ra máy in bếp LAN rồi đổi thành printed/failed.
 */
export async function queueKitchenTicketPrint(
  slug: string,
  orderId: string
): Promise<{ ok: boolean }> {
  return insertKitchenPrintJob(slug, orderId, "pending");
}

/**
 * Trạng thái lần in phiếu bếp GẦN NHẤT của đơn — POS hiện thường trực cạnh nút in để nhân viên
 * biết bếp đã nhận phiếu chưa (máy in bếp ở xa, không nhìn thấy giấy ra).
 */
export async function getKitchenPrintStatus(
  slug: string,
  orderId: string
): Promise<KitchenPrintState> {
  const none: KitchenPrintState = { status: "none", at: null };
  const session = await getSessionMembership(slug);
  if (!session) return none;
  if (!canAccess(session.role, "pos") && !canAccess(session.role, "kds")) return none;

  const supabase = await createClient();
  const { data } = await supabase
    .from("print_jobs")
    .select("status, created_at, printed_at")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "kitchen_ticket")
    .contains("payload", { orderId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return none;
  return {
    status: data.status as KitchenPrintState["status"],
    at: (data.printed_at as string | null) ?? (data.created_at as string),
  };
}
