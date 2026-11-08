-- 4-qadam: mahsulot rasmlari (Supabase Storage) + photo_path ustuni.
-- Rasm fayllari "product-images" bucket'ida, yo'l: <venue_id>/<product_id>.jpg
-- Bazada faqat qisqa yo'l saqlanadi — shuning uchun ro'yxat so'rovlari yengil qoladi.

alter table public.products
  add column if not exists photo_path text;

-- Bucket yo'q bo'lsa ham sxema ishlaydi: bucket Dashboard/API orqali ochiladi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Rasm o'qish: bu bucketdagi fayllar ochiq (menyu rasmlari maxfiy emas).
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Rasm yozish/update: faqat o'z do'koni papkasiga, tizimga kirgan foydalanuvchi.
drop policy if exists "product_images_insert_own_venue" on storage.objects;
create policy "product_images_insert_own_venue" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = public.current_venue_id()::text
    and split_part(name, '/', 2) <> ''
  );

drop policy if exists "product_images_update_own_venue" on storage.objects;
create policy "product_images_update_own_venue" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = public.current_venue_id()::text
  )
  with check (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = public.current_venue_id()::text
  );

drop policy if exists "product_images_delete_own_venue" on storage.objects;
create policy "product_images_delete_own_venue" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = public.current_venue_id()::text
  );

-- photo_path: faqat shu do'kon mahsulotiga, faqat o'z papkasidagi fayl yo'li.
create or replace function public.set_product_photo(p_product uuid, p_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid;
begin
  v_venue := public.current_venue_id();
  if v_venue is null then raise exception 'AVVAL_KIRING'; end if;

  if not exists (select 1 from public.products where id = p_product and venue_id = v_venue) then
    raise exception 'MAHSULOT_TOPILMADI';
  end if;

  if p_path is not null and split_part(p_path, '/', 1) <> v_venue::text then
    raise exception 'RASM_PAPKASI_NOTOGRI';
  end if;

  update public.products set photo_path = p_path where id = p_product;
end;
$$;

-- Ro'yxat endi photo_path ham qaytaradi (rasm bor-yo'qligini shundan bilamiz).
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
    'sort_order', p.sort_order, 'photo_path', p.photo_path,
    'category_name', c.name, 'category_color', c.color
  ) order by p.sort_order, p.id), '[]'::jsonb)
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.venue_id = public.current_venue_id()
    and (p_active_only is not true or p.active)
    and (p_category_id is null or p.category_id = pos_products.p_category_id);
$$;

revoke execute on function public.set_product_photo(uuid, text) from public, anon;
grant  execute on function public.set_product_photo(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
