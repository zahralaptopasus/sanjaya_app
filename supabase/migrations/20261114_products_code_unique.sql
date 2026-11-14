-- supabase/migrations/20261114_products_code_unique.sql
-- Jalankan di Supabase Dashboard > SQL Editor.
-- Tujuan: memastikan kode produk unik (case-insensitive, abaikan spasi tepi).
--
-- Catatan: index unik hanya dibuat jika BELUM ada kode duplikat,
-- sehingga migrasi ini aman dijalankan meskipun data lama masih ada duplikat.

do $$
begin
  if exists (
    select 1
    from public.products
    group by upper(btrim(code))
    having count(*) > 1
  ) then
    raise notice 'Masih ada kode produk duplikat. Index unik TIDAK dibuat. Rapikan dulu datanya.';
  else
    create unique index if not exists products_code_unique
      on public.products (upper(btrim(code)));
    raise notice 'Index unik products_code_unique berhasil dibuat.';
  end if;
end $$;
