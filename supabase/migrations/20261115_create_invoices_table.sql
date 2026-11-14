-- supabase/migrations/20261115_create_invoices_table.sql
-- Jalankan di Supabase SQL Editor
-- Table: invoices (faktur pelanggan)

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  code text not null,                         -- no faktur
  customer text not null,                     -- nama pelanggan
  amount number not null default 0,           -- jumlah tagihan
  status text not null default 'unpaid',      -- unpaid, paid, overdue
  payment_method text,                        -- midtrans, cod, transfer, dll
  paid_at timestamptz,                        -- waktu pembayaran
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index
create index if not exists idx_invoices_code on public.invoices(code);
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_created_at on public.invoices(created_at);

-- RLS
alter table public.invoices enable row level security;

create policy "invoices_admin_all" on public.invoices
  for all using (public.is_admin());

create policy "invoices_auth_read" on public.invoices
  for select using (auth.role() = 'authenticated' or public.is_admin());

grant all on public.invoices to authenticated;
grant select on public.invoices to anon;

comment on table public.invoices is 'Table untuk faktur & pembayaran pelanggan';