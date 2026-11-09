-- KetaPOS · 8-bosqich: tanituv sahifasidagi demo arizalari.
-- Landing'dagi forma haqiqiy backendga yozadi — soxta "yuborildi" xabari yo'q.
-- Anon (tizimga kirmagan) faqat bitta funksiyani chaqira oladi: submit_demo_request.
-- Ishlatish: DATABASE_URL=... node scripts/apply-sql.mjs supabase/schema_08_demo.sql

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  business text not null check (business in ('cafe', 'restaurant', 'fastfood')),
  note text,
  handled boolean not null default false
);

-- RLS yoqiladi, siyosat yo'q: hech kim jadvalni o'qiy olmaydi, yozish faqat
-- quyidagi definer funksiya orqali. Arizalarni egasi Supabase → Table Editor'da ko'radi.
alter table public.demo_requests enable row level security;

-- RLS ustiga jadval ruxsatlarini ham yopamiz: Supabase yangi jadvalga anon va
-- authenticated'ga avtomatik barcha ruxsatni beradi. Anon faqat funksiya
-- orqali yozadi — bekorchi to'g'ridan-to'g'ri INSERT/SELECT qila olmasin.
revoke all on table public.demo_requests from anon, authenticated;

create index if not exists idx_demo_requests_created on public.demo_requests(created_at desc);
create index if not exists idx_demo_requests_phone on public.demo_requests(phone, created_at desc);

create or replace function public.submit_demo_request(
  p_name text,
  p_phone text,
  p_business text,
  p_note text default null,
  p_trap text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_phone text; v_count integer;
begin
  -- Honeypot: botlar to'ldiradigan yashin maydon — to'lsa, jimgina yo'q qilinadi.
  if nullif(trim(coalesce(p_trap, '')), '') is not null then
    return;
  end if;

  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
    raise exception 'ISM_KERTILMADI';
  end if;

  if p_business not in ('cafe', 'restaurant', 'fastfood') then
    raise exception 'BIZNES_TURI_NOTOGRI';
  end if;

  -- O'zbekiston raqami: +998 77 763 02 16 / 8 77 763 02 16 / 77 763 02 16 → +998777630216
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if v_phone like '998%' then v_phone := substr(v_phone, 4); end if;
  if length(v_phone) = 10 and left(v_phone, 1) = '0' then v_phone := substr(v_phone, 2); end if;
  if length(v_phone) = 10 and left(v_phone, 1) = '8' then v_phone := substr(v_phone, 2); end if;
  if length(v_phone) <> 9
     or substr(v_phone, 1, 2) not in ('77','88','90','91','93','94','95','97','98','99','33','50','64','66','85','96') then
    raise exception 'TELEFON_NOTOGRI';
  end if;
  v_phone := '+998' || v_phone;

  -- Bitta raqamdan soatiga 3 ta ariza — spamdan keyin qolgan ariza ham ko'rinadi.
  select count(*) into v_count
  from public.demo_requests
  where phone = v_phone and created_at > now() - interval '1 hour';
  if v_count >= 3 then
    raise exception 'KO_P_URILDI';
  end if;

  insert into public.demo_requests(name, phone, business, note)
  values (trim(p_name), v_phone, p_business, nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

-- 7-bosqich qoidasi: har bir migratsiya oxirida PUBLIC/anon yopiladi...
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on all functions in schema public from anon;

-- ...va shu joyda faqat demo ariza funksiyasi anon'ga qaytariladi: saytni
-- ochgan odam hali akkaunt ochmagan, lekin ariza qoldira olishi kerak.
grant execute on function public.submit_demo_request(text, text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
