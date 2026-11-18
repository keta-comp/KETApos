-- KetaPOS · 11-bosqich: onlayn zakaz (Instagram/Telegram bio'siga qoyiladigan bitta link).
--
--   /o/<slug> — mijozga ochiq menyu; zakaz yuboradi, to'lov oladi emas (kassada to'lanadi).
--   Zakaz "online_orders" jadvaliga tushadi, do'kon egasi uni qabul qilib kassaga
--   (orders) aylantiradi yoki rad etadi.
--
-- Anon (kirmagan) foydalanuvchi faqat uchta funksiyani chaqiradi:
--   online_menu, online_submit, online_status. Boshqalar yopiq.
-- Ishlatish: DATABASE_URL=... node scripts/apply-sql.mjs supabase/schema_11_online.sql

-- ---------- 1) Do'konning onlayn vitrinasi ----------

create table if not exists public.online_shops (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  slug text not null unique,
  enabled boolean not null default false,
  accepting boolean not null default true,
  delivery boolean not null default false,
  min_total integer not null default 0 check (min_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2) Kelgan zakazlar ----------

create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  token text not null unique,
  client_id text not null,
  customer_name text not null,
  customer_phone text not null,
  type text not null check (type in ('pickup', 'delivery')),
  address text,
  note text,
  items jsonb not null,
  total integer not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected')),
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

-- Bir brauzerning takror yuborishi shu juftlik bilan tanib olinadi.
create unique index if not exists uq_online_client on public.online_orders(venue_id, client_id);
create index if not exists idx_online_status on public.online_orders(venue_id, status, created_at desc);
create index if not exists idx_online_phone on public.online_orders(venue_id, customer_phone, created_at desc);

-- RLS: hech kim to'g'ridan-to'g'ri tegmaydi — faqat definer funksiyalar orqali.
alter table public.online_shops enable row level security;
alter table public.online_orders enable row level security;
revoke all on public.online_shops from anon, authenticated, public;
revoke all on public.online_orders from anon, authenticated, public;

-- ---------- 3) Mijoz tomoni: menyu, zakaz yuborish, holat ----------

-- Vitrinada faqat ochiq ko'rinadigan narsalar: nom, menyu, narx, rasm, bor-yo'qligi.
create or replace function public.online_menu(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when s.venue_id is null then null else jsonb_build_object(
    'name', v.name,
    'kind', v.kind,
    'phone', v.phone,
    'address', v.address,
    'accepting', s.accepting,
    'delivery', s.delivery,
    'min_total', s.min_total,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name, 'emoji', c.emoji, 'color', c.color,
        'products', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id, 'name', p.name, 'price', p.price, 'emoji', p.emoji,
            'photo_path', p.photo_path,
            'available', (not p.track_stock or p.stock_qty > 0)
          ) order by p.sort_order, p.name)
          from public.products p
          where p.category_id = c.id and p.venue_id = v.id and p.active
        ), '[]'::jsonb)
      ) order by c.sort_order, c.name)
      from public.categories c
      where c.venue_id = v.id
    ), '[]'::jsonb)
  ) end
  from public.online_shops s
  join public.venues v on v.id = s.venue_id
  where s.slug = lower(trim(coalesce(p_slug, ''))) and s.enabled and v.status = 'active';
$$;

