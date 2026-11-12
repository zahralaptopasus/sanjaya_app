// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useCallback, useMemo, useState
import React, { useCallback, useMemo, useState } from 'react';
// mengambil komponen React Native: View, Text, SectionList, StyleSheet, TouchableOpacity, Alert, RefreshControl
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
// mengambil hook useFocusEffect untuk menjalankan kode saat layar fokus
import { useFocusEffect } from '@react-navigation/native';
// mengambil SafeAreaView (area aman dari status bar karena header bawaan dimatikan)
import { SafeAreaView } from 'react-native-safe-area-context';
// mengambil ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil fungsi getMyOrders untuk riwayat pesanan dan getProducts untuk aksi "Beli Lagi"
import { getMyOrders, getProducts } from '../repo';
// mengambil fungsi rp untuk format Rupiah
import { rp } from '../lib/format';
// mengambil tipe Order dari models
import type { Order } from '../models';
// mengambil state management keranjang (untuk menambahkan ulang item) dan mode tamu
import { useCart } from '../store/cart';
import { useGuest } from '../store/guest';
// mengambil hook palet warna dinamis (Terang/Gelap), tipe palet, dan font
import { useColors } from '../store/preferences';
import { F, type Palette } from '../theme';
// mengambil komponen loader halaman (spinner di tengah)
import PageLoader from '../components/PageLoader';
import { getRootNav } from '../lib/navigationHelpers';

// ===== DEFINISI STATUS =====

// kunci kelompok status yang dipakai untuk filter dan pewarnaan
type Group = 'pending' | 'paid' | 'failed' | 'other';

// memetakan status mentah dari database ke kelompok status aplikasi
function groupOf(status: string): Group {
  // ubah ke huruf kecil agar pencocokan aman
  const s = String(status ?? '').toLowerCase();
  // kelompok lunas
  if (s === 'paid' || s === 'settlement' || s === 'capture') return 'paid';
  // kelompok menunggu pembayaran
  if (s === 'pending') return 'pending';
  // kelompok gagal / batal / kadaluarsa
  if (s === 'cancelled' || s === 'failed' || s === 'expired' || s === 'cancel' || s === 'deny') return 'failed';
  // sisanya netral
  return 'other';
}

// mengambil tampilan (label + warna) untuk sebuah status; warna diambil dari palet aktif
function styleOf(status: string, c: Palette) {
  // tentukan kelompoknya lebih dulu
  const g = groupOf(status);
  // menunggu pembayaran: kuning/amber
  if (g === 'pending') return { label: 'Menunggu', bg: c.accent + '33', color: c.warn };
  // lunas: hijau
  if (g === 'paid') return { label: 'Lunas', bg: c.success + '22', color: c.success };
  // gagal/batal: merah
  if (g === 'failed') return { label: 'Gagal', bg: c.dangerSoft, color: c.danger };
  // lainnya: netral
  return { label: 'Pesanan', bg: c.chip, color: c.textMuted };
}

// daftar pilihan filter di bawah header
const FILTERS: { key: 'all' | Group; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'paid', label: 'Lunas' },
  { key: 'failed', label: 'Gagal' },
];

