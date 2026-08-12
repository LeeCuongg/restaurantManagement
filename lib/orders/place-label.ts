/**
 * Nhãn CHỖ của một đơn — dùng chung cho phiếu khách, hóa đơn/tạm tính và màn hình bếp, để ba nơi
 * không bao giờ nói khác nhau về cùng một đơn.
 *
 * Quán chạy chế độ QUẦY (service_mode='counter'): nhân viên gõ đơn cho khách ngay tại quầy, khách
 * ngồi ăn tại quán nhưng ngồi ngẫu nhiên nên KHÔNG gắn bàn. Những đơn này lưu channel='takeaway'
 * (để dùng chung luồng đơn không bàn) nhưng KHÔNG phải mang về → in "Tại quán". Chỉ đơn do KHÁCH
 * tự đặt online (source='online') mới thật sự là mang về / giao tận nơi.
 */
import type { ServiceMode } from "@/lib/tenant/settings";
import type { OrderChannel, OrderSource } from "./types";

export function orderPlaceLabel(args: {
  serviceMode: ServiceMode;
  tableName?: string | null;
  channel: OrderChannel;
  source?: OrderSource | null;
}): string {
  if (args.tableName) return `Bàn ${args.tableName}`;
  if (args.channel === "delivery") return "Giao tận nơi";
  if (args.channel === "takeaway") {
    // Khách tự đặt online → mang về thật. Nhân viên gõ tại quầy ở quán chế độ quầy → ăn tại quán.
    if (args.source === "online" || args.serviceMode !== "counter") return "Mang về";
    return "Tại quán";
  }
  return "Tại quán";
}

/**
 * Nhãn NHÓM cho báo cáo (REPORT-08): mọi đơn có bàn gộp thành "Tại bàn" thay vì tách ra
 * "Bàn B1", "Bàn B2"… Còn lại dùng đúng quy tắc của `orderPlaceLabel` để báo cáo, phiếu bếp
 * và hóa đơn không bao giờ gọi khác nhau về cùng một đơn.
 */
export function orderPlaceGroup(args: {
  serviceMode: ServiceMode;
  hasTable: boolean;
  channel: OrderChannel;
  source?: OrderSource | null;
}): string {
  if (args.hasTable) return "Tại bàn";
  return orderPlaceLabel({ ...args, tableName: null });
}
