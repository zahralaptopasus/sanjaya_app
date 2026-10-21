// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil klien Supabase untuk akses database (CRUD, RPC, query)
import { supabase } from './supabase';
// mengambil tipe data domain Product, Order, dan Supplier
import type { Product, Order } from '../models';
// productFromMap: normalisasi kolom DB (snake_case) => tipe Product (camelCase + image)
import { productFromMap } from '../models';

// ===== STORAGE (upload gambar ke Supabase Storage) =====

// bucket name untuk gambar produk
const PRODUCT_IMAGES_BUCKET = 'product-images';
export const LOW_STOCK_THRESHOLD = 10; // ambang batas stok rendah (low stock) untuk peringatan di dashboard admin
export const isLowStock = (stock: number) => stock <= LOW_STOCK_THRESHOLD; // helper untuk cek apakah stok rendah
export type LowStockItem = { id: string; code: string; name: string; stock: number }; // tipe data untuk item stok rendah
// upload file gambar ke Supabase Storage dan kembalikan public URL
export async function adminUploadImage(fileUri: string): Promise<string> {
  // ekstrak nama file dari URI
  const fileName = fileUri.split('/').pop() ?? `product-${Date.now()}.jpg`;
  // buat path unik: timestamp + nama file
  const filePath = `${Date.now()}-${fileName}`;

  // baca file sebagai base64 (React Native)
  const response = await fetch(fileUri);
  const blob = await response.blob();

  // upload ke Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // dapatkan public URL
  const { data: { publicUrl } } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return publicUrl;
}

// ===== PRODUCTS (manajemen produk untuk admin) =====

// mengambil seluruh daftar produk untuk keperluan admin
// diurutkan berdasarkan nama produk (ascending) agar mudah dibaca di tabel admin
export async function adminGetProducts(): Promise<Product[]> {
  // query: .from('products') pilih tabel products, .select('*') ambil semua kolom, .order('name') urutkan
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });
  if (error) return [];
  // normalisasi tiap row DB ke tipe Product (termasuk field image)
  return (data as Record<string, any>[]).map(productFromMap);
}

export async function adminCountLowStock() : Promise<number> {
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .lte('stock', LOW_STOCK_THRESHOLD);
  return count ?? 0;
}

// menambahkan produk baru ke tabel products
export async function adminAddProduct({
  code,
  name,
  category,
  unit,
  price,
  purchasePrice,
  stock,
  initialStock,
  location,
  image,
}: { 
  code: string; 
  name: string; 
  category: string; 
  unit: string; 
  price: number; 
  purchasePrice: number; 
  stock: number; 
  initialStock: number; 
  location: string; 
  image?: string | null 
}) {
  // insert data produk baru
  // .from('products').insert({...}) menambahkan baris baru
  const { error } = await supabase
    .from('products')
    .insert({ 
      code, 
      name, 
      category, 
      unit, 
      price, 
      purchase_price: purchasePrice, 
      stock, 
      initial_stock: initialStock, 
      location, 
      image 
    });
  // jika error, lempar agar UI bisa menangani (tampilkan pesan error)
  if (error) throw error;
}

// update produk existing (termasuk ganti gambar)
export async function adminUpdateProduct(
  id: string,
  data: { 
    code: string; 
    name: string; 
    category: string; 
    unit: string; 
    price: number; 
    purchasePrice: number; 
    stock: number; 
    initialStock: number; 
    location: string; 
    image?: string | null 
  }
) {
  const { error } = await supabase
    .from('products')
    .update({
      code: data.code,
      name: data.name,
      category: data.category,
      unit: data.unit,
      price: data.price,
      purchase_price: data.purchasePrice,
      stock: data.stock,
      initial_stock: data.initialStock,
      location: data.location,
      image: data.image,
    })
    .eq('id', id);
  if (error) throw error;
}

// hapus produk dari database
export async function adminDeleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== STOCK MOVEMENTS (pergerakan stok + pencatatan) =====

