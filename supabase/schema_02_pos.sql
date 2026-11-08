-- KetaPOS · 2-bosqich sxemasi: do'kon ichidagi ish ma'lumotlari (menyu, buyurtma, ombor, xarajat, hisobot)
-- 1-bosqich (venues / staff / invite_codes) ustiga qo'shiladi.
-- Ishlatish: npm run db:apply supabase/schema_02_pos.sql
--
-- Tamoyillar:
--   * Har bir javdalda venue_id bor va butun ma'lumot shu ustun orqali ajratiladi.
--   * O'qish: RLS select policy + security definer funksiyalar (ularda venue_id = current_venue_id() tekshiriladi).
--   * Yozish: faqat RPC funksiya orqali (jadvallarda insert/update/delete policy YO'Q) → barcha yozishlar
--     bir tranzaktsiyada va tekshirilgan holda bo'ladi.
--   * Vaqt: bazoda timestamptz, interfeysga "YYYY-MM-DD HH:MM:SS" matn ko'rinishida chiqadi (do'kon vaqt mintaqasi bo'yicha),
--     shuning uchun eski fmtTime/fmtDate/minutesSince funksiyalari o'zgarmaydi.

-- ---------- Venue uchun qo'shimcha ustun ----------

alter table public.venues
  add column if not exists timezone text not null default 'Asia/Tashkent';

-- ---------- Jadvallar ----------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  emoji text not null default '',
  color text not null default '#f97316',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  price integer not null default 0 check (price >= 0),
  emoji text not null default '🍽️',
  active boolean not null default true,
  track_stock boolean not null default false,
  stock_qty numeric(14, 3) not null default 0,
  low_stock numeric(14, 3) not null default 5,
  unit text not null default 'dona',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  zone text not null default 'Asosiy zal',
  seats integer not null default 4,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  number integer not null,
  type text not null default 'takeaway' check (type in ('dine_in', 'takeaway', 'delivery')),
  table_id uuid references public.dining_tables(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  kitchen_status text not null default 'none' check (kitchen_status in ('none', 'new', 'cooking', 'ready', 'served')),
  subtotal integer not null default 0,
  discount_percent numeric(5, 2) not null default 0,
  discount integer not null default 0,
  total integer not null default 0,
  payment_method text check (payment_method in ('cash', 'card', 'click')),
  received integer,
  change_amount integer,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  price integer not null,
  qty numeric(14, 3) not null default 1 check (qty > 0),
  total integer not null,
  note text not null default '',
  sort integer not null default 0
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta numeric(14, 3) not null,
  reason text not null check (reason in ('sale', 'kirim', 'chiqim')),
  note text not null default '',
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  amount integer not null check (amount > 0),
  category text not null default 'Boshqa',
  created_at timestamptz not null default now()
);

create table if not exists public.venue_settings (
  venue_id uuid not null references public.venues(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (venue_id, key)
);

-- Buyurtma raqami har bir do'konda alohida sanaladi (1001 dan boshlanadi).
create table if not exists public.order_counters (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  next_number integer not null default 1001
);

create index if not exists idx_categories_venue on public.categories(venue_id, sort_order);
create index if not exists idx_products_venue on public.products(venue_id, sort_order);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_dtables_venue on public.dining_tables(venue_id, zone, sort_order);
create index if not exists idx_orders_venue_status on public.orders(venue_id, status);
create index if not exists idx_orders_venue_paid on public.orders(venue_id, paid_at);
create index if not exists idx_orders_venue_number on public.orders(venue_id, number);
create index if not exists idx_orders_table on public.orders(table_id);
create index if not exists idx_oitems_order on public.order_items(order_id, sort);
create index if not exists idx_movements_product on public.stock_movements(venue_id, product_id, created_at);
create index if not exists idx_expenses_venue on public.expenses(venue_id, created_at);

-- ---------- Vaqt formatlash yordamchilari ----------

create or replace function public.venue_tz()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select v.timezone from public.venues v where v.id = public.current_venue_id()),
    'Asia/Tashkent'
  );
$$;

