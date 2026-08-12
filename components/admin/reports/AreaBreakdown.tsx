import type { AreaSlice } from "@/lib/billing/reports";
import { formatVnd } from "@/lib/orders/cart";
import { BarRow } from "./BarRow";
import { formatShare } from "@/lib/billing/report-format";

/**
 * Doanh thu theo khu vực, kèm 3 bàn mạnh nhất trong khu (REPORT-08).
 * `report_by_area` trả từng (khu vực × bàn) — gộp lại ở đây để khỏi thêm 1 RPC nữa.
 */
export function AreaBreakdown({ areas }: { areas: AreaSlice[] }) {
  if (areas.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  const total = areas.reduce((s, a) => s + a.revenue, 0);
  const grouped = new Map<string, { revenue: number; billCount: number; tables: AreaSlice[] }>();
  for (const a of areas) {
    const g = grouped.get(a.areaName) ?? { revenue: 0, billCount: 0, tables: [] };
    g.revenue += a.revenue;
    g.billCount += a.billCount;
    if (a.tableName !== "—") g.tables.push(a);
    grouped.set(a.areaName, g);
  }

  const rows = [...grouped.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <ul className="flex flex-col gap-sm">
      {rows.map(([areaName, g]) => {
        const top = g.tables
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
          .map((t) => `${t.tableName} ${formatVnd(t.revenue)}`)
          .join(" · ");
        return (
          <BarRow
            key={areaName}
            label={areaName}
            value={`${formatVnd(g.revenue)} · ${formatShare(g.revenue, total)}`}
            pct={total > 0 ? (g.revenue / total) * 100 : 0}
            sub={top || `${g.billCount} hóa đơn`}
          />
        );
      })}
    </ul>
  );
}
