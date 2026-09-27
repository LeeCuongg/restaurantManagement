"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { taoMaKichHoat, type MaKichHoatState } from "@/app/r/[slug]/admin/(protected)/printers/actions";
import { gioVn } from "@/lib/time/vn";

/**
 * Nút "Tạo mã kích hoạt" (PRINT-17) — chủ quán tự lấy mã gõ vào CAI-DAT.bat, không phải xin quản trị hệ
 * thống. Mã chỉ hiện một lần (server chỉ lưu bản băm); đóng trang thì tạo mã mới.
 */
export function MaKichHoatCauIn({ slug, laChuQuan }: { slug: string; laChuQuan: boolean }) {
  const [kq, setKq] = useState<MaKichHoatState>(null);
  const [dangTao, startTransition] = useTransition();

  if (!laChuQuan) {
    return <p className="text-sm text-slate">Chỉ chủ quán tạo được mã kích hoạt — nhờ chủ quán đăng nhập.</p>;
  }

  const tao = () => startTransition(async () => setKq(await taoMaKichHoat(slug)));

  return (
    <div className="flex flex-col gap-sm">
      <p className="text-sm text-slate">
        <span className="font-medium text-ink">Lưu ý:</span> cài bằng mã mới thì cầu in đang chạy ở máy khác (nếu có)
        <span className="font-medium text-ink"> ngừng in ngay</span>. Chỉ tạo mã khi lắp mới hoặc thay laptop quầy.
      </p>
      <div className="flex flex-wrap items-center gap-md">
        <Button type="button" variant="secondary" onClick={tao} disabled={dangTao}>
          {dangTao ? "Đang tạo…" : kq && "code" in kq ? "Tạo mã khác" : "Tạo mã kích hoạt"}
        </Button>
        {kq && "code" in kq && (
          <div role="status" aria-label="Mã kích hoạt" className="flex flex-col">
            <span className="font-mono text-2xl font-semibold tracking-widest text-ink">
              {kq.code.slice(0, 4)}-{kq.code.slice(4)}
            </span>
            <span className="text-sm text-steel">Dùng một lần · hết hạn lúc {gioVn(kq.expiresAt)}</span>
          </div>
        )}
        {kq && "error" in kq && (
          <p role="alert" className="text-sm text-status-late">
            {kq.error}
          </p>
        )}
      </div>
    </div>
  );
}
