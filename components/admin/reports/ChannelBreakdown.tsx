import type { ChannelSlice, OrderChannel } from "@/lib/billing/reports";
import { formatVnd } from "@/lib/orders/cart";
import { BarRow } from "./BarRow";

const CHANNEL_LABEL: Record<OrderChannel, string> = {
  dine_in: "Tại bàn",
  takeaway: "Mang về",
  delivery: "Giao hàng",
};
const ORDER: OrderChannel[] = ["dine_in", "takeaway", "delivery"];

/**
 * Doanh thu theo kênh bán, kèm tỷ lệ khách tự gọi QR vs nhân viên nhập (REPORT-08).
 * Gộp từ (channel × source) do report_by_channel trả về.
 */
export function ChannelBreakdown({ channels }: { channels: ChannelSlice[] }) {
  if (channels.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  const total = channels.reduce((s, c) => s + c.revenue, 0);
  const rows = ORDER.map((channel) => {
    const parts = channels.filter((c) => c.channel === channel);
    const revenue = parts.reduce((s, c) => s + c.revenue, 0);
    const qr = parts.find((c) => c.source === "qr")?.revenue ?? 0;
    return { channel, revenue, qr };
  }).filter((r) => r.revenue > 0);

  if (rows.length === 0) return <p className="text-sm text-steel">Chưa có dữ liệu.</p>;

  return (
    <ul className="flex flex-col gap-sm">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.revenue / total) * 100) : 0;
        const qrPct = r.revenue > 0 ? Math.round((r.qr / r.revenue) * 100) : 0;
        return (
          <BarRow
            key={r.channel}
            label={CHANNEL_LABEL[r.channel]}
            value={`${formatVnd(r.revenue)} · ${pct}%`}
            pct={total > 0 ? (r.revenue / total) * 100 : 0}
            sub={`Khách tự gọi QR ${qrPct}% · nhân viên nhập ${100 - qrPct}%`}
          />
        );
      })}
    </ul>
  );
}
