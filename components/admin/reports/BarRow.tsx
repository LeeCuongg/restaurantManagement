import { cn } from "@/lib/utils";

/** Dòng "nhãn — số tiền — thanh tỷ trọng" dùng chung cho các khối cơ cấu doanh thu. */
export function BarRow({
  label,
  value,
  pct,
  sub,
  tone = "primary",
}: {
  label: string;
  value: string;
  /** Bề rộng thanh, 0–100. */
  pct: number;
  sub?: string;
  tone?: "primary" | "steel";
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="truncate text-sm text-ink">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-steel">{value}</span>
      </div>
      <div className="mt-xxs h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-steel")}
          style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
        />
      </div>
      {sub && <p className="mt-xxs text-xs text-steel">{sub}</p>}
    </li>
  );
}
