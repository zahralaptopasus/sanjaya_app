// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React, hook useEffect (saat layar dibuka), useState (data yang bisa berubah), useMemo (menghitung ulang hanya jika data berubah), dan useCallback
import React, { useMemo, useRef, useState, useCallback } from 'react';
// mengambil useFocusEffect untuk reload saat tab fokus
import { useFocusEffect } from '@react-navigation/native';
// mengambil komponen React Native:
// View (kotak), Text (teks), ScrollView (area gulir), StyleSheet (pembuat style),
// TextInput (kolom ketik), TouchableOpacity (tombol), Alert (popup), ActivityIndicator (loading), RefreshControl (refresh)
// Modal (jendela popup dari bawah), FlatList (daftar panjang yang efisien),
// KeyboardAvoidingView (menggeser isi saat keyboard muncul), Platform (mengetahui iOS atau Android)
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil fungsi: ambil produk, catat stok masuk, catat stok keluar, dan ambil riwayat pergerakan stok
import { adminGetProducts, adminLogStockIn, adminLogStockOut, adminGetStockMovements } from '../../lib/admin';
import { useLowStock } from '../../context/LowStockContext';
import { useNewMovements } from '../../context/NewMovementsContext';
// mengambil tipe data Product dari models
import type { Product } from '../../models';
// mengambil helper terpusat (catOf)
import { catOf } from '../../lib/helpers';
// mengambil warna dari theme agar tampilan konsisten
import { navy, surface, cardBg, chipBg, muted, ink, bronze, amber } from '../../theme';

// ===== TIPE DATA =====

// tipe "Movement" menjelaskan bentuk satu baris riwayat aliran barang
type Movement = { 
  id: string; 
  productId: string; 
  productName: string; 
  movementType: string; 
  qty: number; 
  note: string; 
  adminName: string; 
  createdAt: string;
};

// ===== KOMPONEN UTAMA =====

