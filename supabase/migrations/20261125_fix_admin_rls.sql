-- supabase/migrations/20261125_fix_admin_rls.sql
-- Jalankan di Supabase SQL Editor SETELAH 20261120_shipping.sql
--
-- Tujuan: perbaiki deteksi admin + RLS tabel orders & shipments.
--
-- Masalah: public.is_admin() hanya mencocokkan profiles.user_id = auth.uid().
-- Bila role admin di-set lewat email (profiles.user_id null/salah), is_admin()
-- bernilai false. Akibatnya UPDATE status pesanan ditolak RLS tanpa error
-- (0 baris) — status tidak berubah walau tombol Kirim ditekan.

begin;

-- ============================================================
-- 1) is_admin(): cocokkan lewat user_id ATAU email JWT
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.role = 'admin'
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- 2) ORDERS: admin penuh, user hanya baca miliknya
-- ============================================================
alter table public.orders enable row level security;

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_auth_read" on public.orders;
create policy "orders_auth_read" on public.orders
  for select to authenticated
  using (public.is_admin() or auth.uid() = user_id);

-- ============================================================
-- 3) SHIPMENTS: samakan aturan
-- ============================================================
alter table public.shipments enable row level security;

drop policy if exists "shipments_admin_all" on public.shipments;
create policy "shipments_admin_all" on public.shipments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "shipments_auth_read" on public.shipments;
create policy "shipments_auth_read" on public.shipments
  for select to authenticated
  using (true);

-- ============================================================
-- 4) ORDER_ITEMS: pastikan admin bisa menulis (dipakai alur pesanan)
-- ============================================================
alter table public.order_items enable row level security;

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "order_items_auth_read" on public.order_items;
create policy "order_items_auth_read" on public.order_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5) updated_at pada orders (dipakai pencatatan waktu ubah status)
-- ============================================================
alter table public.orders add column if not exists updated_at timestamptz default now();
update public.orders set updated_at = now() where updated_at is null;

commit;
