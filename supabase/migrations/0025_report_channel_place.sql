-- 0025_report_channel_place.sql — Báo cáo phải nói đúng NƠI PHỤC VỤ, không đọc thô cột channel.
--
-- LÝ DO: quán chạy chế độ QUẦY (settings.service_mode='counter') gõ đơn cho khách ăn tại chỗ
-- nhưng không gắn bàn; những đơn đó lưu channel='takeaway' để dùng chung luồng đơn-không-bàn
-- (xem lib/orders/place-label.ts). Báo cáo cũ đọc thẳng `channel` nên quy hết về "Mang về" —
-- sai với thực tế của quán bán tại quầy. Phiếu bếp và hóa đơn vốn đã gọi đúng là "Tại quán".
--
-- Bổ sung `has_table` để tầng app áp đúng quy tắc nhãn chung (orderPlaceGroup).

-- Thêm cột vào bảng kết quả = đổi kiểu trả về ⇒ `create or replace` không làm được, phải drop.
drop function if exists public.report_by_channel(uuid, timestamptz, timestamptz);

create function public.report_by_channel(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (channel text, source text, has_table boolean, revenue bigint, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.channel                                                          as channel,
    o.source                                                           as source,
    (o.table_session_id is not null)                                   as has_table,
    sum(bi.amount)::bigint                                             as revenue,
    sum(bi.qty_allocated)::bigint                                      as item_count
  from public.bill_items bi
  join public.bills b        on b.id = bi.bill_id
  join public.order_items oi on oi.id = bi.order_item_id
  join public.orders o       on o.id = oi.order_id
  where bi.tenant_id = p_tenant
    and b.status = 'paid'
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1, 2, 3
  order by revenue desc;
$$;

grant execute on function public.report_by_channel(uuid, timestamptz, timestamptz) to authenticated;
