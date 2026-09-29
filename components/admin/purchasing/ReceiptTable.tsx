import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/orders/cart";
import { ngayVn, STATUS_LABEL } from "@/lib/purchasing/receipt";
import type { ReceiptListRow, ReceiptStatus } from "@/lib/purchasing/data";

const VARIANT: Record<ReceiptStatus, "cream" | "ready" | "done"> = { draft: "cream", done: "ready", cancelled: "done" };

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Bảng phiếu nhập — dùng ở Nguyên liệu → Phiếu nhập và chi tiết nhà cung cấp. */
export function ReceiptTable({
  rows,
  hrefBase,
  showSupplier = true,
  empty = "Chưa có phiếu nhập nào.",
}: {
  rows: ReceiptListRow[];
  hrefBase: string;
  showSupplier?: boolean;
  empty?: string;
}) {
  return (
    <section className="rounded-lg border border-hairline-soft bg-canvas shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm" data-danh-sach-phieu-nhap>
          <thead className="border-b border-hairline-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-lg py-sm font-medium">Mã phiếu</th>
              <th className="px-md py-sm font-medium">Ngày</th>
              {showSupplier && <th className="px-md py-sm font-medium">Nhà cung cấp</th>}
              <th className="px-md py-sm text-right font-medium">Cần trả NCC</th>
              <th className="px-md py-sm text-right font-medium">Đã trả</th>
              <th className="px-lg py-sm font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-soft">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface/60">
                <td className="px-lg py-sm">
                  <Link href={`${hrefBase}/${r.id}`} className="font-mono text-ink underline-offset-4 hover:underline">
                    {r.code}
                  </Link>
                  <span className="ml-xs text-xs text-steel">{r.lineCount} dòng</span>
                </td>
                <td className="px-md py-sm text-slate">{ngayVn(r.doc_date)}</td>
                {showSupplier && <td className="px-md py-sm text-slate">{r.supplier?.name ?? "—"}</td>}
                <td className="px-md py-sm text-right tabular-nums text-ink">{formatVnd(r.total)}</td>
                <td className="px-md py-sm text-right tabular-nums text-slate">{formatVnd(r.paid)}</td>
                <td className="px-lg py-sm">
                  <ReceiptStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showSupplier ? 6 : 5} className="px-lg py-lg text-center text-sm text-steel">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
