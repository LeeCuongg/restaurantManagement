-- 0023_report_rpcs.sql — Hàm tổng hợp báo cáo dòng tiền (P4 / REPORT-04..09).
--
-- LÝ DO: bản cũ fetch từng dòng `bills`/`bill_items` qua PostgREST rồi cộng trong JS.
-- PostgREST giới hạn mặc định 1000 dòng/request ⇒ tenant đông khách bị CẮT dữ liệu,
-- doanh thu báo thiếu (vi phạm BILL-05 "doanh thu khớp 100%"). Dồn SUM/GROUP BY xuống
-- Postgres vừa đúng tuyệt đối vừa nhanh hơn, và là nền cho phân tích đa chiều.
--
-- QUY ƯỚC DOANH THU (giữ nguyên BILL-05):
--   • Doanh thu / số HĐ = bills.status='paid' AND split_count IS NULL (loại "vỏ" chia đều).
--   • Món/nhóm/kênh    = bill_items của mọi bill 'paid' (bill con chia đều không mang
--                        bill_items nên không đếm trùng).
--   • Phương thức TT   = payments theo received_at.
-- Mốc thời gian: khoảng nửa mở [p_from, p_to). Nhóm theo NGÀY VIỆT NAM qua
-- `AT TIME ZONE 'Asia/Ho_Chi_Minh'` (thay phép cộng +7h thủ công ở tầng app).
--
-- BẢO MẬT: tất cả `security invoker` ⇒ RLS tenant (0002/0012) vẫn áp dụng nguyên vẹn.
-- Thêm điều kiện tenant_id = p_tenant tường minh để phòng thủ nhiều lớp.

