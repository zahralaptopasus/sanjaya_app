// ===== SESI ADMIN LOKAL (khusus demo / tugas) =====
// Login admin di bawah ini TIDAK memakai Supabase. Kredensial dicek langsung
// di aplikasi supaya bisa masuk ke area admin tanpa akun Supabase.
//
// PENTING: jangan dipakai di aplikasi produksi. Username & password yang
// ditulis di kode frontend bisa dibaca siapa saja.

// kredensial admin lokal
export const LOCAL_ADMIN_USERNAME = "admin123";
export const LOCAL_ADMIN_PASSWORD = "123456";

// penanda apakah admin lokal sedang login (hilang saat halaman di-refresh)
let localAdmin = false;

// daftar listener yang ingin tahu saat status admin lokal berubah
const listeners = new Set<(value: boolean) => void>();

// membaca status admin lokal saat ini
export function isLocalAdmin() {
  return localAdmin;
}

// mengubah status admin lokal & memberi tahu semua listener
export function setLocalAdmin(value: boolean) {
  localAdmin = value;
  listeners.forEach((listener) => listener(value));
}

// berlangganan perubahan status admin lokal (mengembalikan fungsi unsubscribe)
export function subscribeLocalAdmin(listener: (value: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// cek apakah isian login cocok dengan kredensial admin lokal
export function isLocalAdminCredential(identifier: string, password: string) {
  return (
    identifier.trim().toLowerCase() === LOCAL_ADMIN_USERNAME &&
    password === LOCAL_ADMIN_PASSWORD
  );
}
