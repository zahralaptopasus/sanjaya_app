// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil klien Supabase untuk akses database dan fungsi server
import { supabase } from './lib/supabase';
// mengambil data demo, fungsi transformasi produk, dan tipe data domain
import { demoProducts, productFromMap, type Order, type Product } from './models';

// ===== FUNGSI AKSES DATA (Repository layer) =====

// fungsi untuk mengambil daftar produk dari database
// jika terjadi error, data kosong, atau tidak ada data -> fallback ke demoProducts
export async function getProducts(): Promise<Product[]> {
  try {
    // query: ambil semua kolom dari tabel 'products' (tanpa filter)
    // .from('products') = pilih tabel products
    // .select() = ambil seluruh kolom
    const { data, error } = await supabase.from('products').select();
    // jika ada error atau data null/kosong, kembalikan produk demo
    if (error || !data || data.length === 0) return demoProducts;
    // mengubah hasil query (Record<string,any>[]) menjadi array Product dengan normalisasi tipe
    return (data as Record<string, any>[]).map(productFromMap);
  } catch {
    // fallback jika terjadi exception
    return demoProducts;
  }
}

// fungsi untuk membuat pesanan baru melalui RPC (PostgreSQL function) di Supabase
// RPC 'create_order_with_items' menangani pembuatan order + order_items secara atomik
// serta pengecekan stok (stok_kurang) di sisi database
export async function createOrder(params: {
  // kode pesanan (order code)
  code: string;
  // daftar item pesanan yang akan disimpan
  items: { product_id: string; name: string; qty: number; price: number }[];
  // subtotal (sebelum diskon) - saat ini tidak dipakai langsung oleh RPC ini, namun disertakan untuk konsistensi
  subtotal: number;
  // diskon yang diterapkan
  discount: number;
  // total akhir pesanan
  total: number;
  // metode pembayaran: Midtrans (online) atau COD/tunai di tempat
  paymentMethod?: 'midtrans' | 'cod';
}): Promise<string | null> {
  try {
    // mengambil user yang sedang login
    const { data: { user } } = await supabase.auth.getUser();
    // hanya user yang login boleh membuat pesanan
    if (!user) return null;

    // menyiapkan payload items untuk RPC (hanya field yang dibutuhkan)
    const items = params.items.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      qty: i.qty,
      price: i.price,
    }));

    // metode pembayaran yang dipilih (default Midtrans)
    const method = params.paymentMethod ?? 'midtrans';

    // memanggil RPC 'create_order_with_items' dengan parameter:
    // - p_code: kode pesanan
    // - p_items: array item pesanan
    // - p_discount: besar diskon (agar total yang disimpan sesuai total bayar setelah kupon)
    // - p_payment_method: 'midtrans' atau 'cod' (butuh migration 20261107_cod_payment.sql)
    let { data, error } = await supabase.rpc('create_order_with_items', {
      p_code: params.code,
      p_items: items,
      p_discount: params.discount,
      p_payment_method: method,
    });

    // fallback kompatibilitas: bila database belum menjalankan migration COD,
    // alur Midtrans tetap bisa jalan memakai RPC lama (tanpa p_payment_method).
    if (error && /PGRST202|could not find the function|schema cache/i.test(error.message ?? '')) {
      if (method === 'cod') {
        console.error('create_order: migration COD belum dijalankan', error);
        return 'MIGRATION_REQUIRED';
      }
      const fallback = await supabase.rpc('create_order_with_items', {
        p_code: params.code,
        p_items: items,
        p_discount: params.discount,
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      // deteksi error khusus: stok kurang
      if (/stok_kurang/i.test(error.message ?? '')) return 'STOK_KURANG';
      // log error lain untuk debugging
      console.error('create_order rpc error', error);
      return null;
    }
    // data hasil RPC biasanya berupa order id (string) dari fungsi database
    return data as string;
  } catch (e) {
    // tangkap exception (network/error tak terduga)
    console.error('createOrder exception', e);
    return null;
  }
}

// fungsi untuk membuat Snap Token Midtrans melalui Supabase Edge Function 'create-snap'
// edge function akan menghasilkan redirect_url (pembayaran web) atau token Snap
export async function createSnapToken(orderId: string): Promise<string | null> {
  try {
    // invoke edge function dengan body berisi order_id
    const { data, error } = await supabase.functions.invoke('create-snap', {
      body: { order_id: orderId },
    });
    if (error) {
      console.error('create-snap error', error);
      return null;
    }
    // prioritas 1: redirect_url (stabil untuk pembayaran via browser/redirect)
    if (data && typeof data.redirect_url === 'string' && data.redirect_url) return data.redirect_url;
    // prioritas 2: token Snap (fallback) -> bentuk URL vtweb sandbox
    if (data && typeof data.token === 'string' && data.token) {
      // fallback: Snap popup via token (WebView perlu load Snap SDK), tapi redirect_url lebih stabil
      console.warn('create-snap returned token only', data);
      return `https://app.sandbox.midtrans.com/snap/v2/vtweb/${data.token}`;
    }
    return null;
  } catch (e) {
    // tangkap exception saat invoke function gagal
    console.error('createSnapToken exception', e);
    return null;
  }
}

