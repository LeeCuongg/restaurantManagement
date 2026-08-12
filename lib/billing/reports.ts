/**
 * Tổng hợp báo cáo dòng tiền (REPORT-01..09). Chạy SERVER dưới phiên admin ⇒ RLS cách ly tenant.
 *
 * Toàn bộ SUM/GROUP BY nằm trong Postgres (`0023_report_rpcs.sql`). Bản trước fetch từng dòng
 * `bills` rồi cộng trong JS nên dính trần 1000 dòng của PostgREST — tenant đông khách bị báo
 * thiếu doanh thu (REPORT-04). Ở đây chỉ còn việc điền mốc trống và định dạng.
 *
 * Quy ước doanh thu giữ nguyên BILL-05: bill 'paid' + `split_count IS NULL` (loại "vỏ" chia đều).
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "./types";
import type { ReportRange } from "./report-range";

export type { Grain, Preset, ReportRange } from "./report-range";

export type RevenueSummary = { totalRevenue: number; billCount: number; avgPerBill: number };
export type RevenuePoint = { label: string; revenue: number; billCount: number };
export type TopItem = { name: string; qty: number; revenue: number };
export type CategorySlice = { name: string; qty: number; revenue: number };
export type ChannelSlice = { channel: OrderChannel; source: OrderSource; revenue: number; itemCount: number };
export type AreaSlice = { areaName: string; tableName: string; revenue: number; billCount: number };
export type PaymentSlice = { method: PaymentMethod; amount: number; count: number };
export type HourCell = { dow: number; hour: number; revenue: number; billCount: number };

export type OrderChannel = "dine_in" | "takeaway" | "delivery";
export type OrderSource = "qr" | "staff";

export type ReportData = {
  summary: RevenueSummary;
  series: RevenuePoint[];
  topItems: TopItem[];
  categories: CategorySlice[];
  channels: ChannelSlice[];
  areas: AreaSlice[];
  payments: PaymentSlice[];
  hourDow: HourCell[];
  /** Giờ VN có doanh thu cao nhất trong kỳ; null khi kỳ chưa có hóa đơn. */
  peakHour: number | null;
};

export type ComparisonData = { summary: RevenueSummary; series: number[] };

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Gọi RPC và NÉM khi lỗi. Bản cũ dùng `const { data } = await ...` nên lỗi DB âm thầm
 * biến thành doanh thu 0 — sai còn tệ hơn báo lỗi.
 */
async function rpc<T>(client: Client, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`Báo cáo: lỗi khi gọi ${fn} — ${error.message}`);
  return (data ?? []) as T[];
}

const EMPTY_SUMMARY: RevenueSummary = { totalRevenue: 0, billCount: 0, avgPerBill: 0 };

function toSummary(rows: { total_revenue: number; bill_count: number; avg_per_bill: number }[]): RevenueSummary {
  const r = rows[0];
  if (!r) return EMPTY_SUMMARY;
  return {
    totalRevenue: Number(r.total_revenue),
    billCount: Number(r.bill_count),
    avgPerBill: Number(r.avg_per_bill),
  };
}

/** Đổ kết quả RPC vào đúng mốc của `range.buckets` — mốc không có hóa đơn giữ giá trị 0. */
function fillSeries(
  range: ReportRange,
  rows: { bucket_start: string; revenue: number; bill_count: number }[]
): RevenuePoint[] {
  const byMs = new Map<number, { revenue: number; billCount: number }>();
  for (const r of rows) {
    byMs.set(Date.parse(r.bucket_start), { revenue: Number(r.revenue), billCount: Number(r.bill_count) });
  }
  return range.buckets.map((b) => ({
    label: b.label,
    revenue: byMs.get(b.ms)?.revenue ?? 0,
    billCount: byMs.get(b.ms)?.billCount ?? 0,
  }));
}

function baseArgs(tenantId: string, range: ReportRange) {
  return { p_tenant: tenantId, p_from: range.fromUtc, p_to: range.toUtc };
}