-- timestamptz → interfeys kutayotgan "YYYY-MM-DD HH:MM:SS" matn.
create or replace function public.ts_text(p_ts timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select case when p_ts is null then null
              else to_char(p_ts at time zone public.venue_tz(), 'YYYY-MM-DD HH24:MI:SS') end;
$$;

create or replace function public.ts_date(p_ts timestamptz)
returns date
language sql stable security definer set search_path = public
as $$
  select case when p_ts is null then null
              else (p_ts at time zone public.venue_tz())::date end;
$$;

-- ---------- Yozish yordamchilari ----------

create or replace function public.claim_order_number(p_venue uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_next integer;
begin
  insert into public.order_counters(venue_id, next_number)
  values (p_venue, 1001) on conflict (venue_id) do nothing;

  select next_number into v_next from public.order_counters where venue_id = p_venue for update;
  update public.order_counters set next_number = v_next + 1 where venue_id = p_venue;
  return v_next;
end;
$$;

-- ---------- Buyurtma JSON shakli (eski SQLite qatorlari bilan bir xil) ----------

create or replace function public.order_jsonb(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select to_jsonb(t) from (
    select
      o.id, o.number, o.type, o.table_id, o.status, o.kitchen_status,
      o.subtotal, o.discount_percent, o.discount, o.total,
      o.payment_method, o.received, o.change_amount, o.note,
      public.ts_text(o.created_at) as created_at,
      public.ts_text(o.paid_at) as paid_at,
      tb.name as table_name,
      (select coalesce(sum(oi.qty), 0) from public.order_items oi where oi.order_id = o.id) as item_count,
      (select coalesce(
               jsonb_agg(jsonb_build_object(
                 'id', oi.id, 'order_id', oi.order_id, 'product_id', oi.product_id,
                 'name', oi.name, 'price', oi.price, 'qty', oi.qty,
                 'total', oi.total, 'note', oi.note
               ) order by oi.sort, oi.id),
               '[]'::jsonb)
         from public.order_items oi where oi.order_id = o.id) as items
    from public.orders o
    left join public.dining_tables tb on tb.id = o.table_id
    where o.id = p_id and o.venue_id = public.current_venue_id()
  ) t;
$$;

-- ---------- Kategoriyalar ----------

create or replace function public.pos_categories()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'emoji', c.emoji, 'color', c.color, 'sort_order', c.sort_order
  ) order by c.sort_order, c.id), '[]'::jsonb)
  from public.categories c
  where c.venue_id = public.current_venue_id();
$$;

create or replace function public.add_category(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_id uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  insert into public.categories(venue_id, name, emoji, color, sort_order)
  values (
    v_venue,
    trim(coalesce(p->>'name', '')),
    coalesce(p->>'emoji', ''),
    coalesce(p->>'color', '#f97316'),
    (select coalesce(max(c.sort_order), -1) + 1 from public.categories c where c.venue_id = v_venue)
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.update_category(p_id uuid, p jsonb)
returns void
language sql security definer set search_path = public
as $$
  update public.categories set
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    emoji = coalesce(p->>'emoji', emoji),
    color = coalesce(p->>'color', color),
    sort_order = coalesce((p->>'sort_order')::integer, sort_order)
  where id = p_id and venue_id = public.current_venue_id();
$$;

create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.products
             where category_id = p_id and venue_id = public.current_venue_id()) then
    raise exception 'KATEGORIYADA_MAHSULOT_BOR';
  end if;
  delete from public.categories
  where id = p_id and venue_id = public.current_venue_id();
end;
$$;

-- ---------- Mahsulotlar ----------

create or replace function public.pos_products(
  p_active_only boolean default false,
  p_category_id uuid default null
)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'venue_id', p.venue_id, 'category_id', p.category_id,
    'name', p.name, 'price', p.price, 'emoji', p.emoji,
    'active', p.active::int, 'track_stock', p.track_stock::int,
    'stock_qty', p.stock_qty, 'low_stock', p.low_stock, 'unit', p.unit,
    'sort_order', p.sort_order,
    'category_name', c.name, 'category_color', c.color
  ) order by p.sort_order, p.id), '[]'::jsonb)
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.venue_id = public.current_venue_id()
    and (p_active_only is not true or p.active)
    and (p_category_id is null or p.category_id = pos_products.p_category_id);
$$;

