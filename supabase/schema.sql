-- POS Kassa · 1-bosqich sxemasi: do'kon (venue), xodimlar (staff), taklif kodlari (invite_codes)
-- Ishlatish: Supabase dashboard → SQL Editor → yangi query → butun faylni joylab → Run.
--
-- Auth sozlamasi (bitta marta): Dashboard → Authentication → Providers → Email
-- "Confirm email" ni O'CHIRING. Aks holda ro'yxatdan o'tgandan keyin sessiya bermaydi.

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('fastfood', 'cafe')),
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'waiter', 'cashier', 'kitchen')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  role text not null check (role in ('waiter', 'cashier', 'kitchen')),
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_venue on public.staff(venue_id);
create index if not exists idx_invite_venue on public.invite_codes(venue_id);

-- ---------- Yordamchi funksiyalar (RLS takrorlanishini oldini oladi) ----------

create or replace function public.current_venue_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select venue_id from public.staff where user_id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.staff where user_id = auth.uid();
$$;

-- ---------- Ro'yxatdan o'tish funksiyalari ----------

-- Do'kon egasi: venue + owner staff kaydini bitta tranzaktsiyada yaratadi.
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

  return v_id;
end;
$$;

-- Xodim: taklif kodini ishlatib, o'sha do'konga qo'shiladi. Rol kodda yozilgan.
create or replace function public.redeem_invite(p_code text)
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

  insert into public.staff(venue_id, user_id, role)
  values (v_inv.venue_id, auth.uid(), v_inv.role);

  return v_inv.role;
end;
$$;

-- Do'kon egasi: ofitsant/kassir/oshpaz uchun 6 belgili taklif kodini chiqaradi.
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
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 6));
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

-- ---------- Qator darajasidagi xavfsizlik (RLS) ----------

alter table public.venues enable row level security;
alter table public.staff enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "venue_read" on public.venues;
drop policy if exists "venue_update" on public.venues;
drop policy if exists "staff_read" on public.staff;
drop policy if exists "staff_update" on public.staff;
drop policy if exists "invite_read" on public.invite_codes;
drop policy if exists "invite_delete" on public.invite_codes;

create policy "venue_read" on public.venues
  for select to authenticated using (id = public.current_venue_id());

create policy "venue_update" on public.venues
  for update to authenticated
  using (id = public.current_venue_id() and public.current_role() = 'owner');

-- Xodimlar bir-birini ko'radi (oshxona kimonning buyurtmasini ko'rish uchun keyin kerak bo'ladi).
create policy "staff_read" on public.staff
  for select to authenticated using (venue_id = public.current_venue_id());

create policy "staff_update" on public.staff
  for update to authenticated
  using (venue_id = public.current_venue_id() and public.current_role() = 'owner');

-- Kodlar faqat egaga ko'rinadi; yaratish va ishlatish funksiya orqali (policy yo'q).
create policy "invite_read" on public.invite_codes
  for select to authenticated
  using (venue_id = public.current_venue_id() and public.current_role() = 'owner');

create policy "invite_delete" on public.invite_codes
  for delete to authenticated
  using (venue_id = public.current_venue_id() and public.current_role() = 'owner');

revoke execute on function public.issue_invite(text) from anon;
revoke execute on function public.redeem_invite(text) from anon;
grant execute on function public.current_venue_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.register_venue(text, text, text, text) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.issue_invite(text) to authenticated;
