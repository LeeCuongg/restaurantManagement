"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { cheDoKhaiMayIn, datThietBiCoMayIn, thietBiCoMayIn, type CheDoKhaiMayIn } from "@/lib/print/device";
import { cn } from "@/lib/utils";

/**
 * "Thiết bị này" (PRINT-16) — khai cho CHÍNH máy đang mở trang: có nối máy in không. Quyết định đường in hóa
 * đơn của máy này: có → in thẳng (trình duyệt); không → gửi ra máy in quầy qua cầu in. Mặc định đoán theo
 * khổ màn hình (≥ 1024 px = có) — tablet NGANG không nối máy in thì phải khai "Không".
 *
 * Lưu trên trình duyệt của máy (localStorage), nên phải mở trang này trên đúng máy cần khai.
 */
const LUA_CHON: { id: CheDoKhaiMayIn; nhan: string; moTa: string }[] = [
  { id: "tu-dong", nhan: "Tự động", moTa: "Theo khổ màn hình: máy tính / màn ngang lớn coi là có máy in" },
  { id: "co", nhan: "Có máy in", moTa: "In hóa đơn thẳng ra máy in cắm vào máy này" },
  { id: "khong", nhan: "Không có máy in", moTa: "Gửi hóa đơn ra máy in quầy (cần cầu in ở quầy)" },
];

export function ThietBiNayCard() {
  const [cheDo, setCheDo] = useState<CheDoKhaiMayIn | null>(null);
  const [coMayIn, setCoMayIn] = useState<boolean | null>(null);

  const doc = () => {
    setCheDo(cheDoKhaiMayIn());
    setCoMayIn(thietBiCoMayIn());
  };
  useEffect(doc, []);

  const chon = (id: CheDoKhaiMayIn) => {
    datThietBiCoMayIn(id === "tu-dong" ? null : id === "co");
    doc();
  };

  return (
    <Card className="mt-lg">
      <CardTitle>Thiết bị này</CardTitle>
      <p className="mt-xxs text-sm text-steel">
        Khai cho chính máy đang mở trang này. Hiện:{" "}
        <span className="font-medium text-ink">
          {coMayIn === null ? "…" : coMayIn ? "in thẳng ra máy in của máy này" : "gửi hóa đơn ra máy in quầy"}
        </span>
        .
      </p>
      <div role="radiogroup" aria-label="Máy này có nối máy in không" className="mt-md grid gap-sm sm:grid-cols-3">
        {LUA_CHON.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={cheDo === l.id}
            onClick={() => chon(l.id)}
            className={cn(
              "flex min-h-[44px] flex-col items-start rounded-md border px-md py-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              cheDo === l.id ? "border-primary bg-cream text-ink" : "border-hairline-strong bg-canvas text-slate hover:bg-surface"
            )}
          >
            <span className="font-medium">{l.nhan}</span>
            <span className="text-xs text-steel">{l.moTa}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