-- Zakaz qabul qilish. Narx va nomlar server bazasidan olinadi — mijoz yuborgan
-- "price" hech qayerda ishlatilmaydi.
create or replace function public.online_submit(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_shop record; v_venue uuid; v_client text; v_type text;
  v_name text; v_phone text; v_address text; v_note text;
  v_items jsonb; v_rows jsonb; v_total integer; v_bad integer; v_count integer;
  v_token text; v_existing record;
begin
  if coalesce(jsonb_typeof(p), '') <> 'object' then raise exception 'BUYURTMA_BOSH'; end if;

  select * into v_shop from public.online_shops
   where slug = lower(trim(coalesce(p->>'slug', ''))) and enabled;
  if not found then raise exception 'DOKON_TOPILMADI'; end if;
  if not v_shop.accepting then raise exception 'DOKON_YOPIQ'; end if;
  -- To'xtatilgan do'konning vitrinasi ham zakaz qabul qilmaydi.
  if not exists (
    select 1 from public.venues
     where id = v_shop.venue_id and status = 'active'
  ) then raise exception 'DOKON_YOPIQ'; end if;
  v_venue := v_shop.venue_id;

  v_client := left(trim(coalesce(p->>'client_id', '')), 64);
  if char_length(v_client) < 8 then raise exception 'KOD_KERTILMADI'; end if;

  v_name := left(regexp_replace(coalesce(p->>'name', ''), '\s+', ' ', 'g'), 60);
  if char_length(trim(v_name)) < 2 then raise exception 'NOM_KERTILMADI'; end if;

  v_phone := regexp_replace(coalesce(p->>'phone', ''), '[^0-9]', '', 'g');
  if char_length(v_phone) < 9 or char_length(v_phone) > 15 then raise exception 'TELEF_NOTOGRI'; end if;

  v_type := coalesce(nullif(trim(coalesce(p->>'type', '')), ''), 'pickup');
  if v_type not in ('pickup', 'delivery') then raise exception 'TURI_NOTOGRI'; end if;
  if v_type = 'delivery' and not v_shop.delivery then raise exception 'DOKON_YETKAZMAYDI'; end if;

  v_address := left(regexp_replace(coalesce(p->>'address', ''), '\s+', ' ', 'g'), 200);
  if v_type = 'delivery' and char_length(trim(v_address)) < 5 then raise exception 'MANZIL_KERTILMADI'; end if;

  v_note := left(regexp_replace(coalesce(p->>'note', ''), '\s+', ' ', 'g'), 300);

  v_items := coalesce(p->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'BUYURTMA_BOSH';
  end if;
  if jsonb_array_length(v_items) > 30 then raise exception 'MAHSULOT_KOP'; end if;

  -- Har bir qator JSON ko'rinishda bo'lishi va ID/miqdor raqamga o'xshashi
  -- kerak — aks holda quyidagi `::uuid`/`::numeric` cast xato beradi.
  select count(*) into v_bad
  from jsonb_array_elements(v_items) as it
  where case
          when jsonb_typeof(it) <> 'object' then true
          when coalesce(it->>'product_id', '')
               !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then true
          when coalesce(it->>'qty', '') !~ '^[1-9][0-9]{0,2}(\.[0-9]{1,3})?$' then true
          else false
        end;
  if v_bad > 0 then raise exception 'MAHSULOT_TOPILMADI'; end if;

  -- Har bir qator shu do'konning faol mahsulotiga to'g'ri kelishi va miqdor
  -- chegarada bo'lishi shart: bittasi ham yaroqsiz bo'lsa butun zakaz rad etiladi.
  select count(*) into v_bad
  from (
    select (it->>'product_id')::uuid as pid, (it->>'qty')::numeric as qty
    from jsonb_array_elements(v_items) as it
  ) x
  left join public.products pr on pr.id = x.pid
  where pr.id is null or pr.venue_id is distinct from v_venue
     or not pr.active or x.qty > 99;
  if v_bad <> 0 then raise exception 'MAHSULOT_TOPILMADI'; end if;

  select count(*) into v_bad
  from (
    select (it->>'product_id')::uuid as pid, (it->>'qty')::numeric as qty
    from jsonb_array_elements(v_items) as it
  ) x
  join public.products pr on pr.id = x.pid
  where pr.track_stock and pr.stock_qty < x.qty;
  if v_bad > 0 then raise exception 'QOLDIQ_YETARLI_EMAS'; end if;

  -- Narxlar bazadan yig'iladi; summa create_order'dagi hisob bilan bir xil
  -- bo'lishi uchun har bir qator round() bilan olinadi.
  select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', pr.id, 'name', pr.name, 'price', pr.price,
      'qty', x.qty, 'total', round(pr.price * x.qty)::integer
    ) order by x.ord), '[]'::jsonb),
    coalesce(sum(round(pr.price * x.qty)), 0)::integer
    into v_rows, v_total
  from (
    select (it->>'product_id')::uuid as pid, (it->>'qty')::numeric as qty, ord
    from jsonb_array_elements(v_items) with ordinality as t(it, ord)
  ) x
  join public.products pr on pr.id = x.pid;

  if v_total < v_shop.min_total then raise exception 'MINIMUM_YETISHMADI'; end if;

  -- Bitta telefon ketma-ket urinsa, hisoblagich adashib ketmasin:
  -- qo'lfi (lock) shu telefon bo'yicha tranzaksiyalarni ketma-ket qiladi.
  perform pg_advisory_xact_lock(hashtext(v_venue::text || '|' || v_phone));

  select * into v_existing from public.online_orders
   where venue_id = v_venue and client_id = v_client;
  if found then
    return jsonb_build_object('token', v_existing.token, 'status', v_existing.status,
                              'total', v_existing.total, 'duplicated', true);
  end if;

  select count(*) into v_count from public.online_orders
   where venue_id = v_venue and customer_phone = v_phone
     and created_at > now() - interval '15 minutes';
  if v_count >= 4 then raise exception 'TEZ_ORQILA'; end if;

  select count(*) into v_count from public.online_orders
   where venue_id = v_venue and created_at > now() - interval '1 minute';
  if v_count >= 30 then raise exception 'TEZ_ORQILA'; end if;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  begin
    insert into public.online_orders(
      venue_id, token, client_id, customer_name, customer_phone,
      type, address, note, items, total
    ) values (
      v_venue, v_token, v_client, trim(v_name), v_phone,
      v_type, nullif(trim(v_address), ''), nullif(trim(v_note), ''), v_rows, v_total
    );
  exception when unique_violation then
    -- Bir vaqtda yuborilgan takror: birinchi yozuvni qaytaramiz.
    select * into v_existing from public.online_orders
     where venue_id = v_venue and client_id = v_client;
    if found then
      return jsonb_build_object('token', v_existing.token, 'status', v_existing.status,
                                'total', v_existing.total, 'duplicated', true);
    end if;
    raise;
  end;

  return jsonb_build_object('token', v_token, 'status', 'new', 'total', v_total);
