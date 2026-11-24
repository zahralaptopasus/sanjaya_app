-- supabase/migrations/20261125_cod_paid.sql
-- Jalankan di Supabase SQL Editor SETELAH 20261120_shipping.sql
--
-- Tujuan: order COD langsung berstatus 'paid' (lunas) seperti Midtrans,
-- tanpa perlu admin menandai lunas. Alur admin tinggal: Lunas → Dikirim → Selesai.

begin;

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
  v_status text;
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

  -- COD dianggap lunas saat pesanan dibuat; Midtrans menunggu pembayaran
  v_status := case when v_method = 'cod' then 'paid' else 'pending' end;

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

  -- insert order (total = subtotal - diskon + ongkir)
  insert into public.orders (
    user_id, code, status, total, discount, payment_method,
    address_id, shipping_name, shipping_phone, shipping_address,
    courier_id, courier_name, shipping_cost
  )
  values (
    auth.uid(), p_code, v_status,
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
