"use client";

import { createContext, useContext } from "react";
import { getPrintAdapter, type PrintAdapter } from "@/lib/print/adapter";
import type { PrintMode } from "@/lib/tenant/settings";

/**
 * Chế độ in của quán cho các component in (PRINT-10). Trang server đọc `tenants.settings.print_mode`
 * rồi bọc bề mặt bằng `PrintModeProvider`. Thiếu provider → `browser`: đường in an toàn nhất, không
 * cần gì ngoài máy có máy in — lỡ quên bọc thì không đẩy phiếu vào hàng đợi không ai lấy.
 */
const PrintModeContext = createContext<PrintMode>("browser");

export function PrintModeProvider({ mode, children }: { mode: PrintMode; children: React.ReactNode }) {
  return <PrintModeContext.Provider value={mode}>{children}</PrintModeContext.Provider>;
}

export function usePrintMode(): PrintMode {
  return useContext(PrintModeContext);
}

export function usePrintAdapter(): PrintAdapter {
  return getPrintAdapter(usePrintMode());
}
