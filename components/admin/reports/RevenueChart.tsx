"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { Grain, RevenuePoint } from "@/lib/billing/reports";

const GRAIN_PREFIX: Record<Grain, string> = { hour: "Lúc", day: "Ngày", week: "Tuần", month: "" };

/**
 * Doanh thu theo mốc thời gian (recharts). Cột = kỳ này, đường nét đứt = kỳ trước (REPORT-07).
 * Độ mịn mốc do `grain` quyết định ở lib/billing/report-range.ts (REPORT-06).
 */
export function RevenueChart({
  series,
  prevSeries,
  grain,
}: {
  series: RevenuePoint[];
  prevSeries?: number[];
  grain: Grain;
}) {
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}tr` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  const hasPrev = !!prevSeries?.some((v) => v > 0);
  const data = series.map((p, i) => ({ ...p, prev: prevSeries?.[i] ?? 0 }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8a8172" }}
            tickLine={false}
            axisLine={{ stroke: "#e8e2d9" }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8a8172" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            formatter={(v, name) => [Number(v).toLocaleString("vi-VN") + "₫", String(name)]}
            labelFormatter={(l) => `${GRAIN_PREFIX[grain]} ${l}`.trim()}
            contentStyle={{ borderRadius: 8, border: "1px solid #e8e2d9", fontSize: 12 }}
          />
          {hasPrev && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
          <Bar dataKey="revenue" name="Kỳ này" fill="#fa520f" radius={[4, 4, 0, 0]} maxBarSize={48} />
          {hasPrev && (
            <Line
              type="monotone"
              dataKey="prev"
              name="Kỳ trước"
              stroke="#8a8172"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