// fungsi internal untuk mengubah stok produk secara atomik via RPC
// alasan: perubahan stok harus konsisten (atomic) + dicatat di stock_movements untuk audit trail
// - RPC 'apply_stock' melakukan update stok di tabel products (in/out) secara aman
// - lalu insert ke stock_movements untuk mencatat riwayat pergerakan stok
async function stockChange(
  productId: string,
  productName: string,
  movementType: 'in' | 'out',
  qty: number,
  note?: string,
  adminName?: string
) {
  // 1. panggil RPC apply_stock untuk mengubah stok produk secara atomik
  // parameter RPC: p_mov_type ('in' atau 'out'), p_id (productId), p_qty (jumlah)
  const { error: rpcErr } = await supabase.rpc('apply_stock', {
    p_mov_type: movementType,
    p_id: productId,
    p_qty: qty,
  });
  if (rpcErr) throw rpcErr;

  // 2. catat pergerakan stok ke tabel stock_movements untuk audit
  // field: product_id, product_name, movement_type, qty, note, admin_name
  const { error: logErr } = await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      product_name: productName,
      movement_type: movementType,
      qty,
      note: note ?? null,
      admin_name: adminName ?? 'Admin',
    });
  if (logErr) throw logErr;
}

// mencatat stok masuk (stock in) - menambah stok produk
export async function adminLogStockIn({
  productId,
  productName,
  qty,
  note,
  adminName,
}: { productId: string; productName: string; qty: number; note?: string; adminName?: string }) {
  await stockChange(productId, productName, 'in', qty, note, adminName);
}

// mencatat stok keluar (stock out) - mengurangi stok produk
export async function adminLogStockOut({
  productId,
  productName,
  qty,
  note,
  adminName,
}: { productId: string; productName: string; qty: number; note?: string; adminName?: string }) {
  await stockChange(productId, productName, 'out', qty, note, adminName);
}

// mengambil daftar riwayat pergerakan stok (stock movements)
// bisa difilter berdasarkan productId, startDate, endDate, type
export async function adminGetStockMovements({ 
  productId, 
  startDate, 
  endDate, 
  type 
}: { 
  productId?: string; 
  startDate?: string; 
  endDate?: string; 
  type?: 'in' | 'out' 
} = {}) {
  // query: ambil field langsung dari stock_movements (product_name sudah ada)
  // .order('created_at', { ascending: false }) = urutkan terbaru dulu
  let q = supabase
    .from('stock_movements')
    .select('id, product_id, product_name, movement_type, qty, note, admin_name, created_at')
    .order('created_at', { ascending: false });
  // filter opsional
  if (productId) q = q.eq('product_id', productId);
  if (startDate) q = q.gte('created_at', startDate);
  if (endDate) q = q.lte('created_at', endDate);
  if (type) q = q.eq('movement_type', type);
  const { data, error } = await q;
  if (error) return [];
  // map ke camelCase
  return (data as any[]).map(m => ({
    id: String(m.id),
    productId: String(m.product_id),
    productName: String(m.product_name ?? ''),
    movementType: String(m.movement_type),
    qty: Number(m.qty ?? 0),
    note: String(m.note ?? ''),
    adminName: String(m.admin_name ?? ''),
    createdAt: String(m.created_at),
  }));
}

// ===== DOCUMENTS (dokumen administrasi) =====

// mengunggah/mencatat dokumen baru ke tabel documents
export async function adminUploadDoc({
  name,
  description,
  fileUrl,
}: { name: string; description?: string; fileUrl?: string }) {
  // insert dokumen baru; created_at diisi manual dengan ISO string saat ini
  // (bisa juga menggunakan default value di DB)
  const { error } = await supabase
    .from('documents')
    .insert({ name, description, created_at: new Date().toISOString() });
  if (error) throw error;
}

// ===== PURCHASE ORDERS (PO / pembelian ke supplier) =====

