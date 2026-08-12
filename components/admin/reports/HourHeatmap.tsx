import type { HourCell } from "@/lib/billing/reports";
import { formatVnd } from "@/lib/orders/cart";

/** Postgres extract(dow): 0 = Chủ nhật. Hiển thị theo thứ tự tuần Việt Nam. */
const ROWS: { dow: number; label: string }[] = [
  { dow: 1, label: "T2" },
  { dow: 2, label: "T3" },
  { dow: 3, label: "T4" },
  { dow: 4, label: "T5" },
  { dow: 5, label: "T6" },
  { dow: 6, label: "T7" },
  { dow: 0, label: "CN" },
];

/**
 * Khung giờ cao điểm (REPORT-09): lưới thứ × giờ, ô càng đậm doanh thu càng cao.
 * Chỉ hiện các giờ thực sự có bán để lưới không loãng 24 cột trống.
 */
export function HourHeatmap({ cells }: { cells: HourCell[] }) {
  const active = cells.filter((c) => c.revenue > 0);
  if (active.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  const hours = active.map((c) => c.hour);
  const minHour = Math.min(...hours);
  const maxHour = Math.max(...hours);
  const cols = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  const max = Math.max(...active.map((c) => c.revenue));
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-8" />
            {cols.map((h) => (
              <th key={h} className="w-6 pb-xxs text-[10px] font-normal tabular-nums text-steel">
                {h % 2 === minHour % 2 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.dow}>
              <th className="pr-xs text-right text-[11px] font-normal text-steel">{r.label}</th>
              {cols.map((h) => {
                const cell = byKey.get(`${r.dow}-${h}`);
                const revenue = cell?.revenue ?? 0;
                // Sàn 0.12 để ô có bán vẫn nhìn thấy được cạnh ô đỉnh.
                const alpha = revenue > 0 ? 0.12 + (revenue / max) * 0.88 : 0;
                return (
                  <td key={h}>
                    <div
                      className="h-6 w-6 rounded-sm"
                      style={{
                        backgroundColor:
                          revenue > 0 ? `rgb(var(--color-primary) / ${alpha})` : "rgb(var(--color-surface) / 1)",
                      }}
                      title={`${r.label} ${String(h).padStart(2, "0")}:00 — ${formatVnd(revenue)} · ${cell?.billCount ?? 0} HĐ`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-sm text-xs text-steel">Ô càng đậm doanh thu càng cao · đỉnh {formatVnd(max)}</p>
    </div>
  );
}
