import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Quản lý nhà hàng",
  description: "Hệ thống quản lý nhà hàng SaaS — Gọi món, POS, KDS, đặt bàn & báo cáo.",
};

/**
 * interactiveWidget: bàn phím ảo THU NHỎ layout viewport thay vì phủ lên nó. Cần cho các
 * bottom sheet `fixed bottom-0` (giỏ hàng, gọi nhân viên): nếu không, bàn phím che mất ô
 * nhập và trang bị đẩy lệch khi khách chạm vào ô text.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
