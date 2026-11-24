-- supabase/migrations/20261120_shipping.sql
-- Jalankan di Supabase SQL Editor SETELAH 20261107_cod_payment.sql
--
-- Tujuan: menambah fitur pengiriman:
--   1) tabel shipping_couriers (ekspedisi + ongkir, dikelola admin)
--   2) kolom alamat/ongkir/kurir pada orders (snapshot agar data order stabil)
--   3) status order baru: 'dikirim', 'selesai'
--   4) RPC create_order_with_items menerima ongkir + snapshot alamat

begin;

-- ============================================================
-- 1) TABEL EKSPEDISI
-- ============================================================
create table if not exists public.shipping_couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_couriers enable row level security;

-- semua user login boleh melihat ekspedisi
drop policy if exists shipping_couriers_select on public.shipping_couriers;
create policy shipping_couriers_select on public.shipping_couriers
  for select to authenticated using (true);

-- hanya admin yang boleh menulis
drop policy if exists shipping_couriers_admin on public.shipping_couriers;
create policy shipping_couriers_admin on public.shipping_couriers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 2) KOLOM PENGIRIMAN PADA ORDERS
-- ============================================================
alter table public.orders add column if not exists address_id uuid;
alter table public.orders add column if not exists shipping_name text;
alter table public.orders add column if not exists shipping_phone text;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists courier_id uuid;
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists shipping_cost int not null default 0;
alter table public.orders add column if not exists tracking_number text;

-- ============================================================
-- 3) STATUS ORDER BARU
-- ============================================================
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'dikirim', 'selesai'));

-- ============================================================
-- 4) RPC CREATE ORDER + ONGKIR + SNAPSHOT ALAMAT
--    (versi lama 4 argumen dihapus agar tidak ambigu)
-- ============================================================
drop function if exists public.create_order_with_items(text, jsonb, int, text);

create or replace function public.create_order_with_items(
  p_code text,
  p_items jsonb,
  p_discount int default 0,
  p_payment_method text default 'midtrans',
  p_shipping_cost int default 0,
  p_address jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal int;
  v_method text;
  v_item jsonb;
  v_pid uuid;
  v_qty int;
  v_ship int;
  v_addr_id uuid;
begin
  -- hanya izinkan dua metode pembayaran yang dikenal
  v_method := case
    when lower(coalesce(p_payment_method, 'midtrans')) = 'cod' then 'cod'
    else 'midtrans'
  end;

  -- ongkir tidak boleh negatif
  v_ship := greatest(0, coalesce(p_shipping_cost, 0));

  -- subtotal dari item
  select sum((item->>'price')::int * (item->>'qty')::int)
  into v_subtotal
  from jsonb_array_elements(p_items) item;

  -- ambil address_id bila ada (validasi uuid agar tidak error)
  v_addr_id := null;
  if p_address is not null and (p_address->>'address_id') is not null then
    begin
      v_addr_id := (p_address->>'address_id')::uuid;
    exception when others then
      v_addr_id := null;
    end;
  end if;

  -- insert order (total = subtotal - diskon + ongkir); status pending untuk kedua metode
  insert into public.orders (
    user_id, code, status, total, discount, payment_method,
    address_id, shipping_name, shipping_phone, shipping_address,
    courier_id, courier_name, shipping_cost
  )
  values (
    auth.uid(), p_code, 'pending',
    greatest(0, v_subtotal - coalesce(p_discount, 0)) + v_ship,
    coalesce(p_discount, 0), v_method,
    v_addr_id,
    p_address->>'name',
    p_address->>'phone',
    p_address->>'address',
    nullif(p_address->>'courier_id', '')::uuid,
    p_address->>'courier_name',
    v_ship
  )
  returning id into v_order_id;

  -- loop item: simpan detail, kurangi stok, catat aliran keluar
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::int;

    insert into public.order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_pid, v_item->>'name', v_qty, (v_item->>'price')::int);

    perform public.apply_stock('out', v_pid, v_qty);

    insert into public.stock_movements (product_id, product_name, movement_type, qty, note, admin_name)
    values (v_pid, v_item->>'name', 'out', v_qty, p_code, 'Sistem (Order)');
  end loop;

  return v_order_id;
exception
  when sqlstate 'P0001' then
    raise exception 'stok_kurang';
  when others then
    raise;
end $$;

grant execute on function public.create_order_with_items(text, jsonb, int, text, int, jsonb) to authenticated;

commit;
