"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, UserRound, X } from "lucide-react";
import {
  NAME_MAX,
  PHONE_MAX,
  isValidName,
  isValidPhone,
  normalizePhone,
  type GuestContact,
} from "@/lib/orders/guest-contact";

/**
 * GuestInfoModal — modal GIỮA màn hình thu tên (bắt buộc) + SĐT (tùy chọn). Nền phía sau bị
 * che hẳn (lớp mờ đậm + blur) để khách tập trung vào việc điền.
 *
 * Hai chế độ:
 * - "required": mở ngay khi khách quét QR vào bàn và chưa có tên. KHÔNG đóng được (không X,
 *   không Esc, không bấm nền) — phải điền mới dùng tiếp được.
 * - "edit": mở từ nút bút chì trên thẻ nhận diện, đóng/hủy được bình thường.
 */
export function GuestInfoModal({
  open,
  mode,
  initial,
  tableName,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  mode: "required" | "edit";
  initial: GuestContact;
  tableName: string | null;
  onSubmit: (c: GuestContact) => void;
  /** Chỉ dùng ở mode "edit" — mode "required" không cho đóng. */
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [touched, setTouched] = useState(false);

  // Mỗi lần mở lại → lấy giá trị đang lưu làm điểm bắt đầu.
  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setPhone(initial.phone);
    setTouched(false);
  }, [open, initial.name, initial.phone]);

  const nameOk = isValidName(name);
  // SĐT không bắt buộc; chỉ chặn khi khách có nhập mà nhập sai.
  const phoneOk = phone.trim() === "" || isValidPhone(phone);
  const ready = nameOk && phoneOk;
  const required = mode === "required";

  const submit = () => {
    if (!ready) {
      setTouched(true);
      return;
    }
    onSubmit({
      name: name.trim().slice(0, NAME_MAX),
      phone: phone.trim() === "" ? "" : normalizePhone(phone),
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && !required) onCancel();
      }}
    >
      <Dialog.Portal>
        {/* Che hẳn nền phía sau: lớp mực đậm + blur */}
        {/* z-60/70: phải nổi TRÊN bottom sheet (giỏ hàng dùng z-40/50) vì mở được từ trong giỏ */}
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/75 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          onEscapeKeyDown={(e) => required && e.preventDefault()}
          onPointerDownOutside={(e) => required && e.preventDefault()}
          onInteractOutside={(e) => required && e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[90vh] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-canvas shadow-modal outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          {!required && (
            <Dialog.Close
              aria-label="Đóng"
              className="absolute right-sm top-sm grid h-9 w-9 place-items-center rounded-full text-steel hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          )}

          <div className="shrink-0 px-lg pt-lg">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </span>
            <Dialog.Title className="mt-sm font-display text-2xl leading-tight text-ink">
              {required ? "Cho chúng tôi biết bạn nhé" : "Thông tin của bạn"}
            </Dialog.Title>
            <Dialog.Description className="mt-xxs text-sm text-steel">
              {required
                ? `Nhập tên để nhân viên phục vụ đúng${tableName ? ` bàn ${tableName}` : ""}.`
                : "Cập nhật tên và số điện thoại dùng cho các đơn tại bàn này."}
            </Dialog.Description>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
            <label htmlFor="guest-name" className="block text-sm font-medium text-ink">
              Tên của bạn <span className="text-primary">*</span>
            </label>
            <input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("guest-phone")?.focus()}
              maxLength={NAME_MAX}
              autoComplete="name"
              aria-invalid={touched && !nameOk}
              aria-describedby={touched && !nameOk ? "guest-name-err" : undefined}
              placeholder="VD: Anh Nam"
              className="mt-xs h-12 w-full rounded-md border border-hairline px-md text-base text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-status-late"
            />
            {touched && !nameOk && (
              <p id="guest-name-err" className="mt-xxs text-xs text-status-late">
                Vui lòng nhập tên (ít nhất 2 ký tự).
              </p>
            )}

            <label htmlFor="guest-phone" className="mt-md block text-sm font-medium text-ink">
              Số điện thoại
            </label>
            <input
              id="guest-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={PHONE_MAX}
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={touched && !phoneOk}
              aria-describedby={touched && !phoneOk ? "guest-phone-err" : undefined}
              placeholder="VD: 0901 234 567"
              className="mt-xs h-12 w-full rounded-md border border-hairline px-md text-base tabular-nums text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-status-late"
            />
            {touched && !phoneOk && (
              <p id="guest-phone-err" className="mt-xxs text-xs text-status-late">
                Số điện thoại không hợp lệ (VD: 0901234567).
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-hairline-soft bg-canvas px-lg py-md">
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className="flex h-12 w-full items-center justify-center gap-sm rounded-md bg-primary text-base font-medium text-primary-fg transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-hairline disabled:text-muted"
            >
              {required ? "Bắt đầu" : "Lưu"}
              {required ? <ArrowRight className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
