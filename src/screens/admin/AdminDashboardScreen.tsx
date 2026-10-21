// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useState (untuk menyimpan data yang bisa berubah di layar)
import React, { useState } from 'react';
// mengambil komponen bawaan React Native: View (kotak/div), Text (teks), ScrollView (area yang bisa digulir),
// StyleSheet (pembuat style), ActivityIndicator (animasi loading), RefreshControl (tarik layar untuk refresh)
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil fungsi adminStats (untuk mengambil data statistik admin dari server/database)
import { adminStats, type LowStockItem } from '../../lib/admin';
// mengambil hook useLowStock (menyediakan jumlah stok minimum & fungsi refresh badge)
import { useLowStock } from '../../context/LowStockContext';
// mengambil fungsi rp (untuk mengubah angka menjadi format Rupiah, contoh: Rp 85.000)
import { rp } from '../../lib/format';
// mengambil variabel warna dari file theme (supaya warna konsisten di seluruh aplikasi)
import { navy, surface, ink, muted, amber, bronze, chipBg, cardBg } from '../../theme';

// ===== KOMPONEN KECIL =====

// komponen kecil "Card" (kartu ringkasan); menerima title, value, icon, dan color (default navy)
// bagian ": { title: string; ... }" adalah tipe data TypeScript untuk menjelaskan jenis tiap parameter
// DITARUH DI LUAR fungsi layar utama: kalau dibuat di dalam render, state-nya selalu me-reset tiap render
function Card({ title, value, icon, color = navy }: { title: string; value: string; icon: any; color?: string }) {
  return (
    // kotak pembungkus kartu, memakai style "card" dari StyleSheet di bawah
    <View style={styles.card}>
      {/* kotak ikon; style dibuat dua lapis: style dasar cardIcon + warna latar sesuai color */}
      {/* color + '15' artinya warna yang sama tapi transparan (kode 15 = opasitas kecil) */}
      <View style={[styles.cardIcon, { backgroundColor: color + '15' }]}>
        {/* menampilkan ikon sesuai nama (name), ukuran 20, dan warna color */}
        <Ionicons name={icon} size={20} color={color} />
      </View>
      {/* menampilkan judul kartu, contoh: "Total Barang" */}
      <Text style={styles.cardTitle}>{title}</Text>
      {/* menampilkan nilai kartu, contoh: "120 SKU" */}
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

// ===== KOMPONEN UTAMA =====

// membuat komponen layar Dashboard Admin; "export default" artinya komponen ini bisa diimpor di file lain
export default function AdminDashboardScreen() {
  // membuat state "stats" untuk menyimpan data statistik; "setStats" adalah fungsi untuk mengubahnya
  // nilai awalnya 0 semua sebelum data dari server datang
  const [stats, setStats] = useState({ totalBarang: 0, totalStok: 0, totalPenjualan: 0, totalOmset: 0, lowStock: [] as LowStockItem[] });
  // hook untuk menyegarkan angka stok minimum (dipakai badge tab Inventaris)
  const { refresh: refreshLowStock } = useLowStock();
  // state penanda apakah layar sedang di-refresh (tarik ke bawah); awalnya false (tidak sedang refresh)
  const [refreshing, setRefreshing] = useState(false);
  // state penanda apakah data pertama kali sedang dimuat; awalnya true (sedang memuat)
  const [loading, setLoading] = useState(true);

  // membuat fungsi "load" untuk mengambil data; "async" artinya fungsi ini boleh menunggu proses (await)
  // useCallback menjaga "load" tetap sama antar render (refreshLowStock juga stabil)
  const load = React.useCallback(async () => {
    // memanggil adminStats lalu menunggu (await) sampai datanya selesai diambil, hasilnya disimpan di variabel s
    const s = await adminStats();
    // menyimpan hasil statistik ke state stats, sehingga tampilan otomatis diperbarui
    setStats(s);
    // mengubah loading menjadi false karena data sudah selesai dimuat
    setLoading(false);
    // menyegarkan jumlah stok minimum agar badge tab Inventaris ikut ter-update
    void refreshLowStock();
  }, [refreshLowStock]);

  // useEffect menjalankan kode saat layar pertama kali muncul
  // dibungkus async IIFE agar setState tidak terjadi sinkron di dalam efek
  React.useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // handler tarik-ke-bawah untuk memuat ulang data
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // jika masih loading, tampilkan animasi loading saja dan hentikan fungsi di sini (return)
  // size="large" = ukuran besar, color = warna navy, style = posisi di tengah layar
  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: 'center' }} />;

  // return = isi tampilan yang akan digambar di layar
  return (
    // ScrollView = area yang bisa digulir ke bawah
    <ScrollView
      // style = tampilan pembungkus luar, latar warna surface
      style={{ backgroundColor: surface }}
      // contentContainerStyle = style untuk isi di dalam scroll, di sini memberi jarak 16 di semua sisi
      contentContainerStyle={{ padding: 16 }}
      // refreshControl = fitur tarik layar ke bawah untuk memuat ulang data; onRefresh memanggil fungsi load
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={navy} />}
    >
      {/* judul halaman */}
      <Text style={styles.header}>Dashboard Admin</Text>
      {/* teks keterangan kecil di bawah judul */}
      <Text style={styles.subheader}>Ringkasan operasional Santren Jaya Motor</Text>

      {/* grid = wadah 4 kartu, disusun berdampingan dan turun ke baris berikutnya jika penuh */}
      <View style={styles.grid}>
        {/* kartu Total Barang; ${stats.totalBarang} menyisipkan angka dari state ke dalam teks */}
        <Card title="Total Barang" value={`${stats.totalBarang} SKU`} icon="cube" color={navy} />
        {/* kartu Total Stok */}
        <Card title="Total Stok" value={`${stats.totalStok} unit`} icon="layers" color={bronze} />
        {/* kartu Total Penjualan; rp() mengubah angka menjadi format Rupiah */}
        <Card title="Total Penjualan" value={rp(stats.totalPenjualan)} icon="cart" color={amber} />
        {/* kartu Total Omset */}
        <Card title="Total Omset" value={rp(stats.totalOmset)} icon="cash" color={navy} />
        {/* kartu Stok Minimum; menampilkan jumlah barang yang stoknya menipis */}
        <Card title="Stok Minimum" value={`${stats.lowStock.length} barang`} icon="alert-circle" color="#BA1A1A" />
      </View>

      {/* kotak Informasi Sistem di bawah kartu */}
      <View style={styles.systemBox}>
        {/* baris judul: ikon + teks, disusun menyamping (row), rata tengah, jarak antar elemen 6, jarak bawah 8 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          {/* ikon tanda informasi */}
          <Ionicons name="information-circle" size={18} color={navy} />
          {/* judul kotak */}
          <Text style={styles.systemTitle}>Informasi Sistem</Text>
        </View>
        {/* baris info: label di kiri, nilai di kanan */}
        <View style={styles.systemRow}>
          <Text style={styles.systemLabel}>Nama Toko</Text>
          <Text style={styles.systemValue}>Santren Jaya Motor</Text>
        </View>
        {/* baris versi aplikasi */}
        <View style={styles.systemRow}>
          <Text style={styles.systemLabel}>Versi</Text>
          <Text style={styles.systemValue}>1.0.0</Text>
        </View>
        {/* baris jenis database yang dipakai */}
        <View style={styles.systemRow}>
          <Text style={styles.systemLabel}>Tipe Database</Text>
          <Text style={styles.systemValue}>Supabase PostgreSQL</Text>
        </View>
        {/* baris metode pembayaran yang dipakai */}
        <View style={styles.systemRow}>
          <Text style={styles.systemLabel}>Metode Bayar</Text>
          <Text style={styles.systemValue}>Midtrans Snap</Text>
        </View>
        {/* baris status sistem */}
        <View style={styles.systemRow}>
          <Text style={styles.systemLabel}>Status</Text>
          {/* badge = label kecil berlatar warna */}
          <View style={styles.badge}>
            {/* ikon centang di dalam badge */}
            <Ionicons name="checkmark-circle" size={12} color={bronze} />
            {/* teks status "Online" */}
            <Text style={styles.badgeText}>Online</Text>
          </View>
        </View>
      </View>

      {/* kotak daftar barang yang perlu restock (stok minim) */}
      <View style={styles.lowBox}>
        {/* baris judul: ikon + teks + jumlah di kanan */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Ionicons name="alert-circle" size={18} color="#BA1A1A" />
          <Text style={styles.lowTitle}>Perlu Restock</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.lowCount}>{stats.lowStock.length}</Text>
        </View>
        {/* jika tidak ada barang stok minim */}
        {stats.lowStock.length === 0 ? (
          <Text style={styles.lowEmpty}>Semua stok aman.</Text>
        ) : (
          // tampilkan maksimal 8 barang agar ringkas
          stats.lowStock.slice(0, 8).map((p) => (
            <View key={p.id} style={styles.lowRow}>
              <Text style={styles.lowCode}>{p.code}</Text>
              <Text style={styles.lowName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.lowStock}>Sisa {p.stock}</Text>
            </View>
          ))
        )}
        {/* keterangan jika barang stok minim lebih dari 8 */}
        {stats.lowStock.length > 8 ? (
          <Text style={styles.lowMore}>+ {stats.lowStock.length - 8} barang lain</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// StyleSheet.create membuat kumpulan style yang bisa dipanggil dengan nama, contoh styles.header
const styles = StyleSheet.create({
  // judul halaman: ukuran 22, font Poppins tebal, warna ink, jarak bawah 4
  header: { fontSize: 22, fontFamily: 'Poppins_800ExtraBold',  color: ink, marginBottom: 4 },
  // keterangan di bawah judul: ukuran 13, warna abu (muted), jarak bawah 18
  subheader: { fontSize: 13, color: muted, marginBottom: 18 },
  // wadah kartu: disusun menyamping (row), boleh turun baris (wrap), jarak antar kartu 12, jarak bawah 20
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: {
    // lebar kartu 47.5% dari layar, sehingga muat 2 kartu per baris
    width: '47.5%', 
    // warna latar kartu
    backgroundColor: chipBg, 
    // sudut membulat 14
    borderRadius: 14, 
    // jarak isi dengan tepi kartu 16
    padding: 16, 
    // garis tepi tebal 1 dengan warna krem
    borderWidth: 1, borderColor: '#E5DFD1',
  },
  // kotak ikon: ukuran 36x36, sudut membulat 10, ikon diletakkan di tengah (rata tengah horizontal dan vertikal), jarak bawah 10
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  // judul kartu: kecil (11), warna abu, jarak bawah 4
  cardTitle: { fontSize: 11, color: muted, marginBottom: 4 },
  // nilai kartu: ukuran 16, font tebal, warna ink
  cardValue: { fontSize: 16, fontFamily: 'Inter_800ExtraBold',  color: ink },
  // kotak informasi sistem: latar cardBg, sudut membulat 14, jarak dalam 16, garis tepi krem
  systemBox: { backgroundColor: cardBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5DFD1' },
  // judul kotak informasi sistem: ukuran 14, font Poppins tebal, warna ink
  systemTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold',  color: ink },
  // satu baris info: label kiri dan nilai kanan (space-between), rata tengah vertikal, jarak atas-bawah 8, garis pemisah tipis di bawah
  systemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EBE0' },
  // label info: ukuran 12, warna abu
  systemLabel: { fontSize: 12, color: muted },
  // nilai info: ukuran 12, font tebal, warna ink
  systemValue: { fontSize: 12, fontFamily: 'Inter_700Bold',  color: ink },
  // badge status: ikon dan teks menyamping, rata tengah, jarak antar elemen 4, latar abu muda, sudut membulat 7
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1EDF0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  // teks badge: ukuran 11, font tebal, warna bronze
  badgeText: { fontSize: 11, fontFamily: 'Inter_800ExtraBold',  color: bronze },
  // kotak daftar stok minim: latar cardBg, sudut 14, padding 16, garis tepi krem, jarak atas 16
  lowBox: { backgroundColor: cardBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5DFD1', marginTop: 16 },
  // judul "Perlu Restock": ukuran 14, font Poppins tebal, warna ink
  lowTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: ink },
  // angka jumlah stok minim di kanan judul: merah, font tebal
  lowCount: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: '#BA1A1A' },
  // teks saat semua stok aman: abu, ukuran 12
  lowEmpty: { fontSize: 12, color: muted, paddingVertical: 4 },
  // satu baris barang: menyamping, jarak 8, garis pemisah tipis di bawah
  lowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F0EBE0' },
  // kode barang: kecil, tebal, warna bronze, lebar tetap agar sejajar
  lowCode: { fontSize: 10, fontFamily: 'Inter_700Bold', color: bronze, width: 84, fontVariant: ['tabular-nums'] },
  // nama barang: mengisi ruang, ukuran 12
  lowName: { flex: 1, fontSize: 12, color: ink },
  // sisa stok: merah, font tebal
  lowStock: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: '#BA1A1A' },
  // keterangan tambahan barang lain: abu, rata tengah
  lowMore: { fontSize: 11, color: muted, textAlign: 'center', marginTop: 8 },
});