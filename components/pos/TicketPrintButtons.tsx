"use client";

import { useEffect, useState } from "react";
import { Printer, Receipt } from "lucide-react";
import { getPrintAdapter } from "@/lib/print/adapter";

/**
 * Cặp nút in "Phiếu bếp" + "Phiếu khách" dùng chung cho OrderPanel (bàn) và TakeawayPanel (quầy).
 * Sau khi in PHIẾU KHÁCH → hiện hộp NHẮC in tiếp phiếu bếp (chủ quán: lễ tân in tất, dễ quên phiếu
 * bếp). Trình duyệt không tự chọn máy in — khi in phiếu bếp, nhân viên chọn máy in bếp ở hộp thoại.
 * Render fragment 2 nút (không bọc div) để rơi thẳng vào flex container sẵn có của mỗi panel.
 */
const BTN =
  "inline-flex h-8 items-center gap-xxs rounded-md border border-hairline-strong px-sm text-xs font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function TicketPrintButtons({
  slug,
  orderId,
  kitchenLabel,
}: {
  slug: string;
  orderId: string;
  /** Nhãn đơn hiển thị trong hộp nhắc, vd "#12". Bỏ trống thì không hiện số. */
  kitchenLabel?: string;
}) {
  const [remind, setRemind] = useState(false);

  const printKitchen = () => getPrintAdapter().printKitchenTicket({ slug, orderId });
  const printCustomer = () => {
    getPrintAdapter().printCustomerTicket({ slug, orderId });
    setRemind(true); // nhắc in phiếu bếp ngay sau khi in phiếu khách
  };

  useEffect(() => {
    if (!remind) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRemind(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [remind]);

  return (
    <>
      <button type="button" onClick={printKitchen} className={BTN}>
        <Printer className="h-3.5 w-3.5" /> Phiếu bếp
      </button>
      <button type="button" onClick={printCustomer} className={BTN}>
        <Receipt className="h-3.5 w-3.5" /> Phiếu khách
      </button>

      {remind && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-remind-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-lg"
          onClick={() => setRemind(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-hairline-soft bg-canvas p-lg shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="print-remind-title" className="font-display text-lg text-ink">
              In phiếu bếp?
            </h3>
            <p className="mt-xs text-sm text-slate">
              Đã gửi lệnh in phiếu khách{kitchenLabel ? ` cho đơn ${kitchenLabel}` : ""}. In tiếp phiếu
              bếp để chuyển món xuống bếp?
            </p>
            <div className="mt-lg flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => setRemind(false)}
                className="inline-flex h-11 items-center rounded-md border border-hairline-strong bg-canvas px-lg text-sm font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  printKitchen();
                  setRemind(false);
                }}
                className="inline-flex h-11 items-center gap-sm rounded-md bg-primary px-lg text-sm font-medium text-primary-fg hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Printer className="h-4 w-4" /> In phiếu bếp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
