-- KetaPOS · 7-bosqich: xavfsizlik mustahkamlashi (xafsizlik tekshiruvining natijasi).
--   1) Anon (tizimga kirmagan) har qanday funksiyani chaqira olmasligi — hozircha
--      funksiyalarning ichida auth.uid() tekshiruvi bor, lekin bu tashqi darvozani yopamiz.
--   2) Taklif kodini kuchaytirish: 6 → 12 belgi, 7 kunlik muddat va urinishlar limiti.
-- Ishlatish: DATABASE_URL=... node scripts/apply-sql.mjs supabase/schema_07_security.sql

-- ---------- 1) Taklif kodiga muddat ----------

alter table public.invite_codes add column if not exists expires_at timestamptz;
alter table public.invite_codes alter column expires_at set default (now() + interval '7 days');

-- Mavjud kodlarga ham muddat: ishlatilmaganlari 7 kun, tarixdagi ishlatilganlari o'sha kuni.
update public.invite_codes set expires_at = coalesce(used_at, created_at) + interval '7 days'
  where expires_at is null;

create index if not exists idx_invite_code_lookup on public.invite_codes(code) where used_by is null;

-- Kod tanlab ko'rishni ushlaydigan hisoblagich (faqat definer funksiyalar tegishadi).
create table if not exists public.redeem_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tries integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.redeem_attempts enable row level security;

-- ---------- 2) Kod: 12 belgi, kriptografik manbadan ----------

create or replace function public.issue_invite(p_role text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_code text;
begin
  v_venue := public.current_venue_id();
  if v_venue is null or public.current_role() is distinct from 'owner' then
    raise exception 'FAQAT_EGA';
  end if;
  if p_role not in ('waiter', 'cashier', 'kitchen') then
    raise exception 'ROL_NOTOGRI';
  end if;

  loop
    -- gen_random_uuid() — kirpik manbasi tizimdan: taxmin qilib bo'lmaydigan kod.
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.invite_codes(venue_id, role, code, created_by)
      values (v_venue, p_role, v_code, auth.uid());
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return v_code;
end;
$$;

-- Diqqat: xato `raise exception` butun tranzaksiyani qaytarib yuboradi, shuning
-- uchun hisoblagich yozuvi ham yo'qoladi. Shu sababli noto'g'ri kodda funksiya
-- XATO qaytarmaydi — qiymat sifatida 'KOD_NOTOGRI' yuboradi (client taraf
-- xabarga aylantiradi) va hisoblagich shu tranzaksiyada saqlanib qoladi.
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
    -- window_start birinchi urinishda qoladi: 15 daqiqalik oyna surilmaydi.
    insert into public.redeem_attempts(user_id, tries, window_start)
    values (auth.uid(), 1, now())
    on conflict (user_id) do update set tries = redeem_attempts.tries + 1;
    return 'KOD_NOTOGRI';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'KOD_TUGADI';
  end if;

  delete from public.redeem_attempts where user_id = auth.uid();

  update public.invite_codes set used_by = auth.uid(), used_at = now() where id = v_inv.id;

  insert into public.staff(venue_id, user_id, role, display_name)
  values (v_inv.venue_id, auth.uid(), v_inv.role, nullif(trim(coalesce(p_name, '')), ''));

  return v_inv.role;
end;
$$;

-- Egasi kod ro'yxatida muddat ko'rinsin.
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
    and public.current_role() = 'owner';
$$;

-- ---------- 3) Ruxsatlar: PUBLIC va anon butunlay olib tashlanadi ----------
-- Diqqat: Postgres HAR BIR `create function`ni avtomatik PUBLIC'ga EXECUTE
-- bilan yaratadi — `alter default privileges` buni to'xtatmaydi. Shuning uchun
-- har bir YANGI sxema faylining oxiri shu uchta buyruq bilan tugashi kerak:
--   revoke execute on all functions in schema public from public, anon;
--   grant execute on all functions in schema public to authenticated, service_role;
--   revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
revoke execute on all functions in schema public from public, anon;

grant usage on schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema public from anon;

-- Ichki (_old) qatlam faqat yuqoridagi qoplama orqali chaqiriladi.
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

-- ---------- 4) Ichki yordamchilar: faqat definer funksiyalar ichidan ----------
-- Bularda do'kon id'si parametrda keladi (claim_order_number, seed_venue,
-- order_items_insert). Ilova ularni to'g'ridan-to'g'ri chaqirmaydi — yopiq
-- bo'lsa, begona venue_id bilan yozish imkoniyati ham qolmaydi.

do $$
declare v_sig text;
begin
  foreach v_sig in array array[
    'public.claim_order_number(uuid)',
    'public.order_items_insert(uuid,uuid,jsonb)',
    'public.seed_venue(uuid,text,text)',
    'public.order_jsonb(uuid)',
    'public.guard_role(text[],text)',
    'public.legacy_ts(text)',
    'public.ts_text(timestamp with time zone)',
    'public.ts_date(timestamp with time zone)',
    'public.venue_tz()'
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