// membuat Purchase Order (PO) baru beserta item-item PO
// alur: insert ke purchase_orders (header) -> insert ke purchase_order_items (detail)
// total dihitung dari sum(qty * price) item
export async function adminCreatePO({
  code,
  supplier,
  supplierId,
  notes,
  items,
}: {
  code: string;
  supplier: string;
  supplierId?: string;
  notes?: string;
  items: { product_id: string; product_name: string; qty: number; price: number }[];
}) {
  // 1. buat header PO: code, supplier, supplier_id, notes, status default 'draft', total dihitung
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      code,
      supplier,
      supplier_id: supplierId ?? null,
      notes,
      status: 'draft',
      total: items.reduce((s, i) => s + i.qty * i.price, 0),
    })
    .select()
    .single(); // kembalikan baris PO yang baru dibuat (termasuk id)
  if (poErr || !po) throw poErr;

  // 2. siapkan item-item PO dengan relasi po_id
  const itemsToInsert = items.map((i) => ({
    po_id: po.id,
    product_id: i.product_id,
    product_name: i.product_name,
    qty: i.qty,
    price: i.price,
  }));
  // insert detail PO ke purchase_order_items
  const { error: itemsErr } = await supabase.from('purchase_order_items').insert(itemsToInsert);
  if (itemsErr) throw itemsErr;

  // kembalikan po.id hasil insert (TIDAK auto-receive, status draft)
  return po.id as string;
}

// menerima PO (mark as received) melalui RPC 'mark_po_received'
// alasan: penerimaan PO biasanya memicu penyesuaian stok / logika bisnis di DB (atomic)
export async function adminReceivePO(poId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('mark_po_received', { p_po_id: poId });
  if (error) return { error: error.message };
  return {};
}

// mengambil daftar PO, bisa difilter berdasarkan status
// mengambil juga relasi purchase_order_items (nested select)
export async function adminGetPOs({ status }: { status?: string } = {}) {
  // query dengan nested select: purchase_order_items(*)
  let q = supabase
    .from('purchase_orders')
    .select(`
    *,
    purchase_order_items(*)
  `)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.warn('[adminGetPOs] query gagal:', error.message);
    return [];
  }
  return data as any[];
}

// ===== PENJUALAN (Sales) =====

// mengambil daftar penjualan (orders) beserta item pesanan
// mendukung filter rentang tanggal (startDate - endDate) berdasarkan created_at
export async function adminGetSales({ startDate, endDate }: { startDate?: string; endDate?: string } = {}) {
  // query orders dengan nested select order_items(*)
  let q = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  // filter >= startDate dan <= endDate jika ada
  if (startDate) q = q.gte('created_at', startDate);
  if (endDate) q = q.lte('created_at', endDate);
  const { data, error } = await q;
  if (error) return [];
  // mapping ke bentuk Order (sesuai model yang dipakai aplikasi)
  return (data as any[]).map((o) => ({
    id: String(o.id),
    code: String(o.code),
    status: String(o.status),
    total: Number(o.total),
    createdAt: String(o.created_at),
    items: ((o.order_items as any[]) ?? []).map((i) => ({
      name: String(i.name),
      qty: Number(i.qty),
      price: Number(i.price),
    })),
  })) as Order[];
}

// ===== STATS (statistik dashboard admin) =====

// menghitung statistik ringkas untuk dashboard admin:
// - totalBarang: jumlah produk (count)
// - totalStok: jumlah total stok seluruh produk (sum stock)
// - totalPenjualan: total nilai transaksi/orders (jumlah total dari orders)
// - totalOmset: omset dihitung dari sum(price*qty) order_items (pendekatan detail item)
export async function adminStats() {
  const {count: totalBarang} = await supabase.from('products').select('*', { count: 'exact', head: true });
  const {data: stocks, error: stockErr} = await supabase.from('products').select('stock');

  if (stockErr) 
   return { totalBarang: 0, totalStok: 0, totalPenjualan: 0, totalOmset: 0, lowStock: [] as LowStockItem[] };

   const arr = (stocks ?? []) as any[];
   const totalStok = arr.reduce((s, p) => s + (p.stock ?? 0), 0);
   const lowStock: LowStockItem[] = arr
    .filter((p) => isLowStock(p.stock))
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .map((p) => ({ id: String(p.id), code: String(p.code), name: String(p.name), stock: Number(p.stock ?? 0) }));

   const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('total, created_at, order_items(price, qty)')
    .order('created_at', { ascending: false });
   if (orderErr)
    return { totalBarang: 0, totalStok, totalPenjualan: 0, totalOmset: 0, lowStock };

   let totalPenjualan = 0;
   let totalOmset = 0;
   orders?.forEach((o) => {
    const items = o.order_items ?? [];
    const orderTotal = items.reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 0), 0);
    totalPenjualan += o.total ?? orderTotal;
    totalOmset += orderTotal;
   });

   return { totalBarang: totalBarang ?? 0, totalStok, totalPenjualan, totalOmset, lowStock };
}

