import type { CategorySlice } from "@/lib/billing/reports";
import { formatVnd } from "@/lib/orders/cart";
import { BarRow } from "./BarRow";

/** Cơ cấu doanh thu theo nhóm món (REPORT-08). Σ các nhóm = tổng doanh thu. */
export function CategoryBreakdown({ categories }: { categories: CategorySlice[] }) {
  if (categories.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  const total = categories.reduce((s, c) => s + c.revenue, 0);

  return (
    <ul className="flex flex-col gap-sm">
      {categories.map((c) => {
        const pct = total > 0 ? Math.round((c.revenue / total) * 100) : 0;
        return (
          <BarRow
            key={c.name}
            label={c.name}
            value={`${formatVnd(c.revenue)} · ${pct}%`}
            pct={total > 0 ? (c.revenue / total) * 100 : 0}
            sub={`${c.qty} phần`}
          />
        );
      })}
    </ul>
  );
}
