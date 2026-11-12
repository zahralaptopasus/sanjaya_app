-- supabase/migrations/20260101_is_admin_function.sql
-- Jalankan di Supabase Dashboard > SQL Editor
-- Fungsi untuk cek apakah user saat ini adalah admin

create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
    and role = 'admin'
  );
$$;

-- Grant execute ke authenticated users
grant execute on function public.is_admin() to authenticated;