end;
$$;

-- Mijoz faqat o'z tokeni bilan holatni ko'radi: telefon, manzil, xodim ismi berilmaydi.
create or replace function public.online_status(p_token text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'status', o.status,
    'total', o.total,
    'created_at', public.ts_text(o.created_at),
    'venue', v.name,
    'number', case when o.status = 'accepted' then ord.number end,
    'reason', case when o.status = 'rejected' then left(coalesce(o.reason, ''), 80) end
  )
  from public.online_orders o
  join public.venues v on v.id = o.venue_id
  left join public.orders ord on ord.id = o.order_id
  where o.token = upper(trim(coalesce(p_token, '')));
$$;

-- ---------- 4) Do'kon egasi: vitrina sozlamalari ----------

create or replace function public.online_shop_jsonb(p_venue uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
       'enabled', s.enabled, 'slug', s.slug, 'accepting', s.accepting,
       'delivery', s.delivery, 'min_total', s.min_total, 'url', '/o/' || s.slug,
       'updated_at', public.ts_text(s.updated_at)
     ) from public.online_shops s where s.venue_id = p_venue),
    jsonb_build_object('enabled', false, 'slug', null, 'accepting', true,
                       'delivery', false, 'min_total', 0, 'url', null)
  );
$$;

create or replace function public.online_get_shop()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid;
begin
  perform public.guard_role(array['owner'], 'FAQAT_EGA');
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  return public.online_shop_jsonb(v_venue);
end;
$$;

-- Vitrina yoqilganda bir marta link (slug) beriladi va o'zgarmaydi.
create or replace function public.online_set_shop(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_slug text; v_shop record;
begin
  perform public.guard_role(array['owner'], 'FAQAT_EGA');
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  if not exists (select 1 from public.online_shops where venue_id = v_venue) then
    loop
      v_slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      begin
        insert into public.online_shops(venue_id, slug, enabled, accepting, delivery, min_total)
        values (v_venue, v_slug, false, true, false, 0);
        exit;
      exception when unique_violation then continue;
      end;
    end loop;
  end if;

  update public.online_shops set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    accepting = coalesce((p->>'accepting')::boolean, accepting),
    delivery = coalesce((p->>'delivery')::boolean, delivery),
    min_total = coalesce(greatest(0, (p->>'min_total')::integer), min_total),
    updated_at = now()
  where venue_id = v_venue
  returning * into v_shop;

  return public.online_shop_jsonb(v_shop.venue_id);
end;
$$;

-- ---------- 5) Do'kon xodimi: kelgan zakazlar ----------

