"use server";

import { createLead, type LeadField } from "@/lib/marketing/leads";

export type LeadFormState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; field: LeadField; message: string };

/** Server action cho form "để lại liên hệ" (MKT-02). Dùng với `useActionState`. */
export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const result = await createLead({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  if (result.ok) return { status: "done" };
  return { status: "error", field: result.field, message: result.message };
}