-- ---- 1. Tổng quan -----------------------------------------------------------
create or replace function public.report_summary(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (total_revenue bigint, bill_count bigint, avg_per_bill bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(b.total), 0)::bigint                                  as total_revenue,
    count(*)::bigint                                                   as bill_count,
    coalesce(round(avg(b.total)), 0)::bigint                           as avg_per_bill
  from public.bills b
  where b.tenant_id = p_tenant
    and b.status = 'paid'
    and b.split_count is null
    and b.paid_at >= p_from
    and b.paid_at <  p_to;
$$;

-- ---- 2. Chuỗi thời gian (grain: hour | day | week | month) -------------------
create or replace function public.report_series(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz,
  p_grain  text default 'day'
)
returns table (bucket_start timestamptz, revenue bigint, bill_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    -- date_trunc trên giờ VN rồi đưa ngược về timestamptz ⇒ mốc đầu bucket theo giờ VN.
    (date_trunc(
       case when p_grain in ('hour', 'day', 'week', 'month') then p_grain else 'day' end,
       b.paid_at at time zone 'Asia/Ho_Chi_Minh'
     ) at time zone 'Asia/Ho_Chi_Minh')                                as bucket_start,
    coalesce(sum(b.total), 0)::bigint                                  as revenue,
    count(*)::bigint                                                   as bill_count
  from public.bills b
  where b.tenant_id = p_tenant
    and b.status = 'paid'
    and b.split_count is null
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1
  order by 1;
$$;

-- ---- 3. Món bán chạy --------------------------------------------------------
create or replace function public.report_top_items(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz,
  p_limit  int default 10
)
returns table (name text, qty bigint, revenue bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(oi.name_snapshot, '—')                                    as name,
    sum(bi.qty_allocated)::bigint                                      as qty,
    sum(bi.amount)::bigint                                             as revenue
  from public.bill_items bi
  join public.bills b       on b.id = bi.bill_id
  join public.order_items oi on oi.id = bi.order_item_id
  where bi.tenant_id = p_tenant
    and b.status = 'paid'
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1
  order by qty desc, revenue desc
  limit greatest(p_limit, 1);
$$;

-- ---- 4. Cơ cấu theo nhóm món ------------------------------------------------
-- Món/nhóm đã xóa (menu_item_id set null, hoặc category mất) → gộp nhãn 'Khác'.
create or replace function public.report_by_category(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (name text, qty bigint, revenue bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(mc.name, 'Khác')                                          as name,
    sum(bi.qty_allocated)::bigint                                      as qty,
    sum(bi.amount)::bigint                                             as revenue
  from public.bill_items bi
  join public.bills b                on b.id = bi.bill_id
  join public.order_items oi         on oi.id = bi.order_item_id
  left join public.menu_items mi     on mi.id = oi.menu_item_id
  left join public.menu_categories mc on mc.id = mi.category_id
  where bi.tenant_id = p_tenant
    and b.status = 'paid'
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1
  order by revenue desc;
$$;

-- ---- 5. Cơ cấu theo kênh bán (channel × source) -----------------------------
create or replace function public.report_by_channel(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (channel text, source text, revenue bigint, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.channel                                                          as channel,
    o.source                                                           as source,
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
  group by 1, 2
  order by revenue desc;
$$;

-- ---- 6. Theo khu vực & bàn --------------------------------------------------
-- Dựa trên bills (không phải bill_items) ⇒ khớp tổng doanh thu. Bill gộp nhiều bàn có
-- table_session_id null → nhãn 'Không gắn bàn'.
create or replace function public.report_by_area(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (area_name text, table_name text, revenue bigint, bill_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(a.name, case when t.id is null then 'Không gắn bàn' else 'Chưa xếp khu' end) as area_name,
    coalesce(t.name, '—')                                              as table_name,
    coalesce(sum(b.total), 0)::bigint                                  as revenue,
    count(*)::bigint                                                   as bill_count
  from public.bills b
  left join public.table_sessions ts on ts.id = b.table_session_id
  left join public.tables t          on t.id = ts.table_id
  left join public.areas a           on a.id = t.area_id
  where b.tenant_id = p_tenant
    and b.status = 'paid'
    and b.split_count is null
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1, 2
  order by revenue desc;
$$;

-- ---- 7. Theo phương thức thanh toán -----------------------------------------
create or replace function public.report_payments(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (method text, amount bigint, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.method                                                           as method,
    coalesce(sum(p.amount), 0)::bigint                                 as amount,
    count(*)::bigint                                                   as count
  from public.payments p
  where p.tenant_id = p_tenant
    and p.received_at >= p_from
    and p.received_at <  p_to
  group by 1
  order by amount desc;
$$;

-- ---- 8. Heatmap giờ × thứ (giờ VN; dow 0=Chủ nhật) --------------------------
create or replace function public.report_hour_dow(
  p_tenant uuid,
  p_from   timestamptz,
  p_to     timestamptz
)
returns table (dow int, hour int, revenue bigint, bill_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    extract(dow  from b.paid_at at time zone 'Asia/Ho_Chi_Minh')::int  as dow,
    extract(hour from b.paid_at at time zone 'Asia/Ho_Chi_Minh')::int  as hour,
    coalesce(sum(b.total), 0)::bigint                                  as revenue,
    count(*)::bigint                                                   as bill_count
  from public.bills b
  where b.tenant_id = p_tenant
    and b.status = 'paid'
    and b.split_count is null
    and b.paid_at >= p_from
    and b.paid_at <  p_to
  group by 1, 2
  order by 1, 2;
$$;

-- ---- Quyền ------------------------------------------------------------------
-- security invoker ⇒ RLS lọc theo tenant của người gọi. Chỉ mở cho user đã đăng nhập.
grant execute on function public.report_summary(uuid, timestamptz, timestamptz)            to authenticated;
grant execute on function public.report_series(uuid, timestamptz, timestamptz, text)       to authenticated;
grant execute on function public.report_top_items(uuid, timestamptz, timestamptz, int)     to authenticated;
grant execute on function public.report_by_category(uuid, timestamptz, timestamptz)        to authenticated;
grant execute on function public.report_by_channel(uuid, timestamptz, timestamptz)         to authenticated;
grant execute on function public.report_by_area(uuid, timestamptz, timestamptz)            to authenticated;
grant execute on function public.report_payments(uuid, timestamptz, timestamptz)           to authenticated;
grant execute on function public.report_hour_dow(uuid, timestamptz, timestamptz)           to authenticated;

-- ---- Index hỗ trợ -----------------------------------------------------------
-- Quét theo kỳ trên bills đã có idx_bills_tenant_paid_at (0012). Bổ sung cho payments.
create index if not exists idx_payments_tenant_received_at
  on public.payments (tenant_id, received_at);
