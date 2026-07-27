"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { canManage, type ManageSection } from "@/lib/auth/rbac";
import type { Role } from "@/lib/auth/session";

type NavItem = { key: string; label: string; href?: string; section?: ManageSection };

/**
 * Sidebar nav (client) — tự tô đậm mục đang mở theo pathname.
 * Mục không có quyền bị ẨN HẲN (AUTH-05), và quyền lấy TỪ `canManage` — không chép tay danh
 * sách vai trò ở đây, để nav và guard trang không bao giờ lệch nhau.
 */
export function AdminNav({ base, role }: { base: string; role: Role }) {
  const pathname = usePathname();
  const allItems: NavItem[] = [
    { key: "dashboard", label: "Tổng quan", href: base },
    { key: "staff", label: "Nhân viên", href: `${base}/staff`, section: "staff" },
    { key: "menu", label: "Thực đơn", href: `${base}/menu`, section: "menu" },
    { key: "tables", label: "Bàn & QR", href: `${base}/tables`, section: "tables" },
    { key: "reports", label: "Báo cáo", href: `${base}/reports`, section: "reports" },
    { key: "settings", label: "Cài đặt", href: `${base}/settings`, section: "settings" },
  ];
  const items = allItems.filter((item) => !item.section || canManage(role, item.section));

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === base) return pathname === base;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="flex flex-1 flex-col gap-xxs p-sm">
      {items.map((item) =>
        item.href ? (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-md py-sm text-sm text-slate transition-colors duration-150 motion-reduce:transition-none hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              isActive(item.href) && "bg-cream font-medium text-ink"
            )}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.key}
            className="flex items-center justify-between rounded-md px-md py-sm text-sm text-muted"
            title="Sắp có ở plan sau"
          >
            {item.label}
            <span className="text-[10px] uppercase tracking-wide text-stone">chờ</span>
          </span>
        )
      )}
    </nav>
  );
}
