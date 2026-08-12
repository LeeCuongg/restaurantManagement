/**
 * Khách quan tâm để lại liên hệ ở trang giới thiệu (MKT-02/03).
 *
 * Bảng `leads` bật RLS mà KHÔNG có policy nào (xem 0024_leads.sql) ⇒ mọi truy cập bắt buộc
 * đi qua service role ở đây. Vì thế file này "server-only": lỡ import vào client component
 * là build gãy ngay thay vì rò service key ra trình duyệt.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLeadInput, type LeadField } from "./lead-input";

export type { LeadField } from "./lead-input";

/** Bấm gửi nhiều lần / mạng chậm gửi lại → chỉ ghi 1 bản ghi trong cửa sổ này. */
const DEDUPE_WINDOW_MS = 60_000;

export type LeadStatus = "new" | "contacted" | "closed";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  status: LeadStatus;
  createdAt: string;
  contactedAt: string | null;
};

export type LeadResult = { ok: true } | { ok: false; field: LeadField; message: string };

/**
 * Ghi liên hệ mới. Trả lỗi kèm TÊN Ô để form tô đúng chỗ sai thay vì báo chung chung.
 * SĐT được chuẩn hóa (+84 → 0) trước khi lưu nên `leads.phone` luôn cùng một dạng.
 */
export async function createLead(input: { name: string; phone: string; note?: string }): Promise<LeadResult> {
  const checked = normalizeLeadInput(input);
  if (!checked.ok) return checked;
  const { name, phone, note } = checked.value;

  const admin = createAdminClient();

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const { data: recent, error: dupErr } = await admin
    .from("leads")
    .select("id")
    .eq("phone", phone)
    .gte("created_at", since)
    .limit(1);
  if (dupErr) return { ok: false, field: "form", message: "Hệ thống đang bận, anh/chị thử lại giúp mình." };
  // Đã có bản ghi vừa xong: coi như thành công, không tạo rác.
  if ((recent ?? []).length > 0) return { ok: true };

  const { error } = await admin.from("leads").insert({ name, phone, note, source: "landing" });
  if (error) return { ok: false, field: "form", message: "Chưa gửi được, anh/chị thử lại giúp mình." };

  return { ok: true };
}

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  status: string;
  created_at: string;
  contacted_at: string | null;
};

/** Danh sách cho /super/leads — mới nhất trước. Người gọi phải tự kiểm quyền super-admin. */
export async function listLeads(limit = 200): Promise<Lead[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select("id, name, phone, note, status, created_at, contacted_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Không đọc được danh sách khách quan tâm — ${error.message}`);

  return ((data ?? []) as LeadRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    note: r.note,
    status: r.status as LeadStatus,
    createdAt: r.created_at,
    contactedAt: r.contacted_at,
  }));
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("leads")
    .update({ status, contacted_at: status === "new" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Không cập nhật được trạng thái — ${error.message}`);
}