// komponen layar Aliran Barang (barang masuk & keluar)
export default function AdminFlowScreen() {
  // daftar produk dari server
  const [products, setProducts] = useState<Product[]>([]);
  // daftar riwayat pergerakan stok
  const [movements, setMovements] = useState<Movement[]>([]);
  // penanda data pertama kali sedang dimuat
  const [loading, setLoading] = useState(true);
  // penanda layar sedang di-refresh (tarik ke bawah)
  const [refreshing, setRefreshing] = useState(false);
  // id produk yang dipilih (null = belum memilih, pakai produk pertama)
  const [selId, setSelId] = useState<string | null>(null);
  // penanda modal pemilih barang terbuka
  const [pickerOpen, setPickerOpen] = useState(false);
  // isi pencarian di modal
  const [search, setSearch] = useState('');
  // kategori filter aktif
  const [cat, setCat] = useState('Semua');
  // arah transaksi: 'in' (masuk) atau 'out' (keluar); default 'in'
  const [dir, setDir] = useState<'in' | 'out'>('in');
  // isi input jumlah barang
  const [qty, setQty] = useState('');
  // isi input catatan (opsional)
  const [note, setNote] = useState('');
  // penanda proses penyimpanan sedang berjalan
  const [saving, setSaving] = useState(false);
  const { refresh: refreshLowStock } = useLowStock();
  const { refresh: refreshNewMovements } = useNewMovements();
  
  // filter riwayat
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // modal detail movement
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  // daftar kategori unik untuk chip filter
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(catOf))).sort();
    return ['Semua', ...list];
  }, [products]);

  // daftar produk hasil pencarian + filter kategori
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = cat === 'Semua' || catOf(p) === cat;
      const okSearch = q === '' || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return okCat && okSearch;
    });
  }, [products, search, cat]);

  // nomor urut permintaan: dipakai untuk mengabaikan hasil request lama yang telat tiba
  // (mis. user ganti filter saat request sebelumnya masih berjalan)
  const reqSeq = useRef(0);

  // fungsi "load" mengambil produk & riwayat sekaligus secara paralel dengan filter
  // useCallback menjaga identitas "load" tetap sama selama filter tidak berubah
  const load = useCallback(async () => {
    // tandai permintaan ini sebagai yang terbaru
    const seq = ++reqSeq.current;
    // Promise.all menjalankan dua pengambilan data bersamaan lalu menunggu keduanya selesai
    const [p, m] = await Promise.all([
      adminGetProducts(),
      adminGetStockMovements({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: filterType === 'all' ? undefined : filterType,
      })
    ]);
    // abaikan hasil kalau ternyata ada permintaan yang lebih baru (mencegah data lama menimpa data baru)
    if (seq !== reqSeq.current) return;
    // simpan daftar produk ke state
    setProducts(p);
    // simpan riwayat pergerakan ke state
    setMovements(m);
    // hentikan loading
    setLoading(false);
    // hentikan status refresh
    setRefreshing(false);
    // refresh badge movements
    await refreshNewMovements();
  }, [startDate, endDate, filterType, refreshNewMovements]);

  // muat data saat layar pertama dibuka & saat tab difokuskan.
  // karena "load" ikut berubah saat filter berubah, efek ini otomatis reload juga saat filter diganti.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
      })();
    }, [load])
  );

  // hitung summary hari ini
  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMovements = movements.filter(m => m.createdAt.startsWith(today));
    const totalIn = todayMovements.filter(m => m.movementType === 'in').reduce((sum, m) => sum + m.qty, 0);
    const totalOut = todayMovements.filter(m => m.movementType === 'out').reduce((sum, m) => sum + m.qty, 0);
    return { totalIn, totalOut };
  }, [movements]);

  // buka modal detail
  const openDetail = (m: Movement) => {
    setSelectedMovement(m);
    setDetailOpen(true);
  };

  // tutup modal pemilih sekaligus reset pencarian dan filter
  const closePicker = () => {
    setPickerOpen(false);
    setSearch('');
    setCat('Semua');
  };

  // pilih produk dari modal
  const pickProduct = (p: Product) => {
    setSelId(p.id);
    closePicker();
  };

  // fungsi "save" untuk menyimpan transaksi barang masuk/keluar
  const save = async () => {
    const prod = products.find((x) => x.id === selId) ?? products[0];
    // jika tidak ada produk terpilih, tampilkan peringatan dan berhenti
    if (!prod) {
      Alert.alert('Pilih barang', 'Inventaris masih kosong.');
      return;
    }
    // ubah input jumlah menjadi angka bulat
    const q = Math.trunc(Number(qty));
    // jika jumlah bukan angka valid atau <= 0, tampilkan peringatan dan berhenti
    if (isNaN(q) || q <= 0) {
      Alert.alert('Jumlah salah', 'Masukkan jumlah lebih dari 0.');
      return;
    }
    // tandai sedang menyimpan
    setSaving(true);
    // blok try untuk kode yang bisa gagal
    try {
      // objek dasar data transaksi; note kosong dikirim undefined; adminName default 'Admin'
      const base = { productId: prod.id, productName: prod.name, qty: q, note: note.trim() || undefined, adminName: 'Admin' };
      // jika arah masuk, catat stok masuk; selain itu catat stok keluar
      if (dir === 'in') await adminLogStockIn(base);
      else await adminLogStockOut(base);
      // kosongkan input jumlah setelah berhasil
      setQty('');
      // kosongkan input catatan setelah berhasil
      setNote('');
      // muat ulang data agar riwayat terbaru tampil
      load();
      // segarkan jumlah stok minimum (badge tab Inventaris)
      void refreshLowStock();
    // blok catch jika terjadi error
    } catch (e: any) {
      // tampilkan popup gagal dengan pesan error (jika ada)
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa simpan transaksi.');
    // blok finally selalu dijalankan
    } finally {
      // akhiri status menyimpan
      setSaving(false);
    }
  };

  // jika masih loading, tampilkan animasi loading dan hentikan
  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: 'center' }} />;

  // produk yang sedang dipilih (fallback ke produk pertama)
  const prod = products.find((x) => x.id === selId) ?? products[0];

  // return = tampilan layar
  return (
    <>
      {/* area yang bisa digulir */}
      <ScrollView
      // latar halaman
      style={{ backgroundColor: surface }}
      // jarak isi 16 dan jarak bawah 40
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      // tarik ke bawah untuk refresh; set refreshing lalu load ulang
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={navy} />}
    >
      {/* judul halaman */}
      <Text style={styles.header}>Aliran Barang</Text>
      {/* keterangan kecil di bawah judul */}
      <Text style={styles.sub}>Catat barang masuk & keluar</Text>

      {/* kotak formulir input transaksi */}
      <View style={styles.form}>
        {/* judul formulir */}
        <Text style={styles.formTitle}>Input Transaksi</Text>
        {/* tombol pemilih produk; ditekan membuka modal pencarian & filter */}
        <TouchableOpacity style={styles.prodBtn} onPress={() => setPickerOpen(true)} disabled={products.length === 0}>
          {/* ikon kubus sebagai penanda barang */}
          <Ionicons name="cube" size={16} color={bronze} />
          {/* wadah teks produk yang mengisi ruang */}
          <View style={{ flex: 1 }}>
            {/* nama produk (maksimal 1 baris), atau pesan jika belum ada barang */}
            <Text style={styles.prodName} numberOfLines={1}>{prod ? prod.name : 'Belum ada barang'}</Text>
            {/* kode + stok produk, atau ajakan menambah di Inventaris */}
            <Text style={styles.prodCode}>{prod ? `${prod.code} • stok ${prod.stock}` : 'tambah dulu di Inventaris'}</Text>
          </View>
          {/* ikon pencarian sebagai petunjuk bisa dicari */}
          <Ionicons name="search" size={16} color={muted} />
        </TouchableOpacity>

        {/* baris dua tombol arah: Masuk / Keluar */}
        <View style={styles.dirRow}>
          {/* tombol "Masuk"; diberi style aktif dirIn jika dir === 'in' */}
          <TouchableOpacity style={[styles.dirBtn, dir === 'in' && styles.dirIn]} onPress={() => setDir('in')}>
            {/* ikon panah bawah; warnanya tergantung apakah tombol aktif */}
            <Ionicons name="arrow-down" size={15} color={dir === 'in' ? '#261A00' : muted} />
            {/* teks "Masuk" dengan style aktif bila dipilih */}
            <Text style={[styles.dirText, dir === 'in' && styles.dirTextActive]}>Masuk</Text>
          </TouchableOpacity>
          {/* tombol "Keluar"; diberi style aktif dirOut jika dir === 'out' */}
          <TouchableOpacity style={[styles.dirBtn, dir === 'out' && styles.dirOut]} onPress={() => setDir('out')}>
            {/* ikon panah atas */}
            <Ionicons name="arrow-up" size={15} color={dir === 'out' ? '#fff' : muted} />
            {/* teks "Keluar" berwarna putih saat aktif */}
            <Text style={[styles.dirText, dir === 'out' && styles.dirTextWhite]}>Keluar</Text>
          </TouchableOpacity>
        </View>

        {/* input jumlah, keyboard angka */}
        <TextInput style={styles.input} placeholder="Jumlah" placeholderTextColor={muted} keyboardType="number-pad" value={qty} onChangeText={setQty} />
        {/* input catatan opsional */}
        <TextInput style={styles.input} placeholder="Catatan (opsional)" placeholderTextColor={muted} value={note} onChangeText={setNote} />
        {/* tombol simpan transaksi; nonaktif saat menyimpan */}
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {/* teks tombol berubah sesuai status menyimpan */}
          <Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan Transaksi'}</Text>
        </TouchableOpacity>
      </View>

      {/* ===== SUMMARY CARDS ===== */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryIn]}>
          <Ionicons name="arrow-down" size={16} color="#261A00" />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Masuk Hari Ini</Text>
            <Text style={styles.summaryValue}>+{todaySummary.totalIn}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, styles.summaryOut]}>
          <Ionicons name="arrow-up" size={16} color="#BA1A1A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Keluar Hari Ini</Text>
            <Text style={styles.summaryValue}>-{todaySummary.totalOut}</Text>
          </View>
        </View>
      </View>

      {/* ===== FILTER TANGGAL + TIPE ===== */}
      <View style={styles.filterBox}>
        <Text style={styles.filterTitle}>Filter</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Dari (YYYY-MM-DD)" 
          placeholderTextColor={muted} 
          value={startDate} 
          onChangeText={setStartDate} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Sampai (YYYY-MM-DD)" 
          placeholderTextColor={muted} 
          value={endDate} 
          onChangeText={setEndDate} 
        />
        <View style={styles.filterChips}>
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]} 
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>Semua</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'in' && styles.filterChipActive]} 
            onPress={() => setFilterType('in')}
          >
            <Text style={[styles.filterChipText, filterType === 'in' && styles.filterChipTextActive]}>Masuk</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'out' && styles.filterChipActive]} 
            onPress={() => setFilterType('out')}
          >
            <Text style={[styles.filterChipText, filterType === 'out' && styles.filterChipTextActive]}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* judul riwayat beserta jumlah transaksi */}
      <Text style={styles.listTitle}>Riwayat Aliran ({movements.length})</Text>
      {/* jika riwayat kosong tampilkan pesan; jika ada lakukan perulangan */}
      {movements.length === 0 ? (
        <Text style={styles.empty}>Belum ada transaksi.</Text>
      ) : (
        // perulangan setiap movement m; key = id unik
        movements.map((m) => (
          <TouchableOpacity key={m.id} style={styles.row} onPress={() => openDetail(m)}>
            {/* lingkaran ikon; warnanya beda untuk masuk/keluar (dotIn / dotOut) */}
            <View style={[styles.dot, m.movementType === 'in' ? styles.dotIn : styles.dotOut]}>
              {/* ikon panah turun (masuk) atau naik (keluar) */}
              <Ionicons name={m.movementType === 'in' ? 'arrow-down' : 'arrow-up'} size={14} color={m.movementType === 'in' ? '#261A00' : '#BA1A1A'} />
            </View>
            {/* wadah informasi yang mengisi ruang */}
            <View style={{ flex: 1 }}>
              {/* nama produk (maks 1 baris) */}
              <Text style={styles.rowName} numberOfLines={1}>{m.productName}</Text>
              {/* keterangan "Barang masuk/keluar" ditambah catatan bila ada */}
              <Text style={styles.rowSub}>{m.movementType === 'in' ? 'Barang masuk' : 'Barang keluar'}{m.note ? ` • ${m.note}` : ''}</Text>
              {/* tanggal & waktu transaksi dalam format lokal Indonesia */}
              <Text style={styles.rowDate}>{new Date(m.createdAt).toLocaleString('id')}</Text>
            </View>
            {/* jumlah dengan tanda + atau -, warnanya beda untuk masuk/keluar */}
            <Text style={[styles.qty, m.movementType === 'in' ? styles.qtyIn : styles.qtyOut]}>
              {m.movementType === 'in' ? '+' : '-'}{m.qty}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>

      {/* ===== MODAL PEMILIH BARANG (pencarian + filter kategori) ===== */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={closePicker}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* overlay gelap - tap untuk tutup */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closePicker} />
          {/* sheet putih di bawah */}
          <View style={styles.sheet}>
            {/* header sheet */}
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Pilih Barang</Text>
              <TouchableOpacity onPress={closePicker}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>

            {/* search box */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau kode barang..."
                placeholderTextColor={muted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* chip kategori horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
              {categories.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, cat === c && styles.chipActive]} onPress={() => setCat(c)}>
                  <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* jumlah hasil */}
            <Text style={styles.resultCount}>{filtered.length} barang</Text>

            {/* daftar barang hasil filter */}
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>Barang tidak ditemukan.</Text>}
              renderItem={({ item: p }) => {
                const active = prod?.id === p.id;
                return (
                  <TouchableOpacity style={[styles.pickRow, active && styles.pickRowActive]} onPress={() => pickProduct(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.prodCode}>{p.code} • {catOf(p)} • stok {p.stock}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={navy} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL DETAIL MOVEMENT ===== */}
      <Modal visible={detailOpen} animationType="fade" transparent onRequestClose={() => setDetailOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDetailOpen(false)}>
          <View style={styles.detailModal} onStartShouldSetResponder={() => true}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setDetailOpen(false)}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>
            {selectedMovement && (
              <View style={styles.detailBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Produk</Text>
                  <Text style={styles.detailValue}>{selectedMovement.productName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tipe</Text>
                  <Text style={styles.detailValue}>{selectedMovement.movementType === 'in' ? 'Barang Masuk' : 'Barang Keluar'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jumlah</Text>
                  <Text style={[styles.detailValue, selectedMovement.movementType === 'in' ? styles.qtyIn : styles.qtyOut]}>
                    {selectedMovement.movementType === 'in' ? '+' : '-'}{selectedMovement.qty}
                  </Text>
                </View>
                {selectedMovement.note && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Catatan</Text>
                    <Text style={styles.detailValue}>{selectedMovement.note}</Text>
                  </View>
                )}
                {selectedMovement.adminName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Admin</Text>
                    <Text style={styles.detailValue}>{selectedMovement.adminName}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Waktu</Text>
                  <Text style={styles.detailValue}>{new Date(selectedMovement.createdAt).toLocaleString('id')}</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ===== STYLE (pengaturan tampilan) =====

const styles = StyleSheet.create({
  // judul halaman: ukuran 20, font Poppins tebal, warna ink
  header: { fontSize: 20, fontFamily: 'Poppins_800ExtraBold',  color: ink },
  // keterangan di bawah judul: ukuran 12, warna abu, jarak atas 2, bawah 14
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 14 },
  // kotak formulir: latar cardBg, sudut 16, padding 14, jarak bawah 18, garis tepi krem
  form: { backgroundColor: cardBg, borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#E5DFD1' },
  // judul formulir: ukuran 14, font Poppins tebal, warna ink, jarak bawah 10
  formTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold',  color: ink, marginBottom: 10 },
  // tombol pemilih produk: menyamping, rata tengah, jarak elemen 8, latar chipBg, sudut 10, padding 10, jarak bawah 10
  prodBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: chipBg, borderRadius: 10, padding: 10, marginBottom: 10 },
  // nama produk: ukuran 13, font tebal, warna ink
  prodName: { fontSize: 13, fontFamily: 'Inter_700Bold',  color: ink },
  // kode produk: ukuran 10, warna abu, jarak atas 1
  prodCode: { fontSize: 10, color: muted, marginTop: 1 },
  // baris tombol arah: menyamping, jarak elemen 8, jarak bawah 8
  dirRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  // tombol arah dasar: membagi lebar sama (flex 1), isi menyamping & tengah, garis tepi abu, latar putih
  dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingVertical: 10, backgroundColor: '#fff' },
  // style saat "Masuk" aktif: latar amber, garis tepi amber
  dirIn: { backgroundColor: amber, borderColor: amber },
  // style saat "Keluar" aktif: latar navy, garis tepi navy
  dirOut: { backgroundColor: navy, borderColor: navy },
  // teks tombol arah: ukuran 13, font tebal, warna abu
  dirText: { fontSize: 13, fontFamily: 'Inter_700Bold',  color: muted },
  // teks aktif "Masuk": warna coklat tua
  dirTextActive: { color: '#261A00' },
  // teks aktif "Keluar": warna putih
  dirTextWhite: { color: '#fff' },
  // wadah dua input: menyamping
  duo: { flexDirection: 'row' },
  // kolom input: latar putih, garis tepi abu, sudut 10, padding horizontal 12, vertikal 10, teks 13, jarak bawah 8
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 8 },
  // tombol simpan: latar navy, sudut 10, padding vertikal 12, isi rata tengah
  saveBtn: { backgroundColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  // teks tombol simpan: ukuran 13, font tebal, warna putih
  saveText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold',  color: '#fff' },
  // judul riwayat: ukuran 15, font Poppins tebal, warna ink, jarak bawah 10
  listTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold',  color: ink, marginBottom: 10 },
  // pesan kosong: rata tengah, warna abu, jarak atas 20, ukuran 13
  empty: { textAlign: 'center', color: muted, marginTop: 20, fontSize: 13 },
  // baris riwayat: menyamping, rata tengah vertikal, jarak elemen 10, latar cardBg, sudut 14, padding 12, jarak bawah 8, garis tepi krem
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cardBg, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5DFD1' },
  // lingkaran ikon: ukuran 34x34, sudut 10, isi di tengah
  dot: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // warna latar lingkaran saat masuk: amber
  dotIn: { backgroundColor: amber },
  // warna latar lingkaran saat keluar: merah muda pucat
  dotOut: { backgroundColor: '#FFEBEB' },
  // nama produk di riwayat: ukuran 13, font tebal, warna ink
  rowName: { fontSize: 13, fontFamily: 'Inter_700Bold',  color: ink },
  // keterangan di riwayat: ukuran 11, warna abu, jarak atas 2
  rowSub: { fontSize: 11, color: muted, marginTop: 2 },
  // tanggal di riwayat: ukuran 10, warna abu, jarak atas 1
  rowDate: { fontSize: 10, color: muted, marginTop: 1 },
  // jumlah: ukuran 15, font tebal
  qty: { fontSize: 15, fontFamily: 'Inter_800ExtraBold'},
  // warna jumlah saat masuk: bronze
  qtyIn: { color: bronze },
  // warna jumlah saat keluar: merah
  qtyOut: { color: '#BA1A1A' },

  // ----- BARU: style untuk jendela pemilih barang -----
  // latar gelap transparan di belakang sheet, isi didorong ke bawah
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // kotak sheet: tinggi 80% layar, sudut atas membulat 24, latar surface, padding 16
  sheet: { height: '80%', backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  // baris judul sheet: teks kiri dan tombol tutup kanan, rata tengah, jarak bawah 12
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  // judul sheet: ukuran 16, font Poppins tebal, warna ink
  sheetTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },
  // kotak pencarian: menyamping, rata tengah, jarak elemen 8, latar putih, garis tepi abu, sudut 12, padding horizontal 12, jarak bawah 10
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 },
  // kolom ketik pencarian: mengisi ruang, padding vertikal 10, ukuran 13, warna ink
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: ink },
  // barisan chip: tidak melebar ke bawah (flexGrow 0), jarak bawah 8
  chipRow: { flexGrow: 0, marginBottom: 8 },
  // chip dasar: latar putih, garis tepi abu, bentuk pil (radius 999), padding 14x7
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  // chip aktif: latar dan garis tepi navy
  chipActive: { backgroundColor: navy, borderColor: navy },
  // teks chip: ukuran 12, font tebal, warna abu
  chipText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: muted },
  // teks chip aktif: warna putih
  chipTextActive: { color: '#fff' },
  // keterangan jumlah hasil: ukuran 11, warna abu, jarak bawah 6
  resultCount: { fontSize: 11, color: muted, marginBottom: 6 },
  // baris barang di daftar pemilih: menyamping, rata tengah, latar putih, sudut 12, padding 12, jarak bawah 8, garis tepi krem
  pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5DFD1' },
  // baris barang yang sedang dipilih: garis tepi navy
  pickRowActive: { borderColor: navy },

  // ----- BARU: summary cards -----
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cardBg, borderRadius: 12, padding: 12, borderWidth: 1 },
  summaryIn: { borderColor: amber },
  summaryOut: { borderColor: '#FFEBEB' },
  summaryLabel: { fontSize: 10, color: muted, fontFamily: 'Inter_600SemiBold' },
  summaryValue: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: ink },

  // ----- BARU: filter box -----
  filterBox: { backgroundColor: cardBg, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E5DFD1' },
  filterTitle: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: ink, marginBottom: 8 },
  filterChips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4' },
  filterChipActive: { backgroundColor: navy, borderColor: navy },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: muted },
  filterChipTextActive: { color: '#fff' },

  // ----- BARU: modal detail -----
  detailModal: { backgroundColor: surface, borderRadius: 16, marginHorizontal: 20, padding: 16, maxWidth: 400, alignSelf: 'center' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },
  detailBody: { gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: 12, color: muted, fontFamily: 'Inter_600SemiBold', flex: 1 },
  detailValue: { fontSize: 13, color: ink, fontFamily: 'Inter_700Bold', flex: 2, textAlign: 'right' },
});
