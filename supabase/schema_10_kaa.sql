-- Qoraqalpoqcha asosiy til: yangi do'konlarning chek pastidagi matni ham
-- qoraqalpoqcha bo'lsin. Faqat seed_venue o'zgadi — sxema ma'lumotlari (menyu,
-- stollar) eski holicha, egasi o'zi tahrirlaydi.
CREATE OR REPLACE FUNCTION public.seed_venue(p_venue uuid, p_kind text, p_store_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ('receipt_footer', 'Satıp alǵanıńız ushın raxmet!'),
    ('auto_print', '0')
  ) as t(k, v)
  on conflict (venue_id, key) do nothing;
end;
$function$
;