create or replace function public.add_product(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_cat uuid; v_id uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  select id into v_cat from public.categories
  where id = (p->>'category_id')::uuid and venue_id = v_venue;
  if v_cat is null then raise exception 'KATEGORIYA_TOPILMADI'; end if;

  insert into public.products(
    venue_id, category_id, name, price, emoji, active, track_stock, stock_qty, low_stock, unit, sort_order
  ) values (
    v_venue, v_cat,
    trim(coalesce(p->>'name', '')),
    coalesce((p->>'price')::integer, 0),
    coalesce(nullif(p->>'emoji', ''), '🍽️'),
    coalesce((p->>'active')::boolean, true),
    coalesce((p->>'track_stock')::boolean, false),
    coalesce((p->>'stock_qty')::numeric, 0),
    coalesce((p->>'low_stock')::numeric, 5),
    coalesce(nullif(p->>'unit', ''), 'dona'),
    (select coalesce(max(x.sort_order), -1) + 1 from public.products x where x.venue_id = v_venue)
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.update_product(p_id uuid, p jsonb)
returns void
language sql security definer set search_path = public
as $$
  update public.products set
    category_id = coalesce((p->>'category_id')::uuid, category_id),
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    price = coalesce((p->>'price')::integer, price),
    emoji = coalesce(nullif(p->>'emoji', ''), emoji),
    active = coalesce((p->>'active')::boolean, active),
    track_stock = coalesce((p->>'track_stock')::boolean, track_stock),
    stock_qty = coalesce((p->>'stock_qty')::numeric, stock_qty),
    low_stock = coalesce((p->>'low_stock')::numeric, low_stock),
    unit = coalesce(nullif(p->>'unit', ''), unit)
  where id = p_id and venue_id = public.current_venue_id();
$$;

-- Ishlatilgan mahsulot o'chirilmaydi, faqat arxivlanadi (buyurtma tarixi buzilmasligi uchun).
create or replace function public.delete_product(p_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid;
begin
  v_venue := public.current_venue_id();
  if not exists (select 1 from public.products where id = p_id and venue_id = v_venue) then
    raise exception 'MAHSULOT_TOPILMADI';
  end if;

  if exists (select 1 from public.order_items where product_id = p_id and venue_id = v_venue) then
    update public.products set active = false where id = p_id;
    return 'archived';
  end if;

  delete from public.products where id = p_id;
  return 'deleted';
end;
$$;

-- ---------- Stollar ----------

create or replace function public.pos_table_states()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'zone', t.zone, 'seats', t.seats, 'sort_order', t.sort_order,
    'order_id', o.id, 'order_number', o.number, 'order_total', o.total,
    'order_since', public.ts_text(o.created_at), 'order_kitchen', o.kitchen_status,
    'item_count', case when o.id is null then 0
                       else (select coalesce(sum(oi.qty), 0) from public.order_items oi where oi.order_id = o.id) end
  ) order by t.zone, t.sort_order, t.id), '[]'::jsonb)
  from public.dining_tables t
  left join public.orders o on o.table_id = t.id and o.status = 'open'
  where t.venue_id = public.current_venue_id();
$$;

create or replace function public.pos_zones()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(z.zone order by z.zone), '[]'::jsonb)
  from (select distinct t.zone from public.dining_tables t where t.venue_id = public.current_venue_id()) z;
$$;

