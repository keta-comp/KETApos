-- KetaPOS · 9-bosqich: platforma egasi (super-admin) tomoni.
-- Ishlatish: DATABASE_URL=... node scripts/apply-sql.mjs supabase/schema_09_superadmin.sql
--
-- Super-admin — do'konlarni sotuvchi tomonga tegishli, jamoa tomoniga umuman
-- aralashmaydigan alohida qatlam. Ma'lumotga kirish faqat SECURITY DEFINER
-- RPC'lar orqali: RLS siyosatlari o'zgarmaydi, shuning uchun mavjud do'konlar
-- biror narsa yo'qolmaydi.
--
--   1) platform_admins — kim platforma egasi (email orqali qo'shiladi)
--   2) venues.status — faol / to'xtatilgan; to'xtatilganida yozishlar to'xtaydi,
--      o'qish islayveradi (xodim eski hisobotlarni ko'radi, yangi buyurtma ola olmaydi)
--   3) admin_* — statistika, ro'yxat, tafsilot, holat, tahrir, yangi do'kon +
--      egaga beriladigan da'vo kodi, demo arizalar, administratorlar

-- ---------- 1) Platforma administratorlari ----------

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_admins_email on public.platform_admins(lower(email));

-- RLS yoqiladi va jadval ruxsatlari yopiladi: uni to'g'ridan-to'g'ri so'roq
-- qilib bo'lmaydi, flag faqat quyidagi funksiya orqali so'raladi.
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

-- Ilova bu funksiyani chaqiradi (faqat o'zi haqida boolean qaytadi — boshqa
-- ma'lumot yo'q). Qolgan admin funksiyalari guard_platform_admin orqali tekshiradi.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins a
    where a.user_id = auth.uid() and auth.uid() is not null
  );
$$;

create or replace function public.guard_platform_admin()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  if not public.is_platform_admin() then
    raise exception 'RUXSAT_YOQ';
  end if;
end;
$$;

-- ---------- 2) Do'kon holati ----------

-- Ustun avval `add column` bilan qo'shiladi, tekshiruv qoidasi esa alohida
-- nom bilan — migratsiya qayta ishlatilganda ham xato bo'lmaydi.
alter table public.venues add column if not exists status text not null default 'active';
alter table public.venues add column if not exists notes text;

alter table public.venues drop constraint if exists venues_status_check;
alter table public.venues add constraint venues_status_check
  check (status in ('active', 'suspended'));

create index if not exists idx_venues_status on public.venues(status, created_at desc);

-- Yozish funksiyalari barchasi guard_role'ga tayanadi — shu bitta joyga
-- tekshiruv qo'shsak, to'xtatilgan do'konning HAR QANDAY yozuvi yopiladi.
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
  if public.venue_suspended(public.current_venue_id()) then
    raise exception 'DOKON_TOXTATILGAN';
  end if;
end;
$$;

-- ---------- 3) Ichki yordamchilar ----------

create or replace function public.venue_suspended(p_venue uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select v.status = 'suspended' from public.venues v where v.id = p_venue),
    false
  );
$$;

-- ---------- 4) Statistika ----------

create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_today date;
begin
  perform public.guard_platform_admin();
  v_today := (now() at time zone 'Asia/Tashkent')::date;

  return (
    with o as (
      select
        (created_at at time zone 'Asia/Tashkent')::date as day,
        status,
        total
      from public.orders
    )
    select jsonb_build_object(
      'venues', (select count(*) from public.venues),
      'venues_active', (select count(*) from public.venues where status = 'active'),
      'venues_suspended', (select count(*) from public.venues where status = 'suspended'),
      'users', (select count(*) from auth.users),
      'staff', (select count(*) from public.staff),
      'owners', (select count(*) from public.staff where role = 'owner'),
      'orders', (select count(*) from public.orders),
      'orders_today', (select count(*) from o where day = v_today and status = 'paid'),
      'orders_open', (select count(*) from public.orders where status = 'open'),
      'revenue', (select coalesce(sum(total), 0) from o where status = 'paid'),
      'revenue_today', (select coalesce(sum(total), 0) from o where status = 'paid' and day = v_today),
      'revenue_month', (
        select coalesce(sum(total), 0) from o
        where status = 'paid' and day >= date_trunc('month', v_today)::date
      ),
      'demo_new', (select count(*) from public.demo_requests where not handled),
      'demo_total', (select count(*) from public.demo_requests),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'day', to_char(d.day, 'YYYY-MM-DD'),
          'orders', coalesce(s.o, 0),
          'revenue', coalesce(s.r, 0)
        ) order by d.day), '[]'::jsonb)
        from (
          select (generate_series(v_today - 13, v_today, interval '1 day'))::date as day
        ) d
        left join (
          select day, count(*) filter (where status = 'paid') o, sum(total) filter (where status = 'paid') r
          from o group by day
        ) s on s.day = d.day
      )
    )
  );
