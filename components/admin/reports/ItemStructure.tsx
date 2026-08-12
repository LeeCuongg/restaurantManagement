import type { TopItem } from "@/lib/billing/reports";
import { formatVnd } from "@/lib/orders/cart";
import { BarRow } from "./BarRow";

/** Số món hiện chi tiết; phần còn lại gộp vào "Món khác" để tổng vẫn đủ 100%. */
const SHOWN = 20;

/**
 * Cơ cấu doanh thu theo từng món (REPORT-02). Xếp theo TIỀN chứ không theo số lượng: món rẻ
 * bán nhiều dễ đứng đầu bảng "bán chạy" nhưng lại đóng góp ít doanh thu.
 *
 * `total` lấy từ KPI (không phải Σ các dòng) nên "Món khác" vẫn đúng kể cả khi danh sách bị cắt.
 */
export function ItemStructure({ items, total }: { items: TopItem[]; total: number }) {
  if (items.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const shown = sorted.slice(0, SHOWN);
  const restRevenue = total - shown.reduce((s, i) => s + i.revenue, 0);
  const restQty = sorted.slice(SHOWN).reduce((s, i) => s + i.qty, 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <ul className="flex flex-col gap-sm">
      {shown.map((it) => (
        <BarRow
          key={it.name}
          label={it.name}
          value={`${formatVnd(it.revenue)} · ${Math.round(pct(it.revenue))}%`}
          pct={pct(it.revenue)}
          sub={`${it.qty} phần`}
        />
      ))}
      {restRevenue > 0 && (
        <BarRow
          label={`Món khác (${sorted.length - shown.length})`}
          value={`${formatVnd(restRevenue)} · ${Math.round(pct(restRevenue))}%`}
          pct={pct(restRevenue)}
          sub={restQty > 0 ? `${restQty} phần` : undefined}
          tone="steel"
        />
      )}
    </ul>
  );
}