create or replace function public.add_table(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_id uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  if nullif(trim(coalesce(p->>'name', '')), '') is null then raise exception 'NOM_KERTILMADI'; end if;

  insert into public.dining_tables(venue_id, name, zone, seats, sort_order)
  values (
    v_venue, trim(p->>'name'),
    coalesce(nullif(trim(p->>'zone'), ''), 'Asosiy zal'),
    coalesce((p->>'seats')::integer, 4),
    (select coalesce(max(t.sort_order), -1) + 1 from public.dining_tables t where t.venue_id = v_venue)
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.update_table(p_id uuid, p jsonb)
returns void
language sql security definer set search_path = public
as $$
  update public.dining_tables set
    name = coalesce(nullif(trim(p->>'name'), ''), name),
    zone = coalesce(nullif(trim(p->>'zone'), ''), zone),
    seats = coalesce((p->>'seats')::integer, seats),
    sort_order = coalesce((p->>'sort_order')::integer, sort_order)
  where id = p_id and venue_id = public.current_venue_id();
$$;

create or replace function public.delete_table(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.orders
             where table_id = p_id and venue_id = public.current_venue_id() and status = 'open') then
    raise exception 'STOLD_OCHIQ_BUYURTMA';
  end if;
  update public.orders set table_id = null
  where table_id = p_id and venue_id = public.current_venue_id();
  delete from public.dining_tables
  where id = p_id and venue_id = public.current_venue_id();
end;
$$;

-- ---------- Buyurtmalar ----------

create or replace function public.order_items_insert(p_order uuid, p_venue uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.order_items(venue_id, order_id, product_id, name, price, qty, total, note, sort)
  select p_venue, p_order,
         nullif(it->>'product_id', '')::uuid,
         it->>'name',
         coalesce((it->>'price')::integer, 0),
         coalesce((it->>'qty')::numeric, 1),
         coalesce(round((it->>'price')::numeric * (it->>'qty')::numeric), 0)::integer,
         coalesce(it->>'note', ''),
         ord
  from jsonb_array_elements(p_items) with ordinality as t(it, ord);
end;
$$;

create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_venue uuid; v_id uuid; v_number integer; v_short integer;
  v_type text; v_table uuid; v_items jsonb; v_disc_pct numeric;
  v_subtotal integer; v_discount integer; v_total integer;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  v_items := coalesce(p->'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then raise exception 'BUYURTMA_BOSH'; end if;

  v_type := coalesce(p->>'type', 'takeaway');
  if v_type not in ('dine_in', 'takeaway', 'delivery') then raise exception 'TURI_NOTOGRI'; end if;

  v_table := nullif(coalesce(p->>'table_id', ''), '')::uuid;
  if v_type = 'dine_in' and v_table is null then raise exception 'STOL_TANLANG'; end if;
  if v_table is not null then
    if not exists (select 1 from public.dining_tables where id = v_table and venue_id = v_venue) then
      raise exception 'STOL_TOPILMADI';
    end if;
    if exists (select 1 from public.orders
               where table_id = v_table and venue_id = v_venue and status = 'open') then
      raise exception 'STOL_BAND';
    end if;
  else
    v_type := 'takeaway';
  end if;

  -- Ombor hisobidagi mahsulotlar uchun qoldiq tekshiruvi (xuddi savatdagi kabi).
  select count(*) into v_short
  from jsonb_array_elements(v_items) it
  join public.products pr on pr.id = nullif(it->>'product_id', '')::uuid
  where pr.venue_id = v_venue and pr.track_stock
    and pr.stock_qty < coalesce((it->>'qty')::numeric, 1);
  if v_short > 0 then raise exception 'QOLDIQ_YETARLI_EMAS'; end if;

  v_disc_pct := coalesce((p->>'discount_percent')::numeric, 0);
  select coalesce(sum(round((it->>'price')::numeric * (it->>'qty')::numeric)), 0)::integer
    into v_subtotal from jsonb_array_elements(v_items) it;
  v_discount := round(v_subtotal * v_disc_pct / 100)::integer;
  v_total := v_subtotal - v_discount;

  v_number := public.claim_order_number(v_venue);

  insert into public.orders(
    venue_id, number, type, table_id, status, kitchen_status,
    subtotal, discount_percent, discount, total, note, created_by
  ) values (
    v_venue, v_number, v_type, v_table, 'open',
    case when coalesce((p->>'send_to_kitchen')::boolean, false) then 'new' else 'none' end,
    v_subtotal, v_disc_pct, v_discount, v_total,
    coalesce(p->>'note', ''), auth.uid()
  )
  returning id into v_id;

  perform public.order_items_insert(v_id, v_venue, v_items);

  return public.order_jsonb(v_id);
end;
$$;

create or replace function public.update_order(p_id uuid, p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order record; v_items jsonb; v_table uuid; v_type text; v_short integer;
  v_disc_pct numeric; v_subtotal integer; v_discount integer; v_total integer;
begin
  select * into v_order from public.orders
  where id = p_id and venue_id = public.current_venue_id();
  if not found then raise exception 'BUYURTMA_TOPILMADI'; end if;
  if v_order.status <> 'open' then raise exception 'FAQAT_OCHIQ_TAHRIR'; end if;

  v_items := coalesce(p->'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then raise exception 'BUYURTMA_BOSH'; end if;

  v_type := coalesce(p->>'type', v_order.type);
  v_table := case
    when p ? 'table_id' then nullif(coalesce(p->>'table_id', ''), '')::uuid
    else v_order.table_id end;
  if v_type = 'dine_in' and v_table is null then raise exception 'STOL_TANLANG'; end if;
  if v_table is not null and exists (
      select 1 from public.orders
      where table_id = v_table and venue_id = v_order.venue_id and status = 'open' and id <> p_id
  ) then raise exception 'STOL_BAND'; end if;

  select count(*) into v_short
  from jsonb_array_elements(v_items) it
  join public.products pr on pr.id = nullif(it->>'product_id', '')::uuid
  where pr.venue_id = v_order.venue_id and pr.track_stock
    and pr.stock_qty < coalesce((it->>'qty')::numeric, 1);
  if v_short > 0 then raise exception 'QOLDIQ_YETARLI_EMAS'; end if;

  v_disc_pct := coalesce((p->>'discount_percent')::numeric, 0);
  select coalesce(sum(round((it->>'price')::numeric * (it->>'qty')::numeric)), 0)::integer
    into v_subtotal from jsonb_array_elements(v_items) it;
  v_discount := round(v_subtotal * v_disc_pct / 100)::integer;
  v_total := v_subtotal - v_discount;

  update public.orders set
    type = v_type, table_id = v_table, subtotal = v_subtotal,
    discount_percent = v_disc_pct, discount = v_discount, total = v_total,
    note = coalesce(p->>'note', '')
  where id = p_id;

  delete from public.order_items where order_id = p_id;
  perform public.order_items_insert(p_id, v_order.venue_id, v_items);

  return public.order_jsonb(p_id);
end;
$$;

create or replace function public.send_to_kitchen(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update public.orders set kitchen_status = 'new'
  where id = p_id and venue_id = public.current_venue_id() and kitchen_status = 'none';
  return public.order_jsonb(p_id);
end;
$$;

-- To'lov: buyurtma yopiladi, ombor qoldig'i aytiladi va harakat yozuvlari bir tranzaktsiyada qoladi.
create or replace function public.pay_order(p_id uuid, p_method text, p_received integer default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order record; v_received integer; v_change integer;
begin
  select * into v_order from public.orders
  where id = p_id and venue_id = public.current_venue_id();
  if not found then raise exception 'BUYURTMA_TOPILMADI'; end if;
  if v_order.status <> 'open' then raise exception 'FAQAT_OCHIQ_TOLOV'; end if;
  if p_method not in ('cash', 'card', 'click') then raise exception 'TOLOV_TURI_NOTOGRI'; end if;

  v_received := v_order.total;
  v_change := 0;
  if p_method = 'cash' then
    v_received := coalesce(p_received, v_order.total);
    if v_received < v_order.total then raise exception 'SUMMA_YETARLI_EMAS'; end if;
    v_change := v_received - v_order.total;
  end if;

  update public.orders set
    status = 'paid', payment_method = p_method, received = v_received, change_amount = v_change,
    paid_at = now(),
    kitchen_status = case when kitchen_status = 'none' then 'new' else kitchen_status end
  where id = p_id;

  insert into public.stock_movements(venue_id, product_id, delta, reason, note, order_id)
  select v_order.venue_id, oi.product_id, -oi.qty, 'sale',
         'Buyurtma №' || v_order.number, v_order.id
  from public.order_items oi
  join public.products pr on pr.id = oi.product_id
  where oi.order_id = p_id and pr.track_stock;

  update public.products p set stock_qty = p.stock_qty - x.qty
  from (
    select oi.product_id, sum(oi.qty) as qty
    from public.order_items oi
    join public.products pr on pr.id = oi.product_id
    where oi.order_id = p_id and pr.track_stock
    group by oi.product_id
  ) x
  where p.id = x.product_id;

  return public.order_jsonb(p_id);
end;
$$;

create or replace function public.cancel_order(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from public.orders
  where id = p_id and venue_id = public.current_venue_id();
  if v_status is null then raise exception 'BUYURTMA_TOPILMADI'; end if;
  if v_status <> 'open' then raise exception 'FAQAT_OCHIQ_BEKOR'; end if;
  update public.orders set status = 'cancelled', kitchen_status = 'none' where id = p_id;
end;
$$;

create or replace function public.set_kitchen_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_status not in ('new', 'cooking', 'ready', 'served') then raise exception 'HOLAT_NOTOGRI'; end if;
  update public.orders set kitchen_status = p_status
  where id = p_id and venue_id = public.current_venue_id();
end;
$$;

create or replace function public.pos_order(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select public.order_jsonb(p_id);
$$;

create or replace function public.pos_open_orders()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public.order_jsonb(x.id) order by x.created_at desc), '[]'::jsonb)
  from (
    select o.id, o.created_at from public.orders o
    where o.venue_id = public.current_venue_id() and o.status = 'open'
  ) x;
$$;

create or replace function public.pos_kitchen_orders()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public.order_jsonb(x.id) order by x.created_at asc), '[]'::jsonb)
  from (
    select o.id, o.created_at from public.orders o
    where o.venue_id = public.current_venue_id()
      and o.status <> 'cancelled'
      and o.kitchen_status in ('new', 'cooking', 'ready')
  ) x;
$$;

create or replace function public.pos_orders(
  p_from date default null,
  p_to date default null,
  p_status text default null,
  p_limit integer default 200
)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public.order_jsonb(x.id) order by x.created_at desc), '[]'::jsonb)
  from (
    select o.id, o.created_at from public.orders o
    where o.venue_id = public.current_venue_id()
      and (p_status is null or o.status = p_status)
      and (p_from is null or public.ts_date(o.created_at) >= p_from)
      and (p_to is null or public.ts_date(o.created_at) <= p_to)
    order by o.created_at desc
    limit least(coalesce(p_limit, 200), 500)
  ) x;
$$;

-- ---------- Ombor ----------

create or replace function public.stock_in(p_product uuid, p_qty numeric, p_note text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'MIQDOR_NOTOGRI'; end if;
  if not exists (select 1 from public.products where id = p_product and venue_id = v_venue) then
    raise exception 'MAHSULOT_TOPILMADI';
  end if;

  update public.products set stock_qty = stock_qty + p_qty where id = p_product;
  insert into public.stock_movements(venue_id, product_id, delta, reason, note)
  values (v_venue, p_product, p_qty, 'kirim', coalesce(p_note, ''));
end;
$$;

create or replace function public.stock_out(p_product uuid, p_qty numeric, p_note text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_have numeric; v_unit text;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'MIQDOR_NOTOGRI'; end if;

  select stock_qty, unit into v_have, v_unit from public.products
  where id = p_product and venue_id = v_venue;
  if v_have is null then raise exception 'MAHSULOT_TOPILMADI'; end if;
  if v_have < p_qty then raise exception 'QOLDIQ_YETARLI_EMAS_CHIQIM'; end if;

  update public.products set stock_qty = stock_qty - p_qty where id = p_product;
  insert into public.stock_movements(venue_id, product_id, delta, reason, note)
  values (v_venue, p_product, -p_qty, 'chiqim', coalesce(p_note, ''));
end;
$$;

create or replace function public.pos_movements(p_product uuid default null, p_limit integer default 100)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'product_id', m.product_id, 'product_name', p.name, 'unit', p.unit,
    'delta', m.delta, 'reason', m.reason, 'note', m.note,
    'order_id', m.order_id, 'created_at', public.ts_text(m.created_at)
  ) order by m.created_at desc, m.id desc), '[]'::jsonb)
  from (
    select * from public.stock_movements
    where venue_id = public.current_venue_id()
      and (p_product is null or product_id = p_product)
    order by created_at desc, id desc
    limit least(coalesce(p_limit, 100), 500)
  ) m
  join public.products p on p.id = m.product_id;
$$;

create or replace function public.pos_low_stock()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'category_id', p.category_id, 'name', p.name, 'price', p.price, 'emoji', p.emoji,
    'active', p.active::int, 'track_stock', p.track_stock::int,
    'stock_qty', p.stock_qty, 'low_stock', p.low_stock, 'unit', p.unit
  ) order by p.stock_qty asc), '[]'::jsonb)
  from public.products p
  where p.venue_id = public.current_venue_id() and p.track_stock and p.stock_qty <= p.low_stock;