end;
$$;

-- ---------- 5) Do'konlar ro'yxati va tafsiloti ----------

create or replace function public.admin_venues(p_query text default null, p_status text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_q text;
begin
  perform public.guard_platform_admin();
  v_q := nullif(trim(coalesce(p_query, '')), '');
  if p_status is not null and p_status not in ('active', 'suspended') then
    raise exception 'HOLAT_NOTOGRI';
  end if;

  return (
    select coalesce(jsonb_agg(x.b order by x.created_at desc), '[]'::jsonb)
    from (
      select
        v.created_at,
        jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'kind', v.kind,
          'phone', v.phone,
          'address', v.address,
          'status', v.status,
          'notes', v.notes,
          'created_at', public.ts_admin(v.created_at),
          'owner_name', coalesce(ow.display_name, owu.email, '—'),
          'owner_email', owu.email,
          -- Egasi hali bo'lmagan do'konda sotuvchi kodni qayta ko'rashi kerak:
          -- ishlatilmagan egalik kodi va uning muddati shu yerda chiqadi.
          'owner_code', oc.code,
          'code_expired', oc.expires_at is not null and oc.expires_at < now(),
          'staff_count', (select count(*) from public.staff s where s.venue_id = v.id),
          'orders', (select count(*) from public.orders o where o.venue_id = v.id),
          'orders_open', (select count(*) from public.orders o where o.venue_id = v.id and o.status = 'open'),
          'revenue', coalesce((select sum(o.total) from public.orders o where o.venue_id = v.id and o.status = 'paid'), 0),
          'last_order', public.ts_admin((select max(o.created_at) from public.orders o where o.venue_id = v.id))
        ) as b
      from public.venues v
      left join lateral (
        select s.display_name, s.user_id
        from public.staff s
        where s.venue_id = v.id and s.role = 'owner'
        order by s.created_at
        limit 1
      ) ow on true
      left join auth.users owu on owu.id = ow.user_id
      left join lateral (
        select i.code, i.expires_at
        from public.invite_codes i
        where i.venue_id = v.id and i.role = 'owner' and i.used_by is null
        order by i.created_at desc
        limit 1
      ) oc on true
      where (v_q is null
             or v.name ilike '%' || v_q || '%'
             or coalesce(v.phone, '') like '%' || v_q || '%'
             or coalesce(owu.email, '') ilike '%' || v_q || '%')
        and (p_status is null or v.status = p_status)
      order by v.created_at desc
      limit 300
    ) x
  );
end;
$$;

