-- 3-qadam: eski (lokal SQLite) ma'lumotni Supabase'dagi do'konga bir marta import qilish.
-- Eski ID'lar yangi uuid'larga xaritalanadi; sotilgan buyurtmalar bo'lgan do'konda import rad etiladi.

-- Eski "YYYY-MM-DD HH:MI:SS" (joyli vaqt) matnini timestamptz'ga o'tkazadi.
create or replace function public.legacy_ts(p text)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select case when nullif(p, '') is null then null
              else (p::timestamp at time zone public.venue_tz()) end;
$$;

create or replace function public.import_legacy(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_venue uuid;
  v_user  uuid;
  v_map   jsonb := '{}'::jsonb;
  r       record;
  v_id    uuid;
  v_cat   uuid;
  v_ord   uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;
  v_user := auth.uid();

  -- Import faqat bu do'konda hali hech qanday buyurtma bo'lmasa ruxsat etiladi.
  -- Ro'yxatdan o'tishda qo'yilgan boshlang'ich menyu esa o'chirib, eski ma'lumot yoziladi.
  if exists (select 1 from public.orders where venue_id = v_venue) then
    raise exception 'DOKON_TO_LI';
  end if;

  delete from public.stock_movements where venue_id = v_venue;
  delete from public.expenses       where venue_id = v_venue;
  delete from public.products       where venue_id = v_venue;
  delete from public.categories     where venue_id = v_venue;
  delete from public.dining_tables  where venue_id = v_venue;

  -- ---------- Kategoriyalar ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'categories', '[]'::jsonb)) as x(j) loop
    insert into public.categories(venue_id, name, emoji, color, sort_order)
    values (
      v_venue,
      coalesce(nullif(trim(coalesce(r.v->>'name', '')), ''), 'Kategoriya'),
      coalesce(r.v->>'emoji', ''),
      coalesce(nullif(r.v->>'color', ''), '#f97316'),
      coalesce((r.v->>'sort_order')::int, 0)
    )
    returning id into v_id;
    v_map := jsonb_set(v_map, array['cat:' || coalesce(r.v->>'id', '')], to_jsonb(v_id));
  end loop;

  -- ---------- Stollar ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'tables', '[]'::jsonb)) as x(j) loop
    insert into public.dining_tables(venue_id, name, zone, seats, sort_order)
    values (
      v_venue,
      coalesce(nullif(trim(coalesce(r.v->>'name', '')), ''), 'Stol'),
      coalesce(nullif(r.v->>'zone', ''), 'Asosiy zal'),
      coalesce((r.v->>'seats')::int, 4),
      coalesce((r.v->>'sort_order')::int, 0)
    )
    returning id into v_id;
    v_map := jsonb_set(v_map, array['tbl:' || coalesce(r.v->>'id', '')], to_jsonb(v_id));
  end loop;

  -- ---------- Mahsulotlar ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'products', '[]'::jsonb)) as x(j) loop
    v_cat := nullif(v_map #>> array['cat:' || coalesce(r.v->>'category_id', '0')], '')::uuid;
    if v_cat is null then continue; end if;

    insert into public.products(
      venue_id, category_id, name, price, emoji, active, track_stock, stock_qty, low_stock, unit, sort_order
    ) values (
      v_venue, v_cat,
      coalesce(nullif(trim(coalesce(r.v->>'name', '')), ''), 'Mahsulot'),
      coalesce((r.v->>'price')::int, 0),
      coalesce(nullif(r.v->>'emoji', ''), '🍽️'),
      case when coalesce(r.v->>'active', '1') in ('0', 'false', 'f') then false else true end,
      case when coalesce(r.v->>'track_stock', '0') in ('1', 'true', 't') then true else false end,
      coalesce((r.v->>'stock_qty')::numeric, 0),
      coalesce((r.v->>'low_stock')::numeric, 5),
      coalesce(nullif(r.v->>'unit', ''), 'dona'),
      coalesce((r.v->>'sort_order')::int, 0)
    )
    returning id into v_id;
    v_map := jsonb_set(v_map, array['prod:' || coalesce(r.v->>'id', '')], to_jsonb(v_id));
  end loop;

  -- ---------- Buyurtmalar ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'orders', '[]'::jsonb)) as x(j) loop
    insert into public.orders(
      venue_id, number, type, table_id, status, kitchen_status,
      subtotal, discount_percent, discount, total,
      payment_method, received, change_amount, note, created_by, created_at, paid_at
    ) values (
      v_venue,
      coalesce((r.v->>'number')::int, 0),
      case when r.v->>'type' in ('dine_in', 'takeaway', 'delivery') then r.v->>'type' else 'takeaway' end,
      nullif(v_map #>> array['tbl:' || coalesce(r.v->>'table_id', '0')], '')::uuid,
      case when r.v->>'status' in ('open', 'paid', 'cancelled') then r.v->>'status' else 'paid' end,
      case when r.v->>'kitchen_status' in ('none', 'new', 'cooking', 'ready', 'served')
           then r.v->>'kitchen_status' else 'none' end,
      coalesce((r.v->>'subtotal')::int, 0),
      coalesce((r.v->>'discount_percent')::numeric, 0),
      coalesce((r.v->>'discount')::int, 0),
      coalesce((r.v->>'total')::int, 0),
      case when r.v->>'payment_method' in ('cash', 'card', 'click') then r.v->>'payment_method' else null end,
      (r.v->>'received')::int,
      (r.v->>'change_amount')::int,
      coalesce(r.v->>'note', ''),
      v_user,
      coalesce(public.legacy_ts(r.v->>'created_at'), now()),
      public.legacy_ts(r.v->>'paid_at')
    )
    returning id into v_id;
    v_map := jsonb_set(v_map, array['ord:' || coalesce(r.v->>'id', '')], to_jsonb(v_id));
  end loop;

  -- ---------- Buyurtma tarkibi ----------
  for r in
    select j as v, n as ord
    from jsonb_array_elements(coalesce(p->'order_items', '[]'::jsonb)) with ordinality as x(j, n)
  loop
    v_ord := nullif(v_map #>> array['ord:' || coalesce(r.v->>'order_id', '0')], '')::uuid;
    if v_ord is null then continue; end if;

    insert into public.order_items(venue_id, order_id, product_id, name, price, qty, total, note, sort)
    values (
      v_venue, v_ord,
      nullif(v_map #>> array['prod:' || coalesce(r.v->>'product_id', '0')], '')::uuid,
      coalesce(nullif(trim(coalesce(r.v->>'name', '')), ''), 'Mahsulot'),
      coalesce((r.v->>'price')::int, 0),
      greatest(coalesce((r.v->>'qty')::numeric, 1), 0.001),
      coalesce((r.v->>'total')::int, 0),
      coalesce(r.v->>'note', ''),
      r.ord
    );
  end loop;

  -- ---------- Ombor harakatlari ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'stock_movements', '[]'::jsonb)) as x(j) loop
    v_id := nullif(v_map #>> array['prod:' || coalesce(r.v->>'product_id', '0')], '')::uuid;
    if v_id is null then continue; end if;

    insert into public.stock_movements(venue_id, product_id, delta, reason, note, order_id, created_at)
    values (
      v_venue, v_id,
      coalesce((r.v->>'delta')::numeric, 0),
      case when r.v->>'reason' in ('sale', 'kirim', 'chiqim') then r.v->>'reason' else 'chiqim' end,
      coalesce(r.v->>'note', ''),
      nullif(v_map #>> array['ord:' || coalesce(r.v->>'order_id', '0')], '')::uuid,
      coalesce(public.legacy_ts(r.v->>'created_at'), now())
    );
  end loop;

  -- ---------- Xarajatlar ----------
  for r in select j as v from jsonb_array_elements(coalesce(p->'expenses', '[]'::jsonb)) as x(j) loop
    insert into public.expenses(venue_id, title, amount, category, created_at)
    values (
      v_venue,
      coalesce(nullif(trim(coalesce(r.v->>'title', '')), ''), 'Xarajat'),
      greatest(coalesce((r.v->>'amount')::int, 0), 1),
      coalesce(nullif(r.v->>'category', ''), 'Boshqa'),
      coalesce(public.legacy_ts(r.v->>'created_at'), now())
    );
  end loop;

  -- ---------- Sozlamalar ----------
  if jsonb_typeof(coalesce(p->'settings', 'null'::jsonb)) = 'object' then
    for r in select k from jsonb_object_keys(p->'settings') as x(k) loop
      if r.k = 'next_order_number' then continue; end if;
      insert into public.venue_settings(venue_id, key, value)
      values (v_venue, r.k, p->'settings'->>r.k)
      on conflict (venue_id, key) do update
        set value = excluded.value, updated_at = now();
    end loop;
  end if;

  -- ---------- Buyurtma raqami hisoblagichi ----------
  insert into public.order_counters(venue_id, next_number)
  values (v_venue, (select coalesce(max(number), 1000) + 1 from public.orders where venue_id = v_venue))
  on conflict (venue_id) do update
    set next_number = greatest(order_counters.next_number, excluded.next_number);

  return jsonb_build_object(
    'categories',    (select count(*) from public.categories where venue_id = v_venue),
    'products',      (select count(*) from public.products where venue_id = v_venue),
    'tables',        (select count(*) from public.dining_tables where venue_id = v_venue),
    'orders',        (select count(*) from public.orders where venue_id = v_venue),
    'order_items',   (select count(*) from public.order_items where venue_id = v_venue),
    'movements',     (select count(*) from public.stock_movements where venue_id = v_venue),
    'expenses',      (select count(*) from public.expenses where venue_id = v_venue)
  );
end;
$$;

revoke execute on function public.legacy_ts(text)               from public, anon;
revoke execute on function public.import_legacy(p jsonb)        from public, anon;
grant  execute on function public.legacy_ts(text)               to authenticated, service_role;
grant  execute on function public.import_legacy(p jsonb)        to authenticated, service_role;

notify pgrst, 'reload schema';
