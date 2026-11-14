-- supabase/migrations/20261115_create_shipments_table.sql
-- Jalankan di Supabase SQL Editor
-- Table: shipments (pengiriman & ekspedisi)

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  customer text not null,                     -- nama pelanggan
  address text,                               -- alamat lengkap
  courier text,                               -- nama kurir (jne, gosend, ds.)
  tracking_number text,                       -- no resi pengiriman
  status text not null default 'dikirim',     -- dikirim, dalam_perjalanan, tiba, batal
  shipped_at timestamptz,                     -- waktu dikirim
  delivered_at timestamptz,                   -- waktu tiba
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index
create index if not exists idx_shipments_order_id on public.shipments(order_id);
create index if not exists idx_shipments_tracking on public.shipments(tracking_number);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_shipments_created_at on public.shipments(created_at);

-- RLS
alter table public.shipments enable row level security;

create policy "shipments_admin_all" on public.shipments
  for all using (public.is_admin());

create policy "shipments_auth_read" on public.shipments
  for select using (auth.role() = 'authenticated' or public.is_admin());

grant all on public.shipments to authenticated;
grant select on public.shipments to anon;

comment on table public.shipments is 'Table untuk laporan pengiriman & ekspedisi';