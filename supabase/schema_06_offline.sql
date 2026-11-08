-- 06-bosqich: OFLAYN REJIM uchun baza tayyorgarligi.
-- Mantiq: kassa internetsiz ishlaydi, buyurtmalar IndexedDB navbatida saqlanadi va
-- internet tiklanganda qayta yuboriladi. Qayta yuborish TAKRORLANMASLIGI uchun
-- har bir lokal buyurtma o'zining client_id'si bilan keladi: agar shu client_id
-- allaqachon yozilgan bo'lsa — eski buyurtma qaytariladi, yangi raqam olinmaydi.

-- ---------- 1) Buyurtmada lokal identifikator ----------

alter table public.orders add column if not exists client_id uuid;

drop index if exists public.orders_client_key;
create unique index orders_client_key
  on public.orders(venue_id, client_id)
  where client_id is not null;

comment on column public.orders.client_id is
  'Oflayndan yuborilgan buyurtmaning qurilmadagi uuid''si — qayta yuborishda takrorlanishni oldini oladi.';

-- ---------- 2) _create_order: client_id bo'yicha tekshirish ----------
-- Ima function: create_order() — guard_role o'rinbosari (05-bosqich) — o'zgarmaydi.

create or replace function public._create_order(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_venue uuid; v_id uuid; v_number integer; v_short integer;
  v_type text; v_table uuid; v_items jsonb; v_disc_pct numeric;
  v_subtotal integer; v_discount integer; v_total integer;
  v_client uuid; v_created timestamptz;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  -- Oflayn navbat: bir xil client_id bilan ikkinchi marta kelsa — joyidagi buyurtma qaytadi.
  if coalesce(p->>'client_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_client := (p->>'client_id')::uuid;
    select id into v_id from public.orders where venue_id = v_venue and client_id = v_client;
    if found then return public.order_jsonb(v_id); end if;
  end if;

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

  -- Oflaynda ochilgan buyurtma o'z vaqtida yoziladi: aks holda kechiktirib
  -- yuborilgan sotuv boshqa kunga (yoki soatga) tushib qoladi.
  -- Matn — qurilmaning mahalliy vaqti, shuning uchun do'kon zonasi orqali o'giriladi.
  if coalesce(p->>'created_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$' then
    v_created := ((p->>'created_at')::timestamp at time zone public.venue_tz())::timestamptz;
    if v_created > now() or v_created < now() - interval '2 days' then v_created := null; end if;
  end if;

  begin
    insert into public.orders(
      venue_id, number, type, table_id, status, kitchen_status,
      subtotal, discount_percent, discount, total, note, created_by, client_id, created_at
    ) values (
      v_venue, v_number, v_type, v_table, 'open',
      case when coalesce((p->>'send_to_kitchen')::boolean, false) then 'new' else 'none' end,
      v_subtotal, v_disc_pct, v_discount, v_total,
      coalesce(p->>'note', ''), auth.uid(), v_client, coalesce(v_created, now())
    )
    returning id into v_id;
  exception when unique_violation then
    -- ikki qurilma bir vaqtda qayta yubordi: birinchisi yozilgan — uni qaytaramiz
    if v_client is null then raise; end if;
    select id into v_id from public.orders where venue_id = v_venue and client_id = v_client;
    return public.order_jsonb(v_id);
  end;

  perform public.order_items_insert(v_id, v_venue, v_items);

  return public.order_jsonb(v_id);
end;
$$;

-- ---------- 3) Realtime ----------
-- Qator darajasidagi publikatsiya — yangi ustun avtomatik kiradi,
-- replica identity 'full' allaqachon o'rnatilgan (05-bosqich).

notify pgrst, 'reload schema';
