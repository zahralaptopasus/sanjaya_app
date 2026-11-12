-- supabase/migrations/20261107_cod_payment.sql
-- Jalankan di Supabase SQL Editor SETELAH 007_stock_flow_auto.sql
--
-- Tujuan: menambah metode pembayaran Tunai / Bayar di Tempat (COD)
-- tanpa mengubah alur Midtrans. COD tetap memakai status 'pending'
-- sampai admin mengonfirmasi uang tunai diterima (status menjadi 'paid').

begin;

-- ============================================================
-- 1) KOLOM payment_method PADA ORDERS
-- ============================================================
alter table public.orders add column if not exists payment_method text;

-- rapikan data lama: kosong / nilai tak dikenal dianggap Midtrans
update public.orders
set payment_method = 'midtrans'
where payment_method is null
   or payment_method not in ('midtrans', 'cod');

alter table public.orders alter column payment_method set default 'midtrans';
alter table public.orders alter column payment_method set not null;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('midtrans', 'cod'));

-- ============================================================
-- 2) RPC CREATE ORDER + METODE PEMBAYARAN
--    (versi lama 2 & 3 argumen dihapus agar tidak ambigu)
-- ============================================================
drop function if exists public.create_order_with_items(text, jsonb);
drop function if exists public.create_order_with_items(text, jsonb, int);

create or replace function public.create_order_with_items(
  p_code text,
  p_items jsonb,
  p_discount int default 0,
  p_payment_method text default 'midtrans'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total int;
  v_item jsonb;
  v_pid uuid;
  v_qty int;
  v_method text;
begin
  -- hanya izinkan dua metode pembayaran yang dikenal
  v_method := case
    when lower(coalesce(p_payment_method, 'midtrans')) = 'cod' then 'cod'
    else 'midtrans'
  end;

  -- subtotal dari item
  select sum((item->>'price')::int * (item->>'qty')::int)
  into v_total
  from jsonb_array_elements(p_items) item;

  -- insert order (total setelah diskon); status tetap pending untuk kedua metode
  insert into public.orders (user_id, code, status, total, discount, payment_method)
  values (auth.uid(), p_code, 'pending',
          greatest(0, v_total - coalesce(p_discount, 0)), coalesce(p_discount, 0),
          v_method)
  returning id into v_order_id;

  -- loop item: simpan detail, kurangi stok, catat aliran keluar
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::int;

    insert into public.order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_pid, v_item->>'name', v_qty, (v_item->>'price')::int);

    -- atomic stock decrement
    perform public.apply_stock('out', v_pid, v_qty);

    -- catat pergerakan stok keluar (aliran barang)
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

-- ============================================================
-- 3) GRANTS
-- ============================================================
grant execute on function public.create_order_with_items(text, jsonb, int, text) to authenticated;

commit;