// fungsi untuk mengambil status pesanan dari database (dipakai Struk agar status asli)
// mengembalikan string status ('pending', 'paid', 'failed', 'cancelled') atau null bila tidak ditemukan/error
export async function getOrderStatus(orderId: string): Promise<string | null> {
  try {
    // query status pesanan berdasarkan id (RLS: user hanya bisa baca order miliknya)
    const { data, error } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (error || !data) return null;
    return String(data.status);
  } catch {
    return null;
  }
}

// fungsi untuk mengambil metode pembayaran sebuah pesanan
// dipakai layar Struk agar tahu apakah pesanan memakai Midtrans atau Tunai (COD)
export async function getOrderPaymentMethod(orderId: string): Promise<'midtrans' | 'cod'> {
  try {
    // ambil kolom payment_method sesuai id order (RLS: user hanya bisa baca order miliknya)
    const { data, error } = await supabase
      .from('orders')
      .select('payment_method')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !data) return 'midtrans';
    return String(data.payment_method ?? 'midtrans') === 'cod' ? 'cod' : 'midtrans';
  } catch {
    return 'midtrans';
  }
}

// fungsi untuk membatalkan pesanan milik user (dipakai saat pelanggan membatalkan pembayaran Midtrans)
// memanggil RPC 'cancel_order' yang menandai order 'cancelled' dan mengembalikan stok
export async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    // panggil RPC dengan parameter p_order_id
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error) {
      // log error untuk debugging
      console.error('cancelOrder error', error);
      return false;
    }
    return true;
  } catch (e) {
    // tangkap exception (network/error tak terduga)
    console.error('cancelOrder exception', e);
    return false;
  }
}

// fungsi untuk mengambil daftar ulasan (reviews) untuk produk tertentu
// mengurutkan dari terbaru ke terlama (created_at descending)
export async function getProductReviews(productId: string): Promise<any[]> {
  try {
    // query tabel 'reviews' dengan kolom tertentu
    // .from('reviews') = tabel reviews
    // .select('id, user_id, rating, comment, created_at') = pilih kolom yang diperlukan
    // .eq('product_id', productId) = filter berdasarkan product_id
    // .order('created_at', { ascending: false }) = urutkan terbaru dulu
    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, rating, comment, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data as any[];
  } catch {
    return [];
  }
}

// fungsi untuk mengecek apakah user yang login pernah membeli produk tertentu
// pengecekan dilakukan via RPC 'can_review' (logika bisnis di DB)
export async function hasPurchasedProduct(productId: string): Promise<boolean> {
  try {
    // ambil user saat ini
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // panggil RPC can_review dengan parameter p_product
    const { data, error } = await supabase.rpc('can_review', { p_product: productId });
    if (error) return false;
    // hasil RPC diharapkan boolean true/false
    return data === true;
  } catch {
    return false;
  }
}

// fungsi untuk menambahkan ulasan baru ke produk
// insert ke tabel 'reviews' dengan product_id, rating, comment
export async function addReview(
  productId: string,
  rating: number,
  comment: string | null
): Promise<boolean> {
  try {
    // insert data review
    // note: user_id biasanya diisi oleh RLS/trigger di database, bukan dari client
    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      rating,
      comment,
    });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

