/**
 * Chuẩn hóa + kiểm tra thông tin khách để lại ở trang giới thiệu (MKT-02).
 * THUẦN HÀM, tách khỏi `leads.ts` (server-only) để unit test được bằng vitest.
 *
 * Dùng lại regex SĐT của `guest-contact.ts` — một nguồn sự thật cho định dạng số Việt Nam.
 */
import { normalizePhone, isValidPhone, isValidName, NAME_MAX } from "@/lib/orders/guest-contact";

export const NOTE_MAX = 300;

export type LeadField = "name" | "phone" | "form";
export type NormalizedLead = { name: string; phone: string; note: string | null };

export type LeadValidation =
  | { ok: true; value: NormalizedLead }
  | { ok: false; field: LeadField; message: string };

/** Cắt độ dài, đổi +84 → 0, và báo lỗi kèm TÊN Ô để form tô đúng chỗ sai. */
export function normalizeLeadInput(input: { name: string; phone: string; note?: string }): LeadValidation {
  const name = input.name.trim().slice(0, NAME_MAX);
  const phone = normalizePhone(input.phone);
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX) || null;

  if (!isValidName(name)) {
    return { ok: false, field: "name", message: "Cho mình xin tên anh/chị (ít nhất 2 ký tự)." };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, field: "phone", message: "Số điện thoại chưa đúng — ví dụ 0912345678." };
  }
  return { ok: true, value: { name, phone, note } };
}
