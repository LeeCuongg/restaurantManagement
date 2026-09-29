import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupplier, listReceipts, listSuppliers } from "@/lib/purchasing/data";
import { formatVnd } from "@/lib/orders/cart";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SupplierFields } from "@/components/admin/purchasing/SupplierFields";
import { ReceiptTable } from "@/components/admin/purchasing/ReceiptTable";
import { setSupplierActive, updateSupplier } from "../actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "info", label: "Thông tin" },
  { key: "history", label: "Lịch sử nhập hàng" },
] as const;

/** Chi tiết nhà cung cấp (PURCH-01) — như KiotViet: tab "Thông tin" / "Lịch sử nhập/trả hàng" (+ "Nợ cần trả NCC" ở 20-03). */
export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug, id } = await params;
  const { tab: tabRaw } = await searchParams;
  const session = (await getSessionMembership(slug))!;
  const supabase = await createClient();
  const s = await getSupplier(supabase, session.tenant.id, id);
  if (!s) notFound();
  const tab = TABS.some((t) => t.key === tabRaw) ? tabRaw! : "info";
  const base = `/r/${slug}/admin/nha-cung-cap`;
  const sum = (await listSuppliers(supabase, session.tenant.id)).find((x) => x.id === id);

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <Link href={base} className="text-sm text-primary">
            ‹ Nhà cung cấp
          </Link>
          <h1 className="mt-xxs font-display text-2xl text-ink">
            {s.name} <span className="font-mono text-base text-steel">{s.code}</span>
          </h1>
          {!s.active && <p className="text-sm text-steel">Đang ngừng hoạt động — không hiện trong ô chọn khi nhập hàng.</p>}
        </div>
        <dl className="flex gap-xl text-sm">
          <div>
            <dt className="text-steel">Tổng mua</dt>
            <dd className="tabular-nums text-ink">{formatVnd(sum?.totalPurchase ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-steel">Nợ cần trả hiện tại</dt>
            <dd className="font-medium tabular-nums text-ink">{formatVnd(sum?.debt ?? 0)}</dd>
          </div>
        </dl>
      </header>

      <nav aria-label="Chi tiết nhà cung cấp" className="flex gap-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${base}/${id}${t.key === "info" ? "" : `?tab=${t.key}`}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md px-md text-sm",
              tab === t.key ? "bg-cream font-medium text-ink" : "text-steel hover:bg-surface"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "info" && (
        <Card>
          <form action={updateSupplier} className="flex flex-col gap-md">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <SupplierFields s={s} />
            <div className="flex flex-wrap items-center justify-between gap-md">
              <SubmitButton pendingLabel="Đang lưu…">Lưu</SubmitButton>
            </div>
          </form>
          <form action={setSupplierActive} className="mt-lg border-t border-hairline-soft pt-md">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={s.active ? "false" : "true"} />
            {s.active ? (
              <ConfirmSubmit
                message="Ngừng hoạt động nhà cung cấp này? Lịch sử và công nợ vẫn giữ nguyên."
                className="text-sm text-status-late hover:underline"
              >
                Ngừng hoạt động
              </ConfirmSubmit>
            ) : (
              <button type="submit" className="text-sm text-primary hover:underline">
                Cho hoạt động lại
              </button>
            )}
          </form>
        </Card>
      )}

      {tab === "history" && (
        <ReceiptTable
          rows={await listReceipts(supabase, session.tenant.id, { supplierId: id })}
          hrefBase={`/r/${slug}/admin/inventory/phieu-nhap`}
          showSupplier={false}
          empty="Chưa nhập hàng của nhà cung cấp này."
        />
      )}
    </div>
  );
}
