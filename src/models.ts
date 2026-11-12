// ===== TYPE (tipe data domain aplikasi) =====

// tipe data Product (produk sparepart/bengkel)
// merepresentasikan struktur produk yang dipakai di seluruh aplikasi
export type Product = {
  // id unik produk (biasanya UUID dari database)
  id: string;
  // kode produk/internal code (untuk pencarian & identifikasi)
  code: string;
  // nama produk
  name: string;
  // kategori produk (contoh: Oli & Pelumas, Pengereman, dll)
  category: string;
  // satuan produk (pcs, box, liter, roll, set, unit, dll)
  unit: string;
  // harga jual produk dalam Rupiah (number)
  price: number;
  // harga beli / modal per unit dalam Rupiah (number)
  purchasePrice: number;
  // jumlah stok produk saat ini
  stock: number;
  // stok awal saat produk pertama kali didaftarkan (referensi)
  initialStock: number;
  // lokasi penyimpanan fisik (Gudang Utama, Gudang B, Showroom, dll)
  location: string;
  // url/path gambar produk, opsional (bisa null jika belum ada gambar)
  image?: string | null;
};

// tipe data CartItem (item di keranjang belanja)
// berisi produk yang dipilih beserta jumlah qty yang dibeli
export type CartItem = {
  // objek produk lengkap
  product: Product;
  // jumlah pembelian
  qty: number;
};

// tipe data Order (pesanan/user order)
// merepresentasikan struktur pesanan yang ditampilkan ke user
export type Order = {
  // id unik pesanan (UUID)
  id: string;
  // kode pesanan (kode invoice/order code)
  code: string;
  // status pesanan (misal: pending, paid, shipped, completed, cancelled)
  status: string;
  // metode pembayaran: 'midtrans' (online) atau 'cod' (tunai di tempat)
  paymentMethod?: string;
  // total akhir pesanan dalam Rupiah
  total: number;
  // waktu pembuatan pesanan (ISO string / format tanggal dari DB)
  createdAt: string;
  // daftar item dalam pesanan (ringkas untuk ditampilkan)
  items: { product_id: string; name: string; qty: number; price: number }[];
};

// tipe data Review (ulasan produk)
// merepresentasikan ulasan dari user terhadap produk
export type Review = {
  // id unik ulasan
  id: string;
  // id produk yang diulas
  productId: string;
  // id user yang memberi ulasan
  userId: string;
  // rating ulasan (biasanya 1-5)
  rating: number;
  // komentar ulasan, bisa null jika tidak ada komentar
  comment: string | null;
  // waktu pembuatan ulasan (ISO string)
  createdAt: string;
};

// ===== FUNGSI HELPER (transformasi data) =====

// fungsi untuk mengubah objek hasil query database (record) menjadi tipe Product
// bertujuan melakukan normalisasi tipe data: string/number/null yang aman
export function productFromMap(m: Record<string, any>): Product {
  return {
    // memastikan id berbentuk string
    id: String(m.id ?? ''),
    // kode produk
    code: String(m.code ?? ''),
    // nama produk
    name: String(m.name ?? ''),
    // kategori produk
    category: String(m.category ?? ''),
    // satuan produk (default 'pcs')
    unit: String(m.unit ?? 'pcs'),
    // harga jual dikonversi ke number (aman dari string DB)
    price: Number(m.price ?? 0),
    // harga beli dikonversi ke number
    purchasePrice: Number(m.purchase_price ?? m.purchasePrice ?? 0),
    // stok dikonversi ke number
    stock: Number(m.stock ?? 0),
    // stok awal (default 0)
    initialStock: Number(m.initial_stock ?? m.initialStock ?? 0),
    // lokasi simpan (default 'Gudang Utama')
    location: String(m.location ?? 'Gudang Utama'),
    // gambar bisa null jika tidak ada
    image: m.image ?? null,
  };
}

// ===== DATA DEMO (fallback saat data DB kosong/tidak tersedia) =====

// daftar produk demo untuk digunakan sebagai fallback ketika Supabase tidak mengembalikan data
// berguna untuk mode development atau jika tabel products kosong
export const demoProducts: Product[] = [
  { id: 'p1', code: 'SP-SHL-01', name: 'Shell Advance AX7 Matic 10W-40 0.8L', category: 'Oli & Pelumas', unit: 'btl', price: 58000, purchasePrice: 45000, stock: 24, initialStock: 30, location: 'Gudang Utama' },
  { id: 'p2', code: 'SP-REM-02', name: 'Kampas Rem Aspira Depan Vario', category: 'Pengereman', unit: 'set', price: 35000, purchasePrice: 25000, stock: 12, initialStock: 20, location: 'Gudang Utama' },
  { id: 'p3', code: 'SP-BS-03', name: 'Busi NGK Racing CR7HSA Original', category: 'Pengapian', unit: 'pcs', price: 18500, purchasePrice: 12000, stock: 40, initialStock: 50, location: 'Gudang B' },
  { id: 'p4', code: 'SP-VBL-04', name: 'V-Belt Mitsuboshi Honda Beat FI', category: 'CVT', unit: 'pcs', price: 85000, purchasePrice: 65000, stock: 8, initialStock: 15, location: 'Gudang Utama' },
  { id: 'p5', code: 'SP-BAN-05', name: 'Ban Tubeless IRC NF66 80/90-14', category: 'Roda & Ban', unit: 'pcs', price: 185000, purchasePrice: 145000, stock: 6, initialStock: 10, location: 'Showroom' },
  { id: 'p6', code: 'SP-AKI-06', name: 'Aki GS Astra GTZ5S MF Kering', category: 'Kelistrikan', unit: 'unit', price: 245000, purchasePrice: 195000, stock: 5, initialStock: 8, location: 'Gudang Utama' },
];
