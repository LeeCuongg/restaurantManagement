"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Bell, Check, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CallStaffSheet (CALL-01) — khách gọi nhân viên kèm yêu cầu (không bắt buộc). Chip gợi ý nhanh
 * điền sẵn nội dung hay gặp; ô text cho yêu cầu khác. Gửi → POST /api/call { qrToken, note }.
 *
 * mode="payment" (CALL-02): cùng đường ống staff_calls nhưng note luôn mở đầu "Thanh toán" +
 * hình thức khách chọn → POS thấy ngay trong danh sách gọi, không cần loại call riêng.
 */
const QUICK = ["Thêm bát/đũa", "Khăn giấy", "Cần hỗ trợ"];
const PAY_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ"];

const COPY = {
  staff: {
    title: "Gọi nhân viên",
    hint: "Chọn nhanh hoặc ghi yêu cầu (không bắt buộc).",
    placeholder: "Yêu cầu khác…",
    submit: "Gửi yêu cầu",
    doneTitle: "Đã gửi yêu cầu",
    doneHint: "Nhân viên sẽ tới bàn ngay.",
  },
  payment: {
    title: "Gọi thanh toán",
    hint: "Chọn hình thức thanh toán (không bắt buộc).",
    placeholder: "Ghi chú cho nhân viên…",
    submit: "Gọi thanh toán",
    doneTitle: "Đã gọi thanh toán",
    doneHint: "Nhân viên sẽ mang hóa đơn tới bàn.",
  },
} as const;

export function CallStaffSheet({
  slug,
  qrToken,
  open,
  onOpenChange,
  mode = "staff",
}: {
  slug: string;
  qrToken: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode?: "staff" | "payment";
}) {
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const copy = COPY[mode];
  const chips = mode === "payment" ? PAY_METHODS : QUICK;

  // Đổi mục đích sheet (gọi NV ↔ thanh toán) → không mang theo lựa chọn cũ.
  useEffect(() => {
    setPick("");
    setNote("");
  }, [mode]);

  /** Nội dung gửi POS: payment luôn có tiền tố "Thanh toán" để phân biệt trong danh sách gọi. */
  const buildNote = () => {
    const parts = mode === "payment" ? ["Thanh toán", pick, note.trim()] : [pick, note.trim()];
    return parts.filter(Boolean).join(" · ");
  };

  const send = async () => {
    if (state !== "idle") return;
    setState("sending");
    try {
      const res = await fetch(`/r/${slug}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, note: buildNote() }),
      });
      if (res.ok) {
        setState("done");
        setTimeout(() => {
          onOpenChange(false);
          setState("idle");
          setPick("");
          setNote("");
        }, 1600);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  };

  return (
    // repositionInputs={false}: xem chú thích ở CartSheet — vaul chỉnh height/bottom sai trên
    // iOS Safari làm sheet trôi lên khi bàn phím mở.
    <Drawer.Root
      open={open}
      onOpenChange={(v) => state !== "sending" && onOpenChange(v)}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-md flex-col rounded-t-xl bg-canvas shadow-modal outline-none">
          <div className="mx-auto mt-sm h-1.5 w-10 shrink-0 rounded-full bg-hairline-strong" />
          <Drawer.Title className="shrink-0 px-lg pt-sm font-display text-xl text-ink">
            {copy.title}
          </Drawer.Title>

          <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
            {state === "done" ? (
              <div className="flex flex-col items-center gap-sm py-xl text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-status-ready-bg text-status-ready">
                  <Check className="h-7 w-7" />
                </span>
                <p className="text-base font-medium text-ink">{copy.doneTitle}</p>
                <p className="text-sm text-steel">{copy.doneHint}</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-steel">{copy.hint}</p>
                <div className="mt-sm flex flex-wrap gap-xs">
                  {chips.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setPick((prev) => (prev === q ? "" : q))}
                      aria-pressed={pick === q}
                      className={cn(
                        "inline-flex min-h-[40px] items-center rounded-full border px-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        pick === q
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-hairline-strong bg-canvas text-ink hover:bg-surface"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={160}
                  rows={2}
                  placeholder={copy.placeholder}
                  className="mt-md w-full resize-none rounded-md border border-hairline px-md py-sm text-base text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm"
                />
              </>
            )}
          </div>

          {state !== "done" && (
            <div className="shrink-0 border-t border-hairline-soft bg-canvas px-lg py-md pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={send}
                disabled={state === "sending"}
                className="flex h-12 w-full items-center justify-center gap-sm rounded-md bg-primary text-base font-medium text-primary-fg transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-70"
              >
                {state === "sending" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : mode === "payment" ? (
                  <Wallet className="h-5 w-5" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                {state === "sending" ? "Đang gửi…" : copy.submit}
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