// fungsi untuk mengambil daftar pesanan milik user yang sedang login
// mengambil data orders beserta relasi order_items (nested select)
export async function getMyOrders(): Promise<Order[]> {
  // query orders dengan nested select order_items(product_id, name, qty, price)
  // .from('orders') = tabel orders
  // .select('id, code, status, total, created_at, payment_method, order_items(...)') = nested select relasi
  // .order('created_at', { ascending: false }) = urutkan terbaru dulu
  const { data, error } = await supabase
    .from('orders')
    .select('id, code, status, total, created_at, payment_method, order_items(product_id, name, qty, price)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  // mapping hasil query ke tipe Order
  return (data as Record<string, any>[]).map((o) => ({
    // normalisasi field
    id: String(o.id),
    code: String(o.code),
    status: String(o.status),
    // metode pembayaran tersimpan di database ('midtrans' / 'cod')
    paymentMethod: String(o.payment_method ?? 'midtrans'),
    total: Number(o.total),
    // created_at dari DB dipetakan ke createdAt
    createdAt: String(o.created_at),
    // mapping order_items menjadi array items dengan normalisasi tipe
    items: ((o.order_items as any[]) ?? []).map((i) => ({
      // id produk asli (dipakai untuk aksi "Beli Lagi" menambahkan kembali ke keranjang)
      product_id: String(i.product_id ?? ''),
      name: String(i.name),
      qty: Number(i.qty),
      price: Number(i.price),
    })),
  }));
}

// fungsi untuk mengambil URL halaman pembayaran Midtrans Snap dari sebuah pesanan
// dipakai layar Struk agar pelanggan bisa membuka kembali pembayaran pesanan yang masih menunggu
export async function getOrderSnapUrl(orderId: string): Promise<string | null> {
  try {
    // ambil kolom snap_url sesuai id order (RLS: user hanya bisa baca order miliknya)
    const { data, error } = await supabase.from('orders').select('snap_url').eq('id', orderId).maybeSingle();
    if (error || !data) return null;
    return (data.snap_url as string) ?? null;
  } catch {
    return null;
  }
}

// ===== ALAMAT & KENDARAAN PELANGGAN =====

// tipe data alamat/kendaraan pelanggan (tabel customer_addresses)
export type CustomerAddress = {
  // id baris (uuid)
  id: string;
  // jenis: 'address' (alamat) atau 'vehicle' (kendaraan)
  kind: 'address' | 'vehicle';
  // label singkat, mis. 'Rumah' / 'Motor utama'
  label: string | null;
  // nama penerima (alamat) atau pemilik (kendaraan)
  name: string | null;
  // nomor telepon/HP
  phone: string | null;
  // detail alamat (untuk kind='address')
  address: string | null;
  // data kendaraan (untuk kind='vehicle')
  vehicle_type: string | null;
  vehicle_model: string | null;
  plate: string | null;
  // penanda alamat utama
  is_default: boolean;
  // waktu dibuat
  created_at: string;
};

// daftar kolom yang boleh diubah (tanpa id/user_id/created_at)
type AddressInput = Partial<Omit<CustomerAddress, 'id' | 'created_at'>>;

// mengambil daftar alamat/kendaraan milik user saat ini, dipisah berdasarkan jenis (kind)
export async function getAddresses(kind: 'address' | 'vehicle'): Promise<CustomerAddress[]> {
  try {
    // ambil baris sesuai kind; urutkan default dulu, lalu terbaru
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('kind', kind)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as CustomerAddress[];
  } catch {
    return [];
  }
}

// menyimpan (tambah bila tanpa id, ubah bila ada id) satu alamat/kendaraan
export async function saveAddress(input: AddressInput & { kind: 'address' | 'vehicle'; id?: string }): Promise<boolean> {
  try {
    // hanya kirim kolom yang relevan
    const payload = {
      kind: input.kind,
      label: input.label ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      vehicle_type: input.vehicle_type ?? null,
      vehicle_model: input.vehicle_model ?? null,
      plate: input.plate ?? null,
      is_default: input.is_default ?? false,
    };
    if (input.id) {
      // ubah baris yang ada
      const { error } = await supabase.from('customer_addresses').update(payload).eq('id', input.id);
      return !error;
    }
    // tambah baris baru; user_id diisi user yang login
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('customer_addresses').insert({ ...payload, user_id: user.id });
    return !error;
  } catch {
    return false;
  }
}

// menghapus satu alamat/kendaraan berdasarkan id
export async function deleteAddress(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// menjadikan satu alamat sebagai utama (dan menonaktifkan yang lain pada jenis yang sama)
export async function setDefaultAddress(id: string, kind: 'address' | 'vehicle'): Promise<boolean> {
  try {
    // matikan default pada semua baris jenis ini
    await supabase.from('customer_addresses').update({ is_default: false }).eq('kind', kind);
    // nyalakan default pada baris terpilih
    const { error } = await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ===== FAVORIT PRODUK =====

// mengambil daftar id produk yang difavoritkan user yang sedang login
// dipakai agar ikon hati di daftar produk menampilkan status terisi/kosong
export async function getFavoriteIds(): Promise<string[]> {
  try {
    // ambil user aktif; tanpa user (tamu) tidak ada favorit
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    // ambil kolom product_id dari tabel favorites milik user ini
    const { data, error } = await supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id);
    if (error || !data) return [];
    // normalisasi tiap product_id menjadi string
    return data.map((r: Record<string, any>) => String(r.product_id));
  } catch {
    return [];
  }
}

// mengambil daftar produk favorit milik user (lengkap), diurutkan dari yang terbaru
// memakai nested select relasi ke tabel products
export async function getFavoriteProducts(): Promise<Product[]> {
  try {
    // ambil user aktif
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    // ambil waktu simpan + seluruh kolom produk terkait (relasi favorites -> products)
    const { data, error } = await supabase
      .from('favorites')
      .select('created_at, products(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    // ambil objek products dari tiap baris, buang yang null, lalu normalisasi tipe
    return (data as Record<string, any>[])
      .map((r) => r.products)
      .filter(Boolean)
      .map(productFromMap);
  } catch {
    return [];
  }
}

// menambahkan produk ke favorit user (aman dipanggil walau sudah pernah difavoritkan)
export async function addFavorite(productId: string): Promise<boolean> {
  try {
    // ambil user aktif; tamu tidak boleh menyimpan favorit
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // upsert dengan kunci unik (user_id, product_id); duplikat diabaikan
    const { error } = await supabase.from('favorites').upsert(
      { user_id: user.id, product_id: productId },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
    return !error;
  } catch {
    return false;
  }
}

// menghapus produk dari favorit user
export async function removeFavorite(productId: string): Promise<boolean> {
  try {
    // ambil user aktif
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // hapus baris favorit milik user ini untuk produk tersebut
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);
    return !error;
  } catch {
    return false;
  }
}