create or replace function public.online_list()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'token', o.token, 'name', o.customer_name, 'phone', o.customer_phone,
    'type', o.type, 'address', o.address, 'note', o.note, 'items', o.items,
    'total', o.total, 'status', o.status, 'reason', o.reason,
    'order_id', o.order_id, 'order_number', ord.number,
    'created_at', public.ts_text(o.created_at),
    'handled_at', public.ts_text(o.handled_at)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.online_orders o
  left join public.orders ord on ord.id = o.order_id
  where o.venue_id = public.current_venue_id()
    and public.current_role() in ('owner', 'cashier')
    and o.created_at > now() - interval '7 days';
$$;

-- Qabul qilish: zakaz kassada ochiq buyurtmaga aylanadi. Ikki marta bosilsa
-- ikkinchi buyurtma tug'maydi — birinchi natija qaytadi.
create or replace function public.online_accept(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_req record; v_order jsonb;
begin
  perform public.guard_role(array['owner', 'cashier']);
  select * into v_req from public.online_orders
   where id = p_id and venue_id = public.current_venue_id()
   for update;
  if not found then raise exception 'BUYURTMA_TOPILMADI'; end if;
  if v_req.status = 'accepted' then
    return jsonb_build_object('order_id', v_req.order_id, 'duplicated', true);
  end if;
  if v_req.status = 'rejected' then raise exception 'RAD_ETILGAN'; end if;

  v_order := public.create_order(jsonb_build_object(
    'type', case when v_req.type = 'delivery' then 'delivery' else 'takeaway' end,
    'items', v_req.items,
    'note', 'Onlayn: ' || v_req.customer_name || ' · ' || v_req.customer_phone
      || coalesce(' · ' || v_req.address, '')
      || coalesce(' · ' || v_req.note, ''),
    'send_to_kitchen', true
  ));

  update public.online_orders
     set status = 'accepted', order_id = (v_order->>'id')::uuid,
         handled_at = now(), handled_by = auth.uid()
   where id = p_id;

  return v_order;
end;
$$;

-- Kassa yonidagi "Yangi zakazlar" belgisi uchun eng yengil so'rov.
create or replace function public.online_pending()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
  from public.online_orders o
  where o.status = 'new'
    and o.created_at > now() - interval '2 days'
    and o.venue_id = public.current_venue_id()
    and public.current_role() in ('owner', 'cashier');
$$;

create or replace function public.online_reject(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_req record;
begin
  perform public.guard_role(array['owner', 'cashier']);
  select * into v_req from public.online_orders
   where id = p_id and venue_id = public.current_venue_id()
   for update;
  if not found then raise exception 'BUYURTMA_TOPILMADI'; end if;
  if v_req.status <> 'new' then raise exception 'FAQAT_OCHIQ_BEKOR'; end if;

  update public.online_orders
     set status = 'rejected',
         reason = left(nullif(trim(coalesce(p_reason, '')), ''), 120),
         handled_at = now(), handled_by = auth.uid()
   where id = p_id;

  return jsonb_build_object('id', p_id, 'status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7-bosqich qoidasi: PUBLIC/anon yopiladi, authenticated/service_role qaytariladi.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema public from anon;

-- Demo ariza funksiyasi anon bo'lib qoladi (yuqoridagi revoke uni ham qamrab
-- oladi), shuning uchun qayta beriladi.
grant execute on function public.submit_demo_request(text, text, text, text, text)
  to anon, authenticated, service_role;

-- Onlayn do'kon: kirmagan mijoz menyani ko'radi, buyurtma yuboradi va
-- kod orqali holatini so'raydi. Boshqa hech narsaga kirish huquqi yo'q.
grant execute on function public.online_menu(text) to anon;
grant execute on function public.online_submit(jsonb) to anon;
grant execute on function public.online_status(text) to anon;

-- Jadvallar yuqorida (RLS + revoke) yopiq qoladi: kirilmagan mijoz faqat
-- yuqoridagi uchta funksiya orqali suhbatlashadi.

notify pgrst, 'reload schema';
