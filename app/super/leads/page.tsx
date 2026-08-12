import Link from "next/link";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/auth/session";
import { listLeads, type LeadStatus } from "@/lib/marketing/leads";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateLeadStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Mới",
  contacted: "Đã gọi",
  closed: "Đã chốt",
};

/** Khách để lại liên hệ ở trang giới thiệu (MKT-03). Chỉ super-admin. */
export default async function LeadsPage() {
  const su = await isSuperAdmin();
  if (!su) redirect("/super/login");

  const leads = await listLeads();
  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-canvas px-lg py-xl">
      <header className="flex flex-col gap-md sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-steel">Quản trị hệ thống</p>
          <h1 className="mt-xxs font-display text-3xl text-ink">Khách quan tâm</h1>
          <p className="mt-xs text-sm text-steel">
            {leads.length} liên hệ · {newCount} chưa gọi.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/super">← Về Super Admin</Link>
        </Button>
      </header>

      {leads.length === 0 ? (
        <div className="mt-xl grid place-items-center rounded-lg border border-hairline py-xxl text-center">
          <p className="text-sm text-steel">Chưa có ai để lại liên hệ.</p>
        </div>
      ) : (
        <ul className="mt-xl flex flex-col gap-sm">
          {leads.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-md rounded-lg border border-hairline bg-canvas p-lg sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-sm">
                  <p className="font-medium text-ink">{l.name}</p>
                  <a href={`tel:${l.phone}`} className="text-sm font-medium text-primary hover:underline">
                    {l.phone}
                  </a>
                  <span
                    className={cn(
                      "rounded-full px-sm py-0.5 text-xs font-medium",
                      l.status === "new" && "bg-primary text-primary-fg",
                      l.status === "contacted" && "bg-surface text-steel",
                      l.status === "closed" && "bg-status-ready-bg text-status-ready"
                    )}
                  >
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>
                {l.note && <p className="mt-xxs truncate text-sm text-slate">{l.note}</p>}
                <p className="mt-xxs text-xs text-steel">{formatVnTime(l.createdAt)}</p>
              </div>

              <div className="flex shrink-0 gap-xs">
                {l.status !== "contacted" && <StatusButton id={l.id} status="contacted" label="Đã gọi" />}
                {l.status !== "closed" && <StatusButton id={l.id} status="closed" label="Đã chốt" />}
                {l.status !== "new" && <StatusButton id={l.id} status="new" label="Đánh dấu mới" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: LeadStatus; label: string }) {
  return (
    <form action={updateLeadStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="secondary" size="sm">
        {label}
      </Button>
    </form>
  );
}

/** Giờ Việt Nam — server có thể chạy ở múi giờ khác (Vercel dùng UTC). */
function formatVnTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}
