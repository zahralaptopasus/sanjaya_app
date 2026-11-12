-- ============================================================
-- FIX: "new row violates row-level security policy" saat upload gambar
-- Jalankan file ini di Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Penyebab: login admin lokal (admin123/123456) tidak membuat sesi Supabase,
-- sehingga upload ke bucket "product-images" dianggap role anon dan ditolak RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pastikan bucket product-images ada dan bisa dibaca publik
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- ------------------------------------------------------------
-- 2. Hapus policy lama (agar file ini aman dijalankan berulang)
-- ------------------------------------------------------------
drop policy if exists "product_images_read" on storage.objects;
drop policy if exists "product_images_insert" on storage.objects;
drop policy if exists "product_images_update" on storage.objects;
drop policy if exists "product_images_delete" on storage.objects;

-- ------------------------------------------------------------
-- 3. Izinkan baca gambar produk untuk semua orang
-- ------------------------------------------------------------
create policy "product_images_read" on storage.objects
for select
using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- 4. Izinkan upload / ubah / hapus gambar produk
--    (anon = admin lokal tanpa sesi Supabase, authenticated = user login)
--    CATATAN: ini terbuka untuk demo/tugas. Untuk produksi, batasi
--    hanya ke role authenticated / pemilik file.
-- ------------------------------------------------------------
create policy "product_images_insert" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'product-images');

create policy "product_images_update" on storage.objects
for update to anon, authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "product_images_delete" on storage.objects
for delete to anon, authenticated
using (bucket_id = 'product-images');

-- ============================================================
-- 5. OPSIONAL — agar admin lokal bisa SIMPAN barang (produk)
--    Jalankan blok ini kalau setelah upload berhasil, menyimpan
--    barang masih error "row-level security" / "permission denied".
--    Sama seperti di atas: terbuka untuk demo, jangan untuk produksi.
-- ============================================================
grant select, insert, update, delete on public.products to anon;

drop policy if exists "products_demo_write" on public.products;
create policy "products_demo_write" on public.products
for all to anon, authenticated
using (true)
with check (true);