// ===== PROFILE / ROLE (manajemen role user admin) =====

// mengambil role user yang sedang login berdasarkan email di tabel profiles
// mencari profiles dengan eq('email', user.email) lalu ambil kolom role
export async function adminGetRole(): Promise<'admin' | 'user' | null> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.email) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', data.user.email ?? '')
    .single(); // ambil satu baris profile
  return ((profile as any)?.role as 'admin' | 'user') ?? null;
}

// mengatur role user (set role) berdasarkan email
// jika profile belum ada -> insert baru (dengan user_id saat ini jika tersedia)
// jika sudah ada -> update role
export async function adminSetRole({ email, role }: { email: string; role: 'admin' | 'user' }) {
  // cek apakah profile sudah ada
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .single();
  if (!existing) {
    // profile belum ada -> insert baru
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase.from('profiles').insert({ user_id: uid as any, email, role });
    if (error) throw error;
  } else {
    // profile sudah ada -> update kolom role
    const { error } = await supabase.from('profiles').update({ role }).eq('email', email);
    if (error) throw error;
  }
}

// helper untuk mengecek apakah user saat ini adalah admin
export async function adminIsAdmin(): Promise<boolean> {
  const r = await adminGetRole();
  return r === 'admin';
}

// ===== SUPPLIER TYPE =====

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;

// ===== SUPPLIER CRUD =====

// mengambil daftar supplier (hanya yang aktif untuk dropdown)
export async function adminGetSuppliers({ activeOnly = true }: { activeOnly?: boolean } = {}): Promise<Supplier[]> {
  let q = supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    console.warn('[adminGetSuppliers] query gagal:', error.message);
    return [];
  }
  return (data as any[]).map((s) => ({
    id: String(s.id),
    code: String(s.code),
    name: String(s.name),
    contactPerson: String(s.contact_person ?? ''),
    phone: String(s.phone ?? ''),
    email: String(s.email ?? ''),
    address: String(s.address ?? ''),
    isActive: Boolean(s.is_active),
    createdAt: String(s.created_at),
    updatedAt: String(s.updated_at),
  }));
}

// mengambil semua supplier (admin, include inactive)
export async function adminGetAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.warn('[adminGetAllSuppliers] query gagal:', error.message);
    return [];
  }
  return (data as any[]).map((s) => ({
    id: String(s.id),
    code: String(s.code),
    name: String(s.name),
    contactPerson: String(s.contact_person ?? ''),
    phone: String(s.phone ?? ''),
    email: String(s.email ?? ''),
    address: String(s.address ?? ''),
    isActive: Boolean(s.is_active),
    createdAt: String(s.created_at),
    updatedAt: String(s.updated_at),
  }));
}

// menambahkan supplier baru
export async function adminAddSupplier(input: SupplierInput): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      code: input.code,
      name: input.name,
      contact_person: input.contactPerson,
      phone: input.phone,
      email: input.email,
      address: input.address,
      is_active: input.isActive,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

// update supplier
export async function adminUpdateSupplier(
  id: string,
  input: Partial<SupplierInput>
): Promise<{ error?: string }> {
  const updateData: any = {};
  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.contactPerson !== undefined) updateData.contact_person = input.contactPerson;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('suppliers')
    .update(updateData)
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// hapus supplier (soft delete: set is_active = false)
export async function adminDeleteSupplier(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ===== PO ENHANCEMENT: Partial Receive & Retur =====

// menerima PO per item (partial receive) via RPC
export async function adminReceivePOItem(poItemId: string, qty: number): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('mark_po_item_received', { p_po_item_id: poItemId, p_qty: qty });
  if (error) return { error: error.message };
  return {};
}