$$;

-- ---------- Xarajatlar ----------

create or replace function public.add_expense(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_id uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  if coalesce((p->>'amount')::integer, 0) <= 0 then raise exception 'SUMMA_NOTOGRI'; end if;
  if nullif(trim(coalesce(p->>'title', '')), '') is null then raise exception 'NOM_KERTILMADI'; end if;

  insert into public.expenses(venue_id, title, amount, category)
  values (v_venue, trim(p->>'title'), (p->>'amount')::integer,
          coalesce(nullif(p->>'category', ''), 'Boshqa'))
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.pos_expenses(p_from date default null, p_to date default null)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'amount', e.amount, 'category', e.category,
    'created_at', public.ts_text(e.created_at)
  ) order by e.created_at desc), '[]'::jsonb)
  from public.expenses e
  where e.venue_id = public.current_venue_id()
    and (p_from is null or public.ts_date(e.created_at) >= p_from)
    and (p_to is null or public.ts_date(e.created_at) <= p_to);
$$;

create or replace function public.delete_expense(p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.expenses
  where id = p_id and venue_id = public.current_venue_id();
$$;

-- ---------- Sozlamalar ----------

create or replace function public.pos_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
  from public.venue_settings s
  where s.venue_id = public.current_venue_id();
$$;

create or replace function public.save_settings(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; k text;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  for k in select jsonb_object_keys(p) loop
    insert into public.venue_settings(venue_id, key, value, updated_at)
    values (v_venue, k, p->>k, now())
    on conflict (venue_id, key) do update
      set value = excluded.value, updated_at = now();
  end loop;
end;
$$;

-- ---------- Hisobot ----------

create or replace function public.pos_report(p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = public
as $$
with paid as (
  select o.id, o.total, o.discount, o.payment_method, public.ts_date(o.paid_at) as day
  from public.orders o
  where o.venue_id = public.current_venue_id()
    and o.status = 'paid'
    and (p_from is null or public.ts_date(o.paid_at) >= p_from)
    and (p_to is null or public.ts_date(o.paid_at) <= p_to)
),
summ as (
  select coalesce(count(*), 0) as order_count,
         coalesce(sum(total), 0) as revenue,
         coalesce(sum(discount), 0) as discount_total,
         coalesce(round(avg(total)), 0) as avg_check
  from paid
),
by_day as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', to_char(x.day, 'YYYY-MM-DD'), 'order_count', x.order_count, 'revenue', x.revenue
  ) order by x.day), '[]'::jsonb) as data
  from (select day, count(*) as order_count, sum(total) as revenue from paid group by day) x
),
by_method as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_method', x.payment_method, 'order_count', x.order_count, 'revenue', x.revenue
  ) order by x.revenue desc), '[]'::jsonb) as data
  from (select payment_method, count(*) as order_count, sum(total) as revenue
        from paid where payment_method is not null group by payment_method) x
),
top_products as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', x.name, 'qty', x.qty, 'revenue', x.revenue
  ) order by x.revenue desc), '[]'::jsonb) as data
  from (
    select oi.name, sum(oi.qty) as qty, sum(oi.total) as revenue
    from public.order_items oi
    join paid p on p.id = oi.order_id
    where oi.venue_id = public.current_venue_id()
    group by oi.name
    order by revenue desc
    limit 10
  ) x
),
exp as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'amount', e.amount, 'category', e.category,
    'created_at', public.ts_text(e.created_at)
  ) order by e.created_at desc), '[]'::jsonb) as data,
  coalesce(sum(e.amount), 0) as total
  from public.expenses e
  where e.venue_id = public.current_venue_id()
    and (p_from is null or public.ts_date(e.created_at) >= p_from)
    and (p_to is null or public.ts_date(e.created_at) <= p_to)
)
select jsonb_build_object(
  'order_count', summ.order_count,
  'revenue', summ.revenue,
  'discount_total', summ.discount_total,
  'avg_check', summ.avg_check,
  'byDay', by_day.data,
  'byMethod', by_method.data,
  'topProducts', top_products.data,
  'expenses', exp.data,
  'expenseTotal', exp.total,
  'profit', summ.revenue - exp.total
)
from summ, by_day, by_method, top_products, exp;
$$;