export async function getReportData(tenantId: string, range: ReportRange): Promise<ReportData> {
  const client = await createClient();
  const args = baseArgs(tenantId, range);

  const [summaryRows, seriesRows, itemRows, catRows, chanRows, areaRows, payRows, hourRows] = await Promise.all([
    rpc<{ total_revenue: number; bill_count: number; avg_per_bill: number }>(client, "report_summary", args),
    rpc<{ bucket_start: string; revenue: number; bill_count: number }>(client, "report_series", {
      ...args,
      p_grain: range.grain,
    }),
    rpc<{ name: string; qty: number; revenue: number }>(client, "report_top_items", { ...args, p_limit: 10 }),
    rpc<{ name: string; qty: number; revenue: number }>(client, "report_by_category", args),
    rpc<{ channel: string; source: string; revenue: number; item_count: number }>(client, "report_by_channel", args),
    rpc<{ area_name: string; table_name: string; revenue: number; bill_count: number }>(client, "report_by_area", args),
    rpc<{ method: string; amount: number; count: number }>(client, "report_payments", args),
    rpc<{ dow: number; hour: number; revenue: number; bill_count: number }>(client, "report_hour_dow", args),
  ]);

  const hourDow: HourCell[] = hourRows.map((r) => ({
    dow: Number(r.dow),
    hour: Number(r.hour),
    revenue: Number(r.revenue),
    billCount: Number(r.bill_count),
  }));

  // Giờ cao điểm = giờ có tổng doanh thu lớn nhất (cộng dồn mọi thứ trong kỳ).
  const byHour = new Map<number, number>();
  for (const c of hourDow) byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.revenue);
  let peakHour: number | null = null;
  let peakRevenue = 0;
  for (const [hour, revenue] of byHour) {
    if (revenue > peakRevenue) {
      peakRevenue = revenue;
      peakHour = hour;
    }
  }

  // payments: luôn hiện đủ 2 phương thức để đối soát, kể cả khi kỳ không có giao dịch loại đó.
  const payMap = new Map<PaymentMethod, PaymentSlice>([
    ["cash", { method: "cash", amount: 0, count: 0 }],
    ["transfer", { method: "transfer", amount: 0, count: 0 }],
  ]);
  for (const p of payRows) {
    const slice = payMap.get(p.method as PaymentMethod);
    if (slice) {
      slice.amount = Number(p.amount);
      slice.count = Number(p.count);
    }
  }

  return {
    summary: toSummary(summaryRows),
    series: fillSeries(range, seriesRows),
    topItems: itemRows.map((r) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) })),
    categories: catRows.map((r) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) })),
    channels: chanRows.map((r) => ({
      channel: r.channel as OrderChannel,
      source: r.source as OrderSource,
      revenue: Number(r.revenue),
      itemCount: Number(r.item_count),
    })),
    areas: areaRows.map((r) => ({
      areaName: r.area_name,
      tableName: r.table_name,
      revenue: Number(r.revenue),
      billCount: Number(r.bill_count),
    })),
    payments: [...payMap.values()],
    hourDow,
    peakHour,
  };
}

/**
 * Số liệu kỳ liền trước để tính biến động (REPORT-07). Chỉ lấy tổng quan + chuỗi doanh thu —
 * đủ cho delta KPI và cột mờ chồng sau biểu đồ.
 */
export async function getComparison(tenantId: string, prevRange: ReportRange): Promise<ComparisonData> {
  const client = await createClient();
  const args = baseArgs(tenantId, prevRange);

  const [summaryRows, seriesRows] = await Promise.all([
    rpc<{ total_revenue: number; bill_count: number; avg_per_bill: number }>(client, "report_summary", args),
    rpc<{ bucket_start: string; revenue: number; bill_count: number }>(client, "report_series", {
      ...args,
      p_grain: prevRange.grain,
    }),
  ]);

  return {
    summary: toSummary(summaryRows),
    series: fillSeries(prevRange, seriesRows).map((p) => p.revenue),
  };
}
