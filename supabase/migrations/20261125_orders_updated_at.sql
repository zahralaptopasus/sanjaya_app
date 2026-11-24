-- supabase/migrations/20261125_orders_updated_at.sql
-- Jalankan di Supabase SQL Editor SETELAH 20261120_shipping.sql
--
-- Tujuan: memastikan tabel orders punya kolom updated_at
-- (dipakai untuk mencatat waktu perubahan status pesanan).

begin;

alter table public.orders add column if not exists updated_at timestamptz default now();

update public.orders set updated_at = now() where updated_at is null;

commit;