// nama bulan singkat bahasa Indonesia untuk label tanggal
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// membuat label kelompok tanggal: "Hari ini", "Kemarin", atau "12 Okt 2026"
function dayLabel(iso: string): string {
  // ubah string ISO menjadi Date
  const d = new Date(iso);
  const now = new Date();
  // normalisasi ke awal hari agar selisih dihitung dalam satuan hari
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  // selisih hari antara hari ini dan tanggal pesanan
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  // jika hari ini atau kemarin, pakai label ramah
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  // selain itu tampilkan tanggal lengkap
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// menampilkan jam pesanan dalam format HH:mm
function timeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// menyusun teks preview item: nama pertama (+N item lainnya bila lebih dari satu)
function previewText(o: Order): string {
  const first = o.items[0]?.name ?? 'Pesanan';
  const extra = Math.max(0, o.items.length - 1);
  return extra > 0 ? `${first}  +${extra} item lainnya` : first;
}

// ===== KOMPONEN UTAMA =====

// komponen layar Riwayat Pesanan
export default function OrdersScreen({ navigation }: any) {
  // state untuk menyimpan daftar pesanan user
  const [orders, setOrders] = useState<Order[]>([]);
  // state penanda sedang loading data
  const [loading, setLoading] = useState(true);
  // state penanda sedang tarik-untuk-refresh (pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);
  // state filter aktif (Semua / Menunggu / Lunas / Gagal)
  const [filter, setFilter] = useState<'all' | Group>('all');
  // mengambil info mode tamu dan fungsi keranjang (untuk aksi "Beli Lagi")
  const { isGuest } = useGuest();
  const cart = useCart();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // fungsi: ambil riwayat pesanan dari server (dipakai saat layar fokus dan saat pull-to-refresh)
  const load = useCallback(async () => {
    // jika mode tamu, cukup hentikan loading tanpa fetch data
    if (isGuest) { setLoading(false); return; }
    // mengambil riwayat pesanan dari server
    const o = await getMyOrders();
    // perbarui daftar pesanan
    setOrders(o);
    // matikan penanda loading awal
    setLoading(false);
  }, [isGuest]);

  // useFocusEffect dijalankan saat layar mendapatkan fokus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // fungsi: muat ulang pesanan saat layar ditarik ke bawah
  const onRefresh = async () => {
    // nyalakan indikator refresh
    setRefreshing(true);
    // ambil ulang data lalu tunggu selesai
    await load();
    // matikan indikator refresh
    setRefreshing(false);
  };

  // jumlah pesanan per filter (untuk angka di chip)
  const countOf = useCallback(
    (key: 'all' | Group) => (key === 'all' ? orders.length : orders.filter((o) => groupOf(o.status) === key).length),
    [orders],
  );

  // daftar pesanan setelah disaring sesuai filter aktif
  const visible = useMemo(
    () => orders.filter((o) => filter === 'all' || groupOf(o.status) === filter),
    [orders, filter],
  );

  // mengelompokkan pesanan per tanggal menjadi seksi (Hari ini / Kemarin / tanggal)
  const sections = useMemo(() => {
    // peta label tanggal -> daftar pesanan
    const map = new Map<string, { title: string; data: Order[] }>();
    // pesanan sudah urut terbaru, sehingga kelompok pun urut
    visible.forEach((o) => {
      const label = dayLabel(o.createdAt);
      if (!map.has(label)) map.set(label, { title: label, data: [] });
      map.get(label)!.data.push(o);
    });
    return Array.from(map.values());
  }, [visible]);

  // ringkasan header: jumlah pesanan
  const orderCount = orders.length;

  // membuka layar Struk untuk sebuah pesanan
  const openReceipt = (item: Order) => {
    getRootNav(navigation).navigate('Receipt', {
      // kode pesanan untuk tampilan struk
      orderId: item.code,
      // ID asli (UUID) untuk mengambil status asli dari database
      dbId: item.id,
      paidAt: item.createdAt,
      items: item.items.map((i) => ({ product: { id: i.product_id, code: '', name: i.name, category: '', price: i.price, stock: 0 }, qty: i.qty })),
      subtotal: item.total,
      discount: 0,
      coupon: null,
      // metode pembayaran agar struk langsung tahu COD / Midtrans
      paymentMethod: item.paymentMethod ?? 'midtrans',
      // status awal agar tampilan struk tidak berkedip status lain
      initialStatus: item.status,
    });
  };

  // aksi "Bayar Lagi"/"Beli Lagi": siapkan ulang item pesanan di keranjang lalu langsung buka Checkout
  const retryOrder = async (order: Order) => {
    // ambil daftar produk terkini (untuk harga & stok terbaru)
    const products = await getProducts();
    // buat peta id -> produk agar pencarian cepat
    const byId = new Map(products.map((p) => [p.id, p]));
    // kosongkan keranjang agar berisi ulang item pesanan ini saja
    cart.clear();
    // hitung berapa item yang berhasil ditambahkan
    let added = 0;
    // telusuri tiap item pesanan
    order.items.forEach((it) => {
      const p = byId.get(it.product_id);
      // hanya tambahkan bila produk masih dijual
      if (p) { cart.add(p, it.qty); added += 1; }
    });
    // jika tidak ada yang bisa ditambahkan, beri tahu pengguna
    if (added === 0) {
      Alert.alert('Produk tidak tersedia', 'Produk pada pesanan ini sudah tidak dijual lagi.');
      return;
    }
    // langsung buka layar Checkout (bukan keranjang) agar bisa langsung bayar
    getRootNav(navigation).navigate('Checkout');
  };

  // jika sedang loading, tampilkan loader di tengah halaman
  if (loading) return <PageLoader />;

  // jika mode tamu, blokir akses riwayat pesanan
  if (isGuest) {
    return (
      // wadah aman status bar + header biru
      <SafeAreaView style={{ flex: 1, backgroundColor: c.primary }} edges={['top']}>
        {/* header biru halaman pesanan */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Riwayat Pesanan</Text>
          <Text style={styles.headerSub}>Riwayat tersimpan di akunmu</Text>
        </View>
        {/* isi: pemberitahuan harus login */}
        <View style={styles.guestBox}>
          {/* ikon gembok */}
          <Ionicons name="lock-closed" size={44} color={c.textMuted} />
          {/* judul blokir */}
          <Text style={styles.guestTitle}>Login dulu, ya</Text>
          {/* penjelasan */}
          <Text style={styles.guestText}>Riwayat pesanan hanya muncul untuk pengguna yang sudah masuk.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // tampilkan daftar riwayat pesanan
  return (
    // wadah aman status bar + header biru (latar primary agar area status bar menyatu sampai atas)
    <SafeAreaView style={{ flex: 1, backgroundColor: c.primary }} edges={['top']}>
      {/* ===== HEADER biru: judul di kiri ===== */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Riwayat Pesanan</Text>
        <Text style={styles.headerSub}>{orderCount} pesanan tercatat</Text>
        {/* garis aksen kuning tipis sebagai detail brand */}
        <View style={styles.accentLine} />
      </View>

      {/* ===== BARIS FILTER ===== */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => {
          // apakah chip ini sedang aktif
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>{countOf(f.key)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ===== DAFTAR PESANAN (dikelompokkan per tanggal) ===== */}
      <SectionList
        // daftar seksi (Hari ini / Kemarin / tanggal)
        sections={sections}
        // latar abu + mengisi sisa ruang (agar area daftar tidak ikut biru seperti area status bar)
        style={{ backgroundColor: c.bg, flex: 1 }}
        // kunci unik tiap item (id pesanan)
        keyExtractor={(o) => o.id}
        // header seksi menempel di atas saat digulir
        stickySectionHeadersEnabled={false}
        // gaya konten daftar
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, flexGrow: 1 }}
        // refreshControl = fitur tarik layar ke bawah untuk memuat ulang riwayat pesanan
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        // sembunyikan indikator gulir
        showsVerticalScrollIndicator={false}
        // judul tiap kelompok tanggal + garis pemisah tipis
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.sectionLine} />
          </View>
        )}
        // menggambar satu kartu pesanan
        renderItem={({ item }) => {
          // gaya & label status
          const st = styleOf(item.status, c);
          // jumlah unit barang pada pesanan
          const qty = item.items.reduce((a, e) => a + e.qty, 0);
          // apakah pesanan masih menunggu pembayaran
          const isPending = groupOf(item.status) === 'pending';
          // apakah pesanan gagal/batal (tombolnya "Bayar Lagi")
          const isFailed = groupOf(item.status) === 'failed';
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openReceipt(item)}>
              {/* garis status berwarna di tepi kiri kartu */}
              <View style={[styles.rail, { backgroundColor: st.color }]} />
              {/* isi kartu */}
              <View style={styles.cardBody}>
                {/* baris atas: kode pesanan + pill status */}
                <View style={styles.cardTop}>
                  {/* kode pesanan + penanda COD bila memakai tunai di tempat */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                    <Text style={styles.code} numberOfLines={1}>#{item.code}</Text>
                    {item.paymentMethod === 'cod' ? (
                      <View style={styles.codBadge}><Text style={styles.codBadgeText}>COD</Text></View>
                    ) : null}
                  </View>
                  {/* pill status dengan titik warna */}
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <View style={[styles.pillDot, { backgroundColor: st.color }]} />
                    <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* preview nama produk + jumlah item lainnya */}
                <Text style={styles.preview} numberOfLines={1}>{previewText(item)}</Text>

                {/* baris bawah: waktu & total di kiri, aksi cepat + panah di kanan */}
                <View style={styles.cardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.time}>{timeStr(item.createdAt)} WIB · {qty} item</Text>
                    <Text style={styles.total}>{rp(item.total)}</Text>
                  </View>
                  <View style={styles.actions}>
                    {/* aksi cepat menyesuaikan status */}
                    {isPending && item.paymentMethod === 'cod' ? (
                      // COD menunggu: buka struk untuk melihat instruksi bayar di tempat
                      <TouchableOpacity style={styles.btnReorder} onPress={() => openReceipt(item)}>
                        <Text style={styles.btnReorderText}>Detail</Text>
                      </TouchableOpacity>
                    ) : isPending ? (
                      // pesanan menunggu: buka struk yang punya tombol pembayaran
                      <TouchableOpacity style={styles.btnPay} onPress={() => openReceipt(item)}>
                        <Text style={styles.btnPayText}>Bayar</Text>
                      </TouchableOpacity>
                    ) : (
                      // pesanan lunas/gagal: siapkan ulang item lalu langsung buka Checkout
                      <TouchableOpacity style={styles.btnReorder} onPress={() => retryOrder(item)}>
                        <Text style={styles.btnReorderText}>{isFailed ? 'Bayar Lagi' : 'Beli Lagi'}</Text>
                      </TouchableOpacity>
                    )}
                    {/* panah penanda kartu bisa dibuka */}
                    <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        // komponen jika daftar kosong (data kosong maupun filter tanpa hasil)
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={orderCount === 0 ? 'receipt-outline' : 'funnel-outline'} size={40} color={c.textFaint} />
            <Text style={styles.emptyTitle}>
              {orderCount === 0 ? 'Belum ada pesanan' : 'Tidak ada di kategori ini'}
            </Text>
            <Text style={styles.emptyText}>
              {orderCount === 0
                ? 'Kalau ada sparepart yang perlu diganti, tinggal pesan — kami siap.'
                : 'Coba pilih filter lain untuk melihat pesananmu.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // header biru
  header: { backgroundColor: c.primary, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16 },
  // judul header: putih, tebal (Poppins), ukuran 20
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: F.heading },
  // subjudul: putih transparan
  headerSub: { color: 'rgba(255,255,255,0.68)', fontSize: 12, marginTop: 3, fontFamily: F.regular },
  // garis aksen kuning tipis di bawah header
  accentLine: { height: 3, width: 40, backgroundColor: c.accent, borderRadius: 3, marginTop: 12 },
  // baris filter chip
  filterBar: {
    backgroundColor: c.card, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', gap: 8, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  // chip filter default (belum aktif)
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card,
  },
  // chip aktif
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  // teks chip
  chipText: { fontSize: 12, color: c.textMuted, fontFamily: F.semibold },
  // teks chip aktif
  chipTextActive: { color: '#fff' },
  // angka jumlah pada chip
  chipCount: { fontSize: 11, color: c.textFaint, fontFamily: F.bold },
  // angka jumlah pada chip aktif
  chipCountActive: { color: c.accent },
  // judul kelompok tanggal
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  // teks label tanggal: huruf kecil, spasi lebar
  sectionLabel: { fontSize: 11, fontFamily: F.bold, color: c.textMuted, letterSpacing: 1.2 },
  // garis pemisah tipis di kanan label
  sectionLine: { flex: 1, height: 1, backgroundColor: c.border, marginLeft: 10 },
  // kartu pesanan
  card: {
    flexDirection: 'row', backgroundColor: c.card, borderRadius: 14, overflow: 'hidden',
    marginBottom: 10, borderWidth: 1, borderColor: c.border,
    shadowColor: c.primary, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  // garis status berwarna di tepi kiri
  rail: { width: 5 },
  // isi kartu
  cardBody: { flex: 1, padding: 12 },
  // baris atas kartu
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // kode pesanan
  code: { fontSize: 14, fontFamily: F.extrabold, color: c.text },
  // penanda metode pembayaran COD
  codBadge: { backgroundColor: c.chip, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  // teks penanda COD
  codBadgeText: { fontSize: 9, fontFamily: F.extrabold, color: c.warn, letterSpacing: 0.5 },
  // pill status
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  // titik warna pada pill
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  // teks pill
  pillText: { fontSize: 10, fontFamily: F.extrabold },
  // preview item
  preview: { fontSize: 13, color: c.text, marginTop: 6, fontFamily: F.regular },
  // baris bawah kartu
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  // waktu & jumlah item
  time: { fontSize: 11, color: c.textMuted },
  // total pesanan
  total: { fontSize: 16, fontFamily: F.extrabold, color: c.primary, marginTop: 2 },
  // wadah aksi cepat
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // tombol "Bayar": kuning aksen solid
  btnPay: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  // teks tombol "Bayar"
  btnPayText: { color: '#261A00', fontSize: 12, fontFamily: F.extrabold },
  // tombol "Beli Lagi": outline biru utama
  btnReorder: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: c.primary },
  // teks tombol "Beli Lagi"
  btnReorderText: { color: c.primary, fontSize: 12, fontFamily: F.bold },
  // kotak empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  // judul empty state
  emptyTitle: { marginTop: 12, fontSize: 15, fontFamily: F.bold, color: c.text },
  // keterangan empty state
  emptyText: { marginTop: 6, fontSize: 13, color: c.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  // kotak gate tamu
  guestBox: { flex: 1, padding: 16, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  // judul gate tamu
  guestTitle: { fontSize: 17, fontFamily: F.extrabold, color: c.text, marginTop: 12 },
  // keterangan gate tamu
  guestText: { fontSize: 13, color: c.textMuted, marginTop: 4, textAlign: 'center' },
});
