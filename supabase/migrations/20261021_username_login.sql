-- ============================================================
-- Login dengan username
-- - menambah kolom profiles.username (unik, case-insensitive)
-- - mengisi username akun lama dari email
-- - membuat profil otomatis saat user baru mendaftar
-- - RPC: resolve_login_email, username_available, set_my_username
-- ============================================================

begin;

-- 1. kolom username
alter table public.profiles add column if not exists username text;

-- 2. samakan user_id dengan auth.users berdasarkan email
--    (baris profil lama bisa saja memakai user_id yang salah / null)
update public.profiles p
set user_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and (p.user_id is null or p.user_id <> u.id);

-- 3. isi username akun lama dari bagian sebelum '@'
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in
    select user_id, email
    from public.profiles
    where username is null and email is not null
    order by created_at nulls first
  loop
    -- ambil bagian sebelum @, ubah ke huruf kecil, buang karakter yang tidak diizinkan
    base := lower(regexp_replace(split_part(r.email, '@', 1), '[^a-z0-9._]', '', 'g'));
    if length(base) < 3 then
      base := 'user';
    end if;
    base := left(base, 20);

    candidate := base;
    n := 0;
    while exists (
      select 1 from public.profiles where lower(username) = candidate
    ) loop
      n := n + 1;
      candidate := left(base, 20 - length(n::text)) || n::text;
    end loop;

    -- update tepat satu baris (pilih lewat ctid agar aman bila email dobel)
    update public.profiles
    set username = candidate
    where ctid = (
      select ctid
      from public.profiles
      where username is null
        and (
          (r.user_id is not null and user_id = r.user_id)
          or (r.user_id is null and email = r.email)
        )
      limit 1
    );
  end loop;
end $$;

-- 4. username harus unik (tanpa membedakan huruf besar/kecil)
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- 5. profil otomatis untuk setiap user baru (email/password maupun Google)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  uname text;
  n int := 0;
begin
  -- utamakan username yang dikirim saat daftar, kalau tidak ada pakai email
  base := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1)
  ));
  base := regexp_replace(base, '[^a-z0-9._]', '', 'g');
  if length(base) < 3 then
    base := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := left(base, 20);

  uname := base;
  while exists (
    select 1 from public.profiles where lower(username) = uname
  ) loop
    n := n + 1;
    uname := left(base, 20 - length(n::text)) || n::text;
  end loop;

  if exists (select 1 from public.profiles where user_id = new.id) then
    update public.profiles
    set email = new.email,
        username = coalesce(username, uname)
    where user_id = new.id;
  else
    insert into public.profiles (user_id, email, username, role)
    values (new.id, new.email, uname, 'user');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. cari email dari username (dipakai sebelum signInWithPassword)
create or replace function public.resolve_login_email(p_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(p_identifier))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- 7. cek ketersediaan username (dipakai saat daftar & ganti username)
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- 8. ganti username milik user yang sedang login
create or replace function public.set_my_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text := lower(trim(p_username));
begin
  if uid is null then
    raise exception 'Sesi tidak ditemukan. Coba masuk ulang.';
  end if;
  if uname !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'Username 3-20 karakter, hanya huruf kecil, angka, titik, atau underscore.';
  end if;
  if exists (
    select 1 from public.profiles
    where lower(username) = uname and user_id is distinct from uid
  ) then
    raise exception 'Username sudah dipakai.';
  end if;

  update public.profiles set username = uname where user_id = uid;

  if not found then
    insert into public.profiles (user_id, email, username, role)
    select uid, u.email, uname, 'user'
    from auth.users u
    where u.id = uid;
  end if;

  return uname;
end;
$$;

revoke all on function public.set_my_username(text) from public;
grant execute on function public.set_my_username(text) to authenticated;

-- 9. izinkan user membaca & mengubah profilnya sendiri
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
