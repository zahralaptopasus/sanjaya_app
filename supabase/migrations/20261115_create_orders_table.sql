-- supabase/migrations/20261115_create_orders_table.sql
-- Jalankan di Supabase SQL Editor
-- Table: orders (penjualan ke pelanggan)

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,                         -- no invoice/PO
  customer text not null,                     -- nama pelanggan/username
  total numeric(10,2) not null default 0,   -- total harga
  status text not null default 'pending',     -- pending, paid, shipped, completed, cancelled
  payment_method text,                        -- midtrans, cod, transfer, dll
  payment_status text default 'unpaid',       -- unpaid, paid, refunded
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index untuk pencarian dan filter
create index if not exists idx_orders_code on public.orders(code);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_customer on public.orders(customer);
create index if not exists idx_orders_created_at on public.orders(created_at);

-- RLS: admin penuh, authenticated bisa select
alter table public.orders enable row level security;

create policy "orders_admin_all" on public.orders
  for all using (public.is_admin());

create policy "orders_auth_read" on public.orders
  for select using (auth.role() = 'authenticated' or public.is_admin());

grant all on public.orders to authenticated;
grant select on public.orders to anon;

comment on table public.orders is 'Table untuk laporan penjualan/rekapitulasi faktur';