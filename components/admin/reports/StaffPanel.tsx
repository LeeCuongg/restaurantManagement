"use client";

import { useState } from "react";
import type { DongNhanVien } from "@/lib/reports/deep";
import { formatVnd } from "@/lib/orders/cart";
import { cn } from "@/lib/utils";

/**
 * Báo cáo theo nhân viên (P16 16-02, REPORT-16) — hai thẻ như Sapo FnB: "Theo phục vụ" (người nhận đơn) và "Theo thu
 * ngân" (người thu tiền, theo phương thức). Kèm món đã hủy và giảm giá đã duyệt của từng người.
 */
export function StaffPanel({ rows }: { rows: DongNhanVien[] }) {
  const [the, setThe] = useState<"phuc-vu" | "thu-ngan">("phuc-vu");
  const phucVu = rows.filter((r) => r.donNhan > 0 || r.monHuy > 0).sort((a, b) => b.tienHangNhan - a.tienHangNhan);
  const thuNgan = rows.filter((r) => r.hoaDonThu > 0 || r.lanGiam > 0).sort((a, b) => b.tienThu - a.tienThu);
  const ten = (r: DongNhanVien) => (
    <span className={cn(r.kind !== "staff" && "italic text-steel")}>
      {r.ten}
      {r.kind === "staff" && !r.dangLam && <span className="ml-xxs text-xs text-steel">(đã nghỉ)</span>}
    </span>
  );
  if (rows.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;
  const THE: ["phuc-vu" | "thu-ngan", string][] = [
    ["phuc-vu", "Theo phục vụ (nhận đơn)"],
    ["thu-ngan", "Theo thu ngân (thu tiền)"],
  ];
  return (
    <div data-khoi-nhan-vien>
      <div role="tablist" className="mb-md flex flex-wrap gap-xs text-sm">
        {THE.map(([k, nhan]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={the === k}
            onClick={() => setThe(k)}
            className={cn(
              "rounded-full border px-sm py-[2px]",
              the === k ? "border-ink bg-ink text-canvas" : "border-hairline-strong text-slate"
            )}
          >
            {nhan}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {the === "phuc-vu" ? (
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-xs pr-md font-medium">Nhân viên</th>
                <th className="py-xs pr-md text-right font-medium">Đơn nhận</th>
                <th className="py-xs pr-md text-right font-medium">Số món</th>
                <th className="py-xs pr-md text-right font-medium">Tiền hàng</th>
                <th className="py-xs text-right font-medium">Món hủy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {phucVu.map((r, i) => (
                <tr key={`${r.kind}-${r.membershipId ?? i}`}>
                  <td className="py-xs pr-md text-ink">{ten(r)}</td>
                  <td className="py-xs pr-md text-right tabular-nums">{r.donNhan}</td>
                  <td className="py-xs pr-md text-right tabular-nums">{r.monNhan}</td>
                  <td className="py-xs pr-md text-right tabular-nums text-ink">{formatVnd(r.tienHangNhan)}</td>
                  <td className="py-xs text-right tabular-nums text-slate">
                    {r.monHuy ? `${r.monHuy} · ${formatVnd(r.tienHuy)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-xs pr-md font-medium">Nhân viên</th>
                <th className="py-xs pr-md text-right font-medium">Hóa đơn</th>
                <th className="py-xs pr-md text-right font-medium">Tiền mặt</th>
                <th className="py-xs pr-md text-right font-medium">Chuyển khoản</th>
                <th className="py-xs pr-md text-right font-medium">Tổng thu</th>
                <th className="py-xs text-right font-medium">Giảm giá đã duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {thuNgan.map((r, i) => (
                <tr key={`${r.kind}-${r.membershipId ?? i}`}>
                  <td className="py-xs pr-md text-ink">{ten(r)}</td>
                  <td className="py-xs pr-md text-right tabular-nums">{r.hoaDonThu}</td>
                  <td className="py-xs pr-md text-right tabular-nums">{formatVnd(r.tienMat)}</td>
                  <td className="py-xs pr-md text-right tabular-nums">{formatVnd(r.chuyenKhoan)}</td>
                  <td className="py-xs pr-md text-right tabular-nums text-ink">{formatVnd(r.tienThu)}</td>
                  <td className="py-xs text-right tabular-nums text-slate">
                    {r.lanGiam ? `${r.lanGiam} lần · ${formatVnd(r.tienGiam)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-sm text-xs text-steel">
        Số liệu theo tài khoản đăng nhập của nhân viên — trước khi mỗi người có tài khoản riêng, đơn dồn vào tài khoản dùng chung.
      </p>
    </div>
  );
}
