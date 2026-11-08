-- KetaPOS · 5-bosqich: jamoa — rollar bo'yicha ruxsat, xodimlar boshqaruvi va Realtime.
-- Ishlatish: node scripts/apply-sql.mjs supabase/schema_05_team.sql  (DATABASE_URL bilan)
--
-- Bu fayl eski migratsiyalarni buzmaydi: yozish funksiyalarini "ichiga o'ramaydi",
-- balki ularni _old nomi bilan qayta atab, ustidan bir xil nomli tekshiruv qatlamini qo'yadi.

-- ---------- 1) Rol tekshiruvi ----------

create or replace function public.guard_role(p_allowed text[], p_msg text default 'RUXSAT_YOQ')
returns void
language plpgsql stable security definer set search_path = public
as $$
declare v_role text;
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  v_role := public.current_role();
  if v_role is null or not (v_role = any (p_allowed)) then
    raise exception using message = p_msg;
  end if;
end;
$$;

-- ---------- 2) Yozish funksiyalarini _old nomiga ko'chirish ----------

do $$
declare
  v_names text[] := array[
    'add_category', 'update_category', 'delete_category',
    'add_product', 'update_product', 'delete_product', 'set_product_photo',
    'add_table', 'update_table', 'delete_table',
    'stock_in', 'stock_out',
    'add_expense', 'delete_expense',
    'save_settings', 'import_legacy',
    'create_order', 'update_order', 'pay_order', 'cancel_order',
    'send_to_kitchen', 'set_kitchen_status'
  ];
  v text; v_args text;
begin
  foreach v in array v_names loop
    select pg_get_function_identity_arguments(p.oid) into v_args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v;

    if v_args is null then
      continue; -- bu muhitda funksiya yo'q
    end if;

    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '_' || v
    ) then
      execute format('alter function public.%I(%s) rename to %I', v, v_args, '_' || v);
    end if;
  end loop;
end;
$$;

-- ---------- 3) Ruxsat qatlami (bir xil nom, bir xil imzo) ----------
-- Egasi: menyu, stollar, ombor, xarajat, sozlama, import.
-- Kassir/ofitsant: buyurtma; kassir: to'lov va bekor qilish; oshxona: faqat tayyorlash holati.