-- ---------- Yangi do'kon uchun boshlang'ich menyu ----------

create or replace function public.seed_venue(p_venue uuid, p_kind text, p_store_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.order_counters(venue_id, next_number)
  values (p_venue, 1001) on conflict (venue_id) do nothing;

  insert into public.categories(venue_id, name, emoji, color, sort_order)
  select * from (values
    (p_venue, 'Burgerlar',   '🍔', '#f97316', 0),
    (p_venue, 'Lavash',      '🌯', '#eab308', 1),
    (p_venue, 'Pitsa',       '🍕', '#ef4444', 2),
    (p_venue, 'Tovuq',       '🍗', '#f59e0b', 3),
    (p_venue, 'Gazaklar',    '🍟', '#84cc16', 4),
    (p_venue, 'Ichimliklar', '🥤', '#06b6d4', 5),
    (p_venue, 'Shirinliklar','🍰', '#ec4899', 6)
  ) as t(v, name, emoji, color, ord)
  where p_kind <> 'fastfood' or t.name <> 'Pitsa';

  insert into public.products(
    venue_id, category_id, name, price, emoji, track_stock, stock_qty, low_stock, unit, sort_order
  )
  select p_venue, c.id, x.name, x.price, x.emoji, x.track, x.stock, x.low, 'dona', x.ord
  from (values
    ('Burgerlar', 'Gamburger', 25000, '🍔', false, 0::numeric, 5::numeric, 0),
    ('Burgerlar', 'Chizburger', 28000, '🧀', false, 0, 5, 1),
    ('Burgerlar', 'Double Burger', 42000, '🍔', false, 0, 5, 2),
    ('Burgerlar', 'Tovuq burger', 27000, '🍗', false, 0, 5, 3),
    ('Lavash', 'Lavash tovuqli', 25000, '🌯', false, 0, 5, 4),
    ('Lavash', 'Lavash mol go''shtli', 32000, '🌯', false, 0, 5, 5),
    ('Lavash', 'Lavash achchiq', 26000, '🌶️', false, 0, 5, 6),
    ('Lavash', 'Lavash mini', 18000, '🌯', false, 0, 5, 7),
    ('Pitsa', 'Margarita', 45000, '🍕', false, 0, 5, 8),
    ('Pitsa', 'Pepperoni', 55000, '🍕', false, 0, 5, 9),
    ('Pitsa', 'To''rt fasl', 60000, '🍕', false, 0, 5, 10),
    ('Pitsa', 'Qo''ziqorinli', 50000, '🍄', false, 0, 5, 11),
    ('Tovuq', 'Tovuq qanotlari', 30000, '🍗', false, 0, 5, 12),
    ('Tovuq', 'Naggetslar (6 dona)', 25000, '🍗', false, 0, 5, 13),
    ('Tovuq', 'Grill tovuq', 35000, '🍗', false, 0, 5, 14),
    ('Gazaklar', 'Fri kartoshka', 15000, '🍟', false, 0, 5, 15),
    ('Gazaklar', 'Qishloqcha kartoshka', 18000, '🍟', false, 0, 5, 16),
    ('Gazaklar', 'Piyoz halqalari', 16000, '🧅', false, 0, 5, 17),
    ('Ichimliklar', 'Coca-Cola 0.5L', 8000, '🥤', true, 48, 12, 18),
    ('Ichimliklar', 'Fanta 0.5L', 8000, '🥤', true, 36, 12, 19),
    ('Ichimliklar', 'Sprite 0.5L', 8000, '🥤', true, 24, 12, 20),
    ('Ichimliklar', 'Suv 0.5L', 3000, '💧', true, 60, 15, 21),
    ('Ichimliklar', 'Choy', 5000, '🍵', false, 0, 5, 22),
    ('Ichimliklar', 'Kofe', 10000, '☕', false, 0, 5, 23),
    ('Ichimliklar', 'Ayron', 7000, '🥛', true, 20, 8, 24),
    ('Ichimliklar', 'Limonad', 12000, '🍋', true, 18, 8, 25),
    ('Shirinliklar', 'Muzqaymoq', 10000, '🍦', true, 30, 10, 26),
    ('Shirinliklar', 'Cheeskeyk', 25000, '🍰', false, 0, 5, 27),
    ('Shirinliklar', 'Donut', 12000, '🍩', false, 0, 5, 28)
  ) as x(cat, name, price, emoji, track, stock, low, ord)
  join public.categories c on c.venue_id = p_venue and c.name = x.cat;

  -- Fastfood: tez aylanadigi 8 stol. Kafe: 16 stol (zal + terrasa + VIP).
  if p_kind = 'cafe' then
    insert into public.dining_tables(venue_id, name, zone, seats, sort_order)
    select p_venue, s.name, s.zone, s.seats, row_number() over () - 1
    from (values
      ('1-stol', 'Asosiy zal', 2), ('2-stol', 'Asosiy zal', 2),
      ('3-stol', 'Asosiy zal', 4), ('4-stol', 'Asosiy zal', 4), ('5-stol', 'Asosiy zal', 4),
      ('6-stol', 'Asosiy zal', 4), ('7-stol', 'Asosiy zal', 4), ('8-stol', 'Asosiy zal', 4),
      ('9-stol', 'Asosiy zal', 6), ('10-stol', 'Asosiy zal', 6),
      ('T1', 'Terrasa', 4), ('T2', 'Terrasa', 4), ('T3', 'Terrasa', 4), ('T4', 'Terrasa', 4),
      ('V1', 'VIP xona', 8), ('V2', 'VIP xona', 8)
    ) as s(name, zone, seats);
  else
    insert into public.dining_tables(venue_id, name, zone, seats, sort_order)
    select p_venue, i || '-stol', 'Asosiy zal', 4, i - 1 from generate_series(1, 8) as i;
  end if;

  insert into public.venue_settings(venue_id, key, value)
  select p_venue, k, v from (values
    ('store_name', coalesce(nullif(trim(p_store_name), ''), 'FastFood Kafe')),
    ('receipt_footer', 'Xaridingiz uchun rahmat!'),
    ('auto_print', '0')
  ) as t(k, v)
  on conflict (venue_id, key) do nothing;
end;
$$;

-- Ro'yxatdan o'tganda do'kon avtomatik ravishda tayyor menyu bilan ochiladi.
create or replace function public.register_venue(
  p_name text,
  p_kind text,
  p_phone text default null,
  p_address text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  if exists (select 1 from public.staff where user_id = auth.uid()) then
    raise exception 'ALLAQACHON_ULANGAN';
  end if;
  if p_kind not in ('fastfood', 'cafe') then
    raise exception 'DOKON_TURI_NOTOGRI';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'NOM_KERTILMADI';
  end if;

  insert into public.venues(name, kind, phone, address)
  values (
    trim(p_name),
    p_kind,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), '')
  )
  returning id into v_id;

  insert into public.staff(venue_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  perform public.seed_venue(v_id, p_kind, trim(p_name));

  return v_id;
end;
$$;

-- ---------- RLS ----------

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.dining_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.venue_settings enable row level security;
alter table public.order_counters enable row level security;

drop policy if exists "categories_read" on public.categories;
drop policy if exists "products_read" on public.products;
drop policy if exists "dtables_read" on public.dining_tables;
drop policy if exists "orders_read" on public.orders;
drop policy if exists "oitems_read" on public.order_items;
drop policy if exists "movements_read" on public.stock_movements;
drop policy if exists "expenses_read" on public.expenses;
drop policy if exists "settings_read" on public.venue_settings;
drop policy if exists "counters_read" on public.order_counters;

-- Faqat o'qish siyosati: yozishlar RPC orqali (funksiyalar ichida venue tekshiriladi).
create policy "categories_read" on public.categories for select to authenticated using (venue_id = public.current_venue_id());
create policy "products_read" on public.products for select to authenticated using (venue_id = public.current_venue_id());
create policy "dtables_read" on public.dining_tables for select to authenticated using (venue_id = public.current_venue_id());
create policy "orders_read" on public.orders for select to authenticated using (venue_id = public.current_venue_id());
create policy "oitems_read" on public.order_items for select to authenticated using (venue_id = public.current_venue_id());
create policy "movements_read" on public.stock_movements for select to authenticated using (venue_id = public.current_venue_id());
create policy "expenses_read" on public.expenses for select to authenticated using (venue_id = public.current_venue_id());
create policy "settings_read" on public.venue_settings for select to authenticated using (venue_id = public.current_venue_id());
create policy "counters_read" on public.order_counters for select to authenticated using (venue_id = public.current_venue_id());

-- ---------- Ruxsatlar ----------

grant usage on schema public to authenticated;
grant select on
  public.categories, public.products, public.dining_tables, public.orders,
  public.order_items, public.stock_movements, public.expenses,
  public.venue_settings, public.order_counters
to authenticated;

-- Anon funksiyalarni umuman chaqira olmasligi uchun PUBLIC ruxsatini yopamiz,
-- so'ng faqat kirgan foydalanuvchi va service role'ga qaytarib beramiz.
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated, service_role;

notify pgrst, 'reload schema';