// retur PO per item via RPC
export async function adminReturnPOItem(poItemId: string, qty: number, reason: string = ''): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('mark_po_item_returned', { p_po_item_id: poItemId, p_qty: qty, p_reason: reason });
  if (error) return { error: error.message };
  return {};
}

// update status PO manual (workflow: draft → diajukan → dipesan → diterima → batal/retur)
export async function adminUpdatePOStatus(poId: string, status: 'draft' | 'diajukan' | 'dipesan' | 'diterima' | 'batal' | 'retur'): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('update_po_status', { p_po_id: poId, p_status: status });
  if (error) return { error: error.message };
  return {};
}

// ===== REPORT FUNCTIONS (untuk AdminPrintScreen) =====

// laporan stok dengan filter lokasi
export async function adminGetStockReport({ location }: { location?: string } = {}) {
  let q = supabase
    .from('products')
    .select('id, code, name, category, unit, price, purchase_price, stock, initial_stock, location')
    .order('name', { ascending: true });
  if (location) q = q.eq('location', location);
  const { data, error } = await q;
  if (error) return [];
  return (data as any[]).map((p) => ({
    id: String(p.id),
    code: String(p.code),
    name: String(p.name),
    category: String(p.category),
    unit: String(p.unit ?? 'pcs'),
    price: Number(p.price ?? 0),
    purchasePrice: Number(p.purchase_price ?? 0),
    stock: Number(p.stock ?? 0),
    initialStock: Number(p.initial_stock ?? 0),
    location: String(p.location ?? 'Gudang Utama'),
  }));
}

// laporan mutasi (stock_movements) dengan filter tanggal & tipe
export async function adminGetMutasiReport({
  startDate,
  endDate,
  type,
}: { startDate: string; endDate: string; type?: 'in' | 'out' } = { startDate: '', endDate: '' }) {
  let q = supabase
    .from('stock_movements')
    .select('*, products(code, name)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });
  if (type) q = q.eq('movement_type', type);
  const { data, error } = await q;
  if (error) return [];
  return (data as any[]).map((m) => ({
    id: String(m.id),
    productId: String(m.product_id),
    productCode: String(m.products?.code ?? ''),
    productName: String(m.products?.name ?? m.product_name ?? ''),
    movementType: String(m.movement_type),
    qty: Number(m.qty ?? 0),
    note: String(m.note ?? ''),
    adminName: String(m.admin_name ?? ''),
    createdAt: String(m.created_at),
  }));
}

// laporan PO dengan filter tanggal, status, supplier
export async function adminGetPOReport({
  startDate,
  endDate,
  status,
  supplierId,
}: { startDate: string; endDate: string; status?: string; supplierId?: string } = { startDate: '', endDate: '' }) {
  let q = supabase
    .from('v_purchase_orders_progress')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (supplierId) q = q.eq('supplier_id', supplierId);
  const { data, error } = await q;
  if (error) return [];
  return (data as any[]).map((po) => ({
    id: String(po.id),
    code: String(po.code),
    supplierId: String(po.supplier_id ?? ''),
    supplierName: String(po.supplier_name ?? ''),
    supplierCode: String(po.supplier_code ?? ''),
    status: String(po.status),
    total: Number(po.total ?? 0),
    notes: String(po.notes ?? ''),
    createdAt: String(po.created_at),
    receivedAt: po.received_at ? String(po.received_at) : null,
    totalOrdered: Number(po.total_ordered ?? 0),
    totalReceived: Number(po.total_received ?? 0),
    totalReturned: Number(po.total_returned ?? 0),
    receiveProgressPct: Number(po.receive_progress_pct ?? 0),
  }));
}

// ===== CSV EXPORT HELPER =====

// export array of objects ke CSV string
export function toCSV<T extends Record<string, any>>(headers: string[], rows: T[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerRow, ...dataRows].join('\n');
}

// download/share CSV file (client-side)
export async function exportCSV(filename: string, headers: string[], rows: any[]): Promise<{ error?: string }> {
  try {
    const csv = '\uFEFF' + toCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    // web: create download link
    if (typeof window !== 'undefined' && window.document) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return {};
    }
    
    // For native, we'd save to file first then share
    // Simplified: just return success for now
    return {};
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal export CSV' };
  }
}