create or replace function public.admin_venue_detail(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_ven record;
begin
  perform public.guard_platform_admin();

  select * into v_ven from public.venues where id = p_id;
  if not found then
    raise exception 'DOKON_TOPILMADI';
  end if;

  return jsonb_build_object(
    'id', v_ven.id,
    'name', v_ven.name,
    'kind', v_ven.kind,
    'phone', v_ven.phone,
    'address', v_ven.address,
    'status', v_ven.status,
    'notes', v_ven.notes,
    'created_at', public.ts_admin(v_ven.created_at),
    'staff', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', coalesce(nullif(s.display_name, ''), u.email, '—'),
        'email', u.email,
        'role', s.role,
        'created_at', public.ts_admin(s.created_at),
        'orders', (select count(*) from public.orders o where o.venue_id = v_ven.id and o.created_by = s.user_id)
      ) order by s.created_at), '[]'::jsonb)
      from public.staff s
      left join auth.users u on u.id = s.user_id
      where s.venue_id = v_ven.id
    ),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id,
        'number', o.number,
        'type', o.type,
        'status', o.status,
        'total', o.total,
        'method', o.payment_method,
        'staff', coalesce(st.display_name, au.email, '—'),
        'created_at', public.ts_admin(o.created_at)
      ) order by o.created_at desc), '[]'::jsonb)
      from (
        select * from public.orders
        where venue_id = v_ven.id
        order by created_at desc
        limit 15
      ) o
      left join public.staff st on st.user_id = o.created_by
      left join auth.users au on au.id = o.created_by
    ),
    'totals', jsonb_build_object(
      'orders', (select count(*) from public.orders where venue_id = v_ven.id),
      'paid', (select count(*) from public.orders where venue_id = v_ven.id and status = 'paid'),
      'open', (select count(*) from public.orders where venue_id = v_ven.id and status = 'open'),
      'revenue', coalesce((select sum(total) from public.orders where venue_id = v_ven.id and status = 'paid'), 0),
      'products', (select count(*) from public.products where venue_id = v_ven.id),
      'tables', (select count(*) from public.dining_tables where venue_id = v_ven.id),
      'expenses', coalesce((select sum(amount) from public.expenses where venue_id = v_ven.id), 0),
      'last_order', public.ts_admin((select max(created_at) from public.orders where venue_id = v_ven.id))
    )
  );
end;
$$;

-- Platforma butun mamlakat bo'ylab — vaqt zonasi do'kon sozlamasiga emas,
-- O'zbekiston vaqtitga qarab yozib chiqamiz.
create or replace function public.ts_admin(p_ts timestamptz)
returns text
language sql immutable security definer set search_path = public
as $$
  select case when p_ts is null then null
              else to_char(p_ts at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI') end;
$$;

-- ---------- 6) Holat va tahrir ----------

create or replace function public.admin_set_venue_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();
  if p_status not in ('active', 'suspended') then
    raise exception 'HOLAT_NOTOGRI';
  end if;
  update public.venues set status = p_status where id = p_id;
  if not found then
    raise exception 'DOKON_TOPILMADI';
  end if;
end;
$$;

create or replace function public.admin_update_venue(p_id uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();

  if p ? 'kind' and p->>'kind' not in ('fastfood', 'cafe') then
    raise exception 'DOKON_TURI_NOTOGRI';
  end if;

  update public.venues v set
    name    = case when p ? 'name'    then nullif(trim(p->>'name'), '')       else v.name    end,
    kind    = case when p ? 'kind'    then p->>'kind'                         else v.kind    end,
    phone   = case when p ? 'phone'   then nullif(trim(p->>'phone'), '')      else v.phone   end,
    address = case when p ? 'address' then nullif(trim(p->>'address'), '')    else v.address end,
    notes   = case when p ? 'notes'   then nullif(trim(p->>'notes'), '')      else v.notes   end
  where v.id = p_id;

  if not found then
    raise exception 'DOKON_TOPILMADI';
  end if;

  -- Do'kon nomini sahifalar "store_name" sozlamasidan ham oladi — ikkisi bir xil yursin.
  if p ? 'name' and nullif(trim(p->>'name'), '') is not null then
    update public.venue_settings
    set value = trim(p->>'name')
    where venue_id = p_id and key = 'store_name';
  end if;
end;
$$;

-- ---------- 7) Demo arizalar ----------

create or replace function public.admin_demo_requests()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'phone', d.phone,
      'business', d.business,
      'note', d.note,
      'handled', d.handled,
      'created_at', public.ts_admin(d.created_at)
    ) order by d.created_at desc), '[]'::jsonb)
    from public.demo_requests d
    limit 500
  );
end;
$$;

create or replace function public.admin_set_demo_handled(p_id uuid, p_handled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();
  update public.demo_requests set handled = p_handled where id = p_id;
  if not found then
    raise exception 'ARIZA_TOPILMADI';
  end if;
end;
$$;

create or replace function public.admin_delete_demo(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();
  delete from public.demo_requests where id = p_id;
  if not found then
    raise exception 'ARIZA_TOPILMADI';
  end if;
end;
$$;

-- ---------- 8) Administratorlar ----------

create or replace function public.admin_admins()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  perform public.guard_platform_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', a.user_id,
      'email', coalesce(u.email, a.email, '—'),
      'created_at', public.ts_admin(a.created_at),
      'is_self', a.user_id = auth.uid(),
      'in_team', exists (select 1 from public.staff s where s.user_id = a.user_id)
    ) order by a.created_at), '[]'::jsonb)
    from public.platform_admins a
    left join auth.users u on u.id = a.user_id
  );
end;
$$;

-- Email akkaunt ochilgan bo'lishi kerak: platforma egasi o'zi ro'yxatdan
-- o'tkazib, keyin kod beradi — shu ketma ketlikni ilova hamda tasvirlaydi.
create or replace function public.admin_add_admin(p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_email text; v_uid uuid;
begin
  perform public.guard_platform_admin();
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'EMAIL_NOTOGRI';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    raise exception 'AKKAUNT_MAVLUD_EMAS';
  end if;

  insert into public.platform_admins(user_id, email)
  values (v_uid, v_email)
  on conflict (user_id) do update set email = excluded.email;

  return jsonb_build_object('user_id', v_uid, 'email', v_email);
end;
$$;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  perform public.guard_platform_admin();
  select count(*) into v_count from public.platform_admins;
  if v_count <= 1 then
    raise exception 'OXIRGI_ADMIN';
  end if;
  delete from public.platform_admins where user_id = p_user_id;
  if not found then
    raise exception 'ADMIN_TOPILMADI';
  end if;
end;
$$;

-- ---------- 9) Yangi do'kon + egaga da'vo kodi ----------

-- Da'vo kodi oddiy xodim kodidan farq qiladi: roli 'owner'. CHECK kengaytiriladi,
-- lekin issue_invite (xodimlar sahifasi) eski uch rolga qulflanganligi uchun
-- egalik kodini faqat platforma egasi ola oladi.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.invite_codes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%waiter%'
  loop
    execute format('alter table public.invite_codes drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.invite_codes
  add constraint invite_codes_role_check
  check (role in ('owner', 'waiter', 'cashier', 'kitchen'));

create or replace function public.admin_create_venue(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_name text; v_kind text; v_id uuid; v_code text;
begin
  perform public.guard_platform_admin();

  v_name := nullif(trim(coalesce(p->>'name', '')), '');
  if v_name is null then
    raise exception 'NOM_KERTILMADI';
  end if;
  v_kind := coalesce(nullif(trim(coalesce(p->>'kind', '')), ''), 'fastfood');
  if v_kind not in ('fastfood', 'cafe') then
    raise exception 'DOKON_TURI_NOTOGRI';
  end if;

  insert into public.venues(name, kind, phone, address)
  values (
    v_name,
    v_kind,
    nullif(trim(coalesce(p->>'phone', '')), ''),
    nullif(trim(coalesce(p->>'address', '')), '')
  )
  returning id into v_id;

  -- Yangi do'kon tayyor menyu, zonalar va sozlamalar bilan ochiladi (xuddi
  -- egasi o'zi ochgandek).
  perform public.seed_venue(v_id, v_kind, v_name);

  if nullif(trim(coalesce(p->>'notes', '')), '') is not null then
    update public.venues set notes = trim(p->>'notes') where id = v_id;
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.invite_codes(venue_id, role, code, created_by)
      values (v_id, 'owner', v_code, auth.uid());
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return jsonb_build_object('venue_id', v_id, 'name', v_name, 'code', v_code);
end;
$$;

-- Kod yo'qolsa yoki muddati o'tsa: eski ishlatilmagan egalik kodini almashtirib
-- yangisini beramiz. Egasi bor do'konga bu amal buyurilmaydi.
create or replace function public.admin_reissue_owner_code(p_venue uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_code text;
begin
  perform public.guard_platform_admin();

  if not exists (select 1 from public.venues where id = p_venue) then
    raise exception 'DOKON_TOPILMADI';
  end if;
  if exists (select 1 from public.staff s where s.venue_id = p_venue and s.role = 'owner') then
    raise exception 'DOKON_EGASI_BOR';
  end if;

  delete from public.invite_codes
  where venue_id = p_venue and role = 'owner' and used_by is null;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.invite_codes(venue_id, role, code, created_by)
      values (p_venue, 'owner', v_code, auth.uid());
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return jsonb_build_object(
    'venue_id', p_venue,
    'name', (select name from public.venues where id = p_venue),
    'code', v_code
  );
end;
$$;

-- Egalik kodini ishlatish: stolda egasi bo'lgan do'konga ikkinchi egani
-- kiritmaymiz (RLS va hisobotlar bitta egaga mo'ljallangan).
create or replace function public.redeem_invite(p_code text, p_name text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_inv record; v_tries integer; v_window timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AVVAL_KIRING';
  end if;
  if exists (select 1 from public.staff where user_id = auth.uid()) then
    raise exception 'ALLAQACHON_ULANGAN';
  end if;

  select tries, window_start into v_tries, v_window
  from public.redeem_attempts where user_id = auth.uid() for update;
  if v_window is not null and v_window < now() - interval '15 minutes' then
    delete from public.redeem_attempts where user_id = auth.uid();
    v_tries := null;
  end if;
  if coalesce(v_tries, 0) >= 15 then
    raise exception 'KO_P_URILDI';
  end if;

  select * into v_inv
  from public.invite_codes
  where code = upper(trim(p_code)) and used_by is null;

  if not found then
    insert into public.redeem_attempts(user_id, tries, window_start)
    values (auth.uid(), 1, now())
    on conflict (user_id) do update set tries = redeem_attempts.tries + 1;
    return 'KOD_NOTOGRI';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'KOD_TUGADI';
  end if;

  if v_inv.role = 'owner'
     and exists (select 1 from public.staff s where s.venue_id = v_inv.venue_id and s.role = 'owner') then
    raise exception 'DOKON_EGASI_BOR';
  end if;

  if public.venue_suspended(v_inv.venue_id) then
    raise exception 'DOKON_TOXTATILGAN';
  end if;

  delete from public.redeem_attempts where user_id = auth.uid();

  update public.invite_codes set used_by = auth.uid(), used_at = now() where id = v_inv.id;

  insert into public.staff(venue_id, user_id, role, display_name)
  values (v_inv.venue_id, auth.uid(), v_inv.role, nullif(trim(coalesce(p_name, '')), ''));

  return v_inv.role;
end;
$$;

-- Xodimlar sahifasidagi kodlar ro'yxati egalik kodlarini ko'rsatmaydi: ular
-- platforma tomonida turadi va xodimga berilsa noto'g'ri rolga olib keladi.
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
    'used_by', u.email,
    'expires_at', public.ts_text(i.expires_at),
    'expired', i.expires_at is not null and i.expires_at < now()
  ) order by i.created_at desc), '[]'::jsonb)
  from public.invite_codes i
  left join auth.users u on u.id = i.used_by
  where i.venue_id = public.current_venue_id()
    and i.role <> 'owner'
    and public.current_role() = 'owner';
$$;

-- ---------- 10) Platforma egasi hisobqatorini urug'lash ----------
-- Diqqat: bu qator emailga birinchi marta kirganda yoziladi; keyinchalik
-- administratorlar Xodimlar emas, Platforma sahifasidan qo'shiladi.

insert into public.platform_admins(user_id, email)
select u.id, u.email
from auth.users u
where lower(u.email) = 'nursultansayyora@gmail.com'
on conflict (user_id) do update set email = excluded.email;

-- ---------- 11) Ruxsatlar ----------
-- 7-bosqich qoidasi: har migratsiya oxirida PUBLIC/anon yopiladi va
-- authenticated/service_role'ga qaytariladi.

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema public from anon;

-- Demo ariza funksiyasi anon bo'lib qoladi (saytni ochgan kirmagan odam ham ariza qoldiradi).
grant execute on function public.submit_demo_request(text, text, text, text, text) to anon, authenticated, service_role;

-- Ichki yordamchilar faqat definer funksiyalar ichidan chaqiriladi:
-- venue_suspended begona do'kon holatini so'rash imkonini bermaydi.
do $$
declare v_sig text;
begin
  foreach v_sig in array array[
    'public.venue_suspended(uuid)',
    'public.guard_platform_admin()',
    'public.ts_admin(timestamp with time zone)'
  ] loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', v_sig);
      execute format('grant execute on function %s to service_role', v_sig);
    exception when undefined_function then
      raise notice 'funksiya yo‘q: %', v_sig;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
