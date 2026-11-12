// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil klien Supabase untuk operasi akun (ubah metadata, sandi, unggah foto)
import { supabase } from './supabase';

// ===== TYPE =====

// field profil yang bisa diubah pelanggan
export type ProfileFields = { full_name?: string; phone?: string };

// hasil umum sebuah aksi akun
export type AccountResult = { ok: boolean; error?: string };

// sumber gambar yang dipilih dari galeri/kamera
export type PickedImage = {
  // lokasi file di perangkat
  uri: string;
  // data base64 (bila diminta saat memilih gambar)
  base64?: string | null;
  // tipe mime, mis. image/jpeg
  mimeType?: string | null;
  // objek File (khusus web)
  file?: any;
};

// ===== PROFIL =====

// menyimpan nama lengkap & nomor HP ke metadata akun Supabase
export async function updateProfile(fields: ProfileFields): Promise<AccountResult> {
  // updateUser bagian "data" akan menulis ke raw_user_meta_data
  const { error } = await supabase.auth.updateUser({ data: fields });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ===== USERNAME =====

// aturan username: 3-20 karakter, huruf kecil, angka, titik, atau underscore
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

// samakan format username (buang spasi, huruf kecil)
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

// validasi username; mengembalikan pesan error atau null bila valid
export function usernameError(value: string): string | null {
  const uname = normalizeUsername(value);
  if (!uname) return 'Username wajib diisi';
  if (!USERNAME_PATTERN.test(uname)) {
    return 'Username 3-20 karakter, hanya huruf kecil, angka, titik, atau underscore';
  }
  return null;
}

// alias login admin: username "admin123" diarahkan ke akun admin
export const ADMIN_LOGIN_ALIAS = 'admin123';
// email akun admin yang dipakai saat login dengan alias di atas
export const ADMIN_EMAIL = 'admintest@gmail.com';

// mengubah "email atau username" menjadi email yang dipakai Supabase Auth
export async function resolveLoginEmail(identifier: string): Promise<string> {
  const id = identifier.trim();
  // alias admin selalu memakai akun admin (tidak bergantung pada RPC username)
  if (normalizeUsername(id) === ADMIN_LOGIN_ALIAS) return ADMIN_EMAIL;
  // kalau sudah berupa email, langsung pakai
  if (id.includes('@')) return id;
  // selain itu cari lewat RPC (security definer, aman dari RLS)
  const { data, error } = await supabase.rpc('resolve_login_email', { p_identifier: id });
  if (error) throw new Error('Username atau kata sandi salah');
  const email = typeof data === 'string' ? data : null;
  if (!email) throw new Error('Username atau kata sandi salah');
  return email;
}

// cek apakah username masih tersedia
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: normalizeUsername(username),
  });
  if (error) {
    throw new Error('Gagal memeriksa username. Pastikan migration username sudah dijalankan di Supabase.');
  }
  return data === true;
}

// ambil username milik user yang sedang login
export async function getMyUsername(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .maybeSingle();
  return ((data as any)?.username as string | undefined) ?? null;
}

// simpan username baru (validasi + cek unik dilakukan di database)
export async function setMyUsername(username: string): Promise<AccountResult> {
  const uname = normalizeUsername(username);
  const invalid = usernameError(uname);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.rpc('set_my_username', { p_username: uname });
  if (error) {
    const msg = error.message.includes('set_my_username')
      ? 'Fitur username belum aktif di server. Jalankan migration username.'
      : error.message;
    return { ok: false, error: msg };
  }
  return { ok: true };
}

// mengubah kata sandi; kata sandi lama diverifikasi lebih dulu
export async function changePassword(current: string, next: string): Promise<AccountResult> {
  // ambil data user (butuh email untuk verifikasi sandi lama)
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;
  // tanpa email (sesi hilang) tidak bisa lanjut
  if (!email) return { ok: false, error: 'Sesi tidak ditemukan. Coba masuk ulang.' };
  // verifikasi sandi lama dengan mencoba masuk ulang
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
  if (authErr) return { ok: false, error: 'Kata sandi lama salah.' };
  // ganti ke kata sandi baru
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ===== FOTO PROFIL =====

// mengunggah foto profil ke bucket 'avatars' lalu menyimpan URL-nya di metadata akun
export async function uploadAvatar(img: PickedImage): Promise<{ ok: boolean; url?: string; error?: string }> {
  // pastikan ada sesi
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesi tidak ditemukan. Masuk ulang untuk mengganti foto.' };

  // tentukan ekstensi dari tipe mime (default jpg)
  const ext = (img.mimeType && img.mimeType.split('/')[1]) || 'jpg';
  // simpan di folder milik user; nama tetap agar mudah ditimpa
  const path = `${user.id}/avatar.${ext}`;

  // siapkan isi yang akan diunggah
  let payload: any;
  if (img.file) {
    // web: expo-image-picker mengembalikan objek File
    payload = img.file;
  } else if (img.base64) {
    // native: ubah base64 menjadi byte
    payload = base64ToBytes(img.base64);
  } else {
    // cadangan: ambil isi file dari uri
    try {
      const res = await fetch(img.uri);
      payload = new Uint8Array(await res.arrayBuffer());
    } catch {
      return { ok: false, error: 'Gagal membaca file gambar.' };
    }
  }

  // unggah (upsert=true agar file lama ditimpa)
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, payload, { contentType: img.mimeType || 'image/jpeg', upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  // ambil URL publik; tambahkan query waktu agar gambar tidak di-cache browser
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  // simpan URL ke metadata akun
  const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: url } });
  if (metaErr) return { ok: false, error: metaErr.message };

  return { ok: true, url };
}

// menghapus foto profil (file di storage + URL di metadata)
export async function removeAvatar(): Promise<AccountResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesi tidak ditemukan.' };
  // hapus beberapa kemungkinan nama file di folder user
  await supabase.storage.from('avatars').remove([
    `${user.id}/avatar.jpg`,
    `${user.id}/avatar.jpeg`,
    `${user.id}/avatar.png`,
    `${user.id}/avatar.webp`,
  ]);
  // kosongkan avatar_url di metadata
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ===== HELPER =====

// mengubah string base64 menjadi Uint8Array tanpa library tambahan
function base64ToBytes(b64: string): Uint8Array {
  // tabel karakter base64 standar
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // peta nilai karakter -> index
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  // hitung panjang byte hasil (padding '=' mengurangi 1 atau 2 byte)
  let len = Math.floor((b64.length * 3) / 4);
  if (b64.endsWith('==')) len -= 2;
  else if (b64.endsWith('=')) len -= 1;

  // siapkan buffer hasil
  const bytes = new Uint8Array(len);
  let p = 0;
  // proses setiap 4 karakter menjadi 3 byte
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)];
    const e2 = lookup[b64.charCodeAt(i + 1)];
    const e3 = lookup[b64.charCodeAt(i + 2)];
    const e4 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < len) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < len) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}
