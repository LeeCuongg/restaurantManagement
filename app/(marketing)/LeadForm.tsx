"use client";

import { useActionState, useId, type InputHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitLead, type LeadFormState } from "./actions";

/**
 * Form "để lại liên hệ" (MKT-02). Hai dáng:
 *  - compact: dùng ở hero, chỉ tên + SĐT, xếp ngang ở màn rộng.
 *  - full: dùng ở cuối trang, thêm ô ghi chú.
 * Chỉ thu tên + SĐT + ghi chú — không hỏi gì thêm (nguyên tắc PII tối thiểu).
 */
export function LeadForm({ variant = "full", id }: { variant?: "compact" | "full"; id?: string }) {
  const [state, action] = useActionState<LeadFormState, FormData>(submitLead, { status: "idle" });
  const compact = variant === "compact";

  if (state.status === "done") {
    return (
      <div
        id={id}
        role="status"
        className="flex items-start gap-sm rounded-lg border border-status-ready bg-canvas p-lg"
      >
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-status-ready" />
        <div>
          <p className="font-medium text-ink">Đã nhận thông tin của anh/chị.</p>
          <p className="mt-xxs text-sm text-steel">
            Mình sẽ gọi lại trong giờ hành chính để tư vấn và mở bản dùng thử.
          </p>
        </div>
      </div>
    );
  }

  const err = state.status === "error" ? state : null;

  return (
    <form id={id} action={action} className={cn("w-full", compact ? "max-w-xl" : "max-w-2xl")} noValidate>
      <div className={cn("gap-sm", compact ? "flex flex-col sm:flex-row" : "grid grid-cols-1 sm:grid-cols-2")}>
        <Field
          label="Tên anh/chị"
          name="name"
          placeholder="Nguyễn Văn A"
          autoComplete="name"
          maxLength={40}
          invalid={err?.field === "name"}
          className={compact ? "sm:flex-1" : undefined}
        />
        <Field
          label="Số điện thoại"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="0912 345 678"
          autoComplete="tel"
          maxLength={15}
          invalid={err?.field === "phone"}
          className={compact ? "sm:flex-1" : undefined}
        />
      </div>

      {!compact && (
        <Field
          label="Nhà hàng của anh/chị (không bắt buộc)"
          name="note"
          placeholder="Ví dụ: quán phở 30 chỗ, 2 chi nhánh"
          maxLength={300}
          className="mt-sm"
        />
      )}

      <div className={cn("flex flex-wrap items-center gap-md", compact ? "mt-md" : "mt-lg")}>
        <SubmitButton />
        <p className="text-xs text-steel">Mình chỉ dùng số này để liên hệ tư vấn.</p>
      </div>

      {err && (
        <p role="alert" className="mt-sm text-sm text-status-late">
          {err.message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  invalid,
  className,
  ...rest
}: {
  label: string;
  name: string;
  invalid?: boolean;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = `lead-${name}-${useId()}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-xxs block text-xs font-medium text-steel">
        {label}
      </label>
      <Input
        id={id}
        name={name}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-status-late focus-visible:border-status-late" : undefined}
        {...rest}
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Đang gửi…" : "Nhận tư vấn"}
    </Button>
  );
}