create or replace function public.add_category(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._add_category(p);
end; $$;

create or replace function public.update_category(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._update_category(p_id, p);
end; $$;

create or replace function public.delete_category(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._delete_category(p_id);
end; $$;

create or replace function public.add_product(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._add_product(p);
end; $$;

create or replace function public.update_product(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._update_product(p_id, p);
end; $$;

create or replace function public.delete_product(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._delete_product(p_id);
end; $$;

create or replace function public.set_product_photo(p_product uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._set_product_photo(p_product, p_path);
end; $$;

create or replace function public.add_table(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._add_table(p);
end; $$;

create or replace function public.update_table(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._update_table(p_id, p);
end; $$;

create or replace function public.delete_table(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._delete_table(p_id);
end; $$;

create or replace function public.stock_in(p_product uuid, p_qty numeric, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._stock_in(p_product, p_qty, p_note);
end; $$;

create or replace function public.stock_out(p_product uuid, p_qty numeric, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._stock_out(p_product, p_qty, p_note);
end; $$;

create or replace function public.add_expense(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._add_expense(p);
end; $$;

create or replace function public.delete_expense(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._delete_expense(p_id);
end; $$;

create or replace function public.save_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  perform public._save_settings(p);
end; $$;

create or replace function public.import_legacy(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner']);
  return public._import_legacy(p);
end; $$;

create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'waiter', 'cashier']);
  return public._create_order(p);
end; $$;

create or replace function public.update_order(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'waiter', 'cashier']);
  return public._update_order(p_id, p);
end; $$;

create or replace function public.pay_order(p_id uuid, p_method text, p_received integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'cashier']);
  return public._pay_order(p_id, p_method, p_received);
end; $$;

create or replace function public.cancel_order(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'cashier']);
  perform public._cancel_order(p_id);
end; $$;

create or replace function public.send_to_kitchen(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'waiter', 'cashier', 'kitchen']);
  return public._send_to_kitchen(p_id);
end; $$;

create or replace function public.set_kitchen_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.guard_role(array['owner', 'waiter', 'kitchen']);
  perform public._set_kitchen_status(p_id, p_status);
end; $$;

-- ---------- 4) Buyurtmada kim ochgani ko'rinadi ----------

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
      o.created_by,
      coalesce(nullif(trim(st.display_name), ''), 'Xodim') as staff_name,
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
    left join public.staff st on st.user_id = o.created_by
    where o.id = p_id and o.venue_id = public.current_venue_id()
  ) t;
$$;

-- ---------- 5) Egasi avval akkaunt, keyin do'kon ochadi (ism ham saqlanadi) ----------

drop function if exists public.register_venue(text, text, text, text);

create or replace function public.register_venue(
  p_name text,
  p_kind text,
  p_phone text default null,
  p_address text default null,
  p_owner_name text default null
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

  insert into public.staff(venue_id, user_id, role, display_name)
  values (v_id, auth.uid(), 'owner', nullif(trim(coalesce(p_owner_name, '')), ''));

  perform public.seed_venue(v_id, p_kind, trim(p_name));

  return v_id;
end;
$$;

drop function if exists public.redeem_invite(text);

create or replace function public.redeem_invite(p_code text, p_name text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_inv record;
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  if exists (select 1 from public.staff where user_id = auth.uid()) then
    raise exception 'ALLAQACHON_ULANGAN';
  end if;

  select * into v_inv
  from public.invite_codes
  where code = upper(trim(p_code)) and used_by is null;

  if not found then
    raise exception 'KOD_NOTOGRI';
  end if;

  update public.invite_codes set used_by = auth.uid(), used_at = now() where id = v_inv.id;

  insert into public.staff(venue_id, user_id, role, display_name)
  values (v_inv.venue_id, auth.uid(), v_inv.role, nullif(trim(coalesce(p_name, '')), ''));

  return v_inv.role;
end;
$$;

-- ---------- 6) Xodimlar va taklif kodlarini boshqarish ----------

create or replace function public.pos_staff()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'role', s.role,
    'display_name', coalesce(nullif(trim(s.display_name), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Xodim'),
    'email', u.email,
    'created_at', public.ts_text(s.created_at),
    'is_self', s.user_id = auth.uid()
  ) order by (s.role = 'owner') desc, s.created_at), '[]'::jsonb)
  from public.staff s
  left join auth.users u on u.id = s.user_id
  where s.venue_id = public.current_venue_id()
    and public.current_role() = 'owner';
$$;

create or replace function public.pos_invites()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'role', i.role,
    'code', i.code,
    'created_at', public.ts_text(i.created_at),
    'used_at', public.ts_text(i.used_at),
    'used_by', u.email
  ) order by i.created_at desc), '[]'::jsonb)
  from public.invite_codes i
  left join auth.users u on u.id = i.used_by
  where i.venue_id = public.current_venue_id()
    and public.current_role() = 'owner';
$$;

create or replace function public.revoke_invite(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_role(array['owner']);
  delete from public.invite_codes
  where id = p_id and venue_id = public.current_venue_id() and used_by is null;
end;
$$;

create or replace function public.update_staff(p_id uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v record; v_role text;
begin
  perform public.guard_role(array['owner']);

  select * into v from public.staff where id = p_id and venue_id = public.current_venue_id();
  if not found then
    raise exception 'XODIM_TOPILMADI';
  end if;
  if v.role = 'owner' then
    raise exception 'EGA_NOTOGRIDAN';
  end if;

  if p ? 'role' then
    v_role := p->>'role';
    if v_role not in ('waiter', 'cashier', 'kitchen') then
      raise exception 'ROL_NOTOGRI';
    end if;
    update public.staff set role = v_role where id = p_id;
  end if;

  if p ? 'display_name' then
    update public.staff
    set display_name = nullif(trim(coalesce(p->>'display_name', '')), '')
    where id = p_id;
  end if;
end;
$$;

create or replace function public.remove_staff(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v record;
begin
  perform public.guard_role(array['owner']);

  select * into v from public.staff where id = p_id and venue_id = public.current_venue_id();
  if not found then
    raise exception 'XODIM_TOPILMADI';
  end if;
  if v.role = 'owner' then
    raise exception 'EGA_NOTOGRIDAN';
  end if;

  delete from public.staff where id = p_id;
end;
$$;

-- Har qanday xodim o'z ismini o'zi yozadi (stoldagi "kim ochgan" uchun kerak).
create or replace function public.set_my_name(p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  update public.staff
  set display_name = nullif(trim(coalesce(p_name, '')), '')
  where user_id = auth.uid();
end;
$$;

-- Do'kon xodimlariga stoldagi buyurtmalar bo'yicha qisqacha statistika (Xodimlar sahifasi).
create or replace function public.pos_staff_activity()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(
    x.created_by::text,
    jsonb_build_object('orders', x.orders, 'total', x.total)
  ), '{}'::jsonb)
  from (
    select o.created_by,
           count(*) as orders,
           coalesce(sum(o.total) filter (where o.status = 'paid'), 0) as total
    from public.orders o
    where o.venue_id = public.current_venue_id()
      and public.current_role() = 'owner'
      and o.created_by is not null
      and o.created_at >= (date_trunc('day', now() at time zone public.venue_tz()) at time zone public.venue_tz())
    group by o.created_by
  ) x;
$$;

-- ---------- 7) Realtime: bir necha qurilma bir vaqtda ----------

do $$
declare
  v_tables text[] := array[
    'orders', 'order_items', 'dining_tables',
    'products', 'categories', 'stock_movements', 'expenses'
  ];
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array v_tables loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Xodimlar ro'yxati va kodlar ham jonli yangilanishi uchun.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'staff'
  ) then
    alter publication supabase_realtime add table public.staff;
  end if;
end;
$$;

-- ---------- 8) Ruxsatlar ----------

grant usage on schema public to authenticated;
grant select on
  public.categories, public.products, public.dining_tables, public.orders,
  public.order_items, public.stock_movements, public.expenses,
  public.venue_settings, public.order_counters, public.staff, public.invite_codes
to authenticated;

grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema public from anon;

-- Ichki (_old) funksiyalar to'g'ridan-to'g'ri chaqirilmaydi: faqat qatlam orqali.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and left(p.proname, 1) = '_'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig::text);
    execute format('grant execute on function %s to service_role', r.sig::text);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
