// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React beserta hook:
// useEffect (menjalankan kode saat kondisi berubah), useState (menyimpan data yang bisa berubah),
// useCallback (membuat fungsi yang diingat agar tidak dibuat ulang terus)
import React, { useEffect, useState, useCallback, useMemo } from 'react';
// mengambil komponen bawaan React Native:
// View (kotak/div), Text (teks), ScrollView (area yang bisa digulir), TouchableOpacity (tombol sentuh),
// StyleSheet (pembuat style), Alert (dialog pop-up), TextInput (kolom input teks), ActivityIndicator (animasi loading), Image (gambar)
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, Image } from 'react-native';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil komponen QtySheet (bottom sheet input jumlah) yang dipakai bersama layar lain
import QtySheet from '../components/QtySheet';
// mengambil fungsi rp (untuk mengubah angka menjadi format Rupiah, contoh: Rp 85.000)
import { rp } from '../lib/format';
// mengambil hook useCart (untuk mengakses data keranjang belanja global)
import { useCart } from '../store/cart';
// mengambil hook useGuest (untuk mengetahui status tamu/belum login dan fungsi keluar)
import { useGuest } from '../store/guest';
// mengambil store favorit (status + toggle favorit per user)
import { useFavorites } from '../store/favorites';
// mengambil fungsi dari repo:
// getProductReviews (mengambil daftar ulasan produk), hasPurchasedProduct (cek apakah sudah pernah membeli),
// addReview (menyimpan ulasan baru)
import { getProductReviews, hasPurchasedProduct, addReview } from '../repo';
// mengambil hook palet warna dinamis (Terang/Gelap) dan tipe paletnya
import { useColors } from '../store/preferences';
import type { Palette } from '../theme';

// ===== KONSTANTA =====

// GOLD = warna emas khusus untuk bintang rating
const GOLD = '#F5B700';

// ===== KOMPONEN PEMBANTU =====

// komponen kecil "Stars" untuk menampilkan deretan bintang; menerima:
// value (nilai rating), size (ukuran ikon, default 14), color (warna bintang, default GOLD)
function Stars({ value, size = 14, color = GOLD }: { value: number; size?: number; color?: string }) {
  // kembalikan baris (row) berisi 5 bintang
  return (
    // View pembungkus, menyamping (row), jarak antar bintang 2
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {/* ulangi angka 1..5; tiap angka jadi satu bintang */}
      {[1, 2, 3, 4, 5].map((i) => (
        // jika i <= pembulatan value, tampilkan bintang penuh ('star'); jika tidak, bintang kosong ('star-outline')
        <Ionicons key={i} name={i <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={color} />
      ))}
    </View>
  );
}

// ===== KOMPONEN UTAMA =====

// komponen layar Detail produk; menerima navigation (pindah layar) dan route (data yang dikirim dari layar sebelumnya)
export default function DetailScreen({ navigation, route }: any) {
  // mengambil data "product" dari route.params (produk yang dipilih dari layar sebelumnya)
  const { product } = route.params as { product: any };
  // mengambil objek keranjang belanja dari hook useCart
  const cart = useCart();
  // mengambil status tamu (isGuest) dan fungsi keluar (exit) dari hook useGuest
  const { isGuest, exit } = useGuest();
  // store favorit: status produk ini + fungsi toggle
  const fav = useFavorites();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // state "reviews" menyimpan daftar ulasan produk; awalnya array kosong
  const [reviews, setReviews] = useState<any[]>([]);
  // state "canReview" menandai apakah pengguna boleh memberi ulasan (hanya yang pernah membeli); awalnya false
  const [canReview, setCanReview] = useState(false);
  // state "loadingReviews" penanda ulasan sedang dimuat; awalnya true
  const [loadingReviews, setLoadingReviews] = useState(true);
  // state "showForm" penanda apakah form tulis ulasan sedang terbuka; awalnya false
  const [showForm, setShowForm] = useState(false);
  // state "rating" menyimpan nilai bintang yang dipilih pengguna di form; awalnya 5
  const [rating, setRating] = useState(5);
  // state "comment" menyimpan teks ulasan yang diketik pengguna; awalnya kosong
  const [comment, setComment] = useState('');
  // state "sending" penanda ulasan sedang dikirim (mencegah klik ganda); awalnya false
  const [sending, setSending] = useState(false);
  // state "showQty" penanda apakah panel input jumlah (bottom sheet) sedang terbuka; awalnya false
  const [showQty, setShowQty] = useState(false);

  // fungsi loadReviews = mengambil daftar ulasan dan mengecek izin memberi ulasan;
  // useCallback membungkusnya agar fungsi ini stabil (hanya dibuat ulang bila product.id atau isGuest berubah)
  const loadReviews = useCallback(async () => {
    // nyalakan indikator loading ulasan
    setLoadingReviews(true);
    // ambil ulasan produk lalu tunggu (await) sampai selesai
    const r = await getProductReviews(product.id);
    // simpan daftar ulasan ke state reviews
    setReviews(r);
    // kalau bukan tamu (sudah login), cek apakah pengguna pernah membeli produk ini
    if (!isGuest) {
      // tanyakan ke server, hasilnya menentukan boleh/tidaknya memberi ulasan
      const can = await hasPurchasedProduct(product.id);
      // simpan hasilnya ke state canReview
      setCanReview(can);
    }
    // matikan indikator loading ulasan
    setLoadingReviews(false);
  }, [product.id, isGuest]);

  // useEffect: setiap kali loadReviews berubah (dependensi), jalankan loadReviews
  useEffect(() => {
    // panggil fungsi pemuat ulasan; dibungkus async IIFE agar setState tidak sinkron di dalam efek
    void (async () => {
      await loadReviews();
    })();
  }, [loadReviews]);

  // "avg" = rata-rata nilai rating; jika belum ada ulasan bernilai 0
  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  // fungsi openQty = membuka panel input jumlah (bottom sheet) saat tombol Masuk Keranjang ditekan
  const openQty = () => {
    // kalau pengguna tamu (belum login), tampilkan peringatan dan hentikan
    if (isGuest) {
      // pop-up minta login
      Alert.alert('Login Dulu', 'Kamu perlu login untuk menambah barang ke keranjang.', [
        // tombol "Nanti" untuk membatalkan
        { text: 'Nanti', style: 'cancel' },
        // tombol "Login": kosongkan keranjang lalu keluar agar diarahkan login
        { text: 'Login', onPress: () => { cart.clear(); exit(); } },
      ]);
      // hentikan fungsi di sini (panel tidak dibuka)
      return;
    }
    // buka panel input jumlah
    setShowQty(true);
  };

  // fungsi confirmQty = menerima jumlah dari panel lalu memasukkan produk ke keranjang
  const confirmQty = (qty: number) => {
    // tambahkan produk ke keranjang sebanyak jumlah yang dipilih
    cart.add(product, qty);
    // tutup panel input
    setShowQty(false);
    // kembali ke layar sebelumnya
    navigation.goBack();
  };

  // fungsi favToggle = menandai/melepas favorit produk; tamu diminta login dulu
  const favToggle = () => {
    // kalau tamu, tampilkan dialog minta login lalu hentikan
    if (isGuest) {
      Alert.alert('Login Dulu', 'Kamu perlu login untuk menyimpan favorit.', [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Login', onPress: () => { cart.clear(); exit(); } },
      ]);
      return;
    }
    // tandai/lepas favorit di server (optimistis)
    fav.toggle(product.id);
  };

  // fungsi submitReview = mengirim ulasan yang ditulis; "async" artinya bisa menunggu proses
  const submitReview = async () => {
    // kalau sedang mengirim, jangan lakukan apa-apa (cegah klik ganda)
    if (sending) return;
    // tandai sedang mengirim
    setSending(true);
    // kirim ulasan (id produk, rating, komentar yang dipangkas spasi atau null bila kosong), tunggu hasilnya
    const ok = await addReview(product.id, rating, comment.trim() || null);
    // selesai mengirim
    setSending(false);
    // kalau berhasil dikirim
    if (ok) {
      // tutup form
      setShowForm(false);
      // kosongkan komentar
      setComment('');
      // kembalikan rating ke 5
      setRating(5);
      // muat ulang daftar ulasan agar ulasan baru muncul
      loadReviews();
    } else {
      // kalau gagal, tampilkan pesan
      Alert.alert('Gagal', 'Ulasan tidak bisa disimpan. Pastikan kamu sudah pernah membeli produk ini.');
    }
  };



  // return = isi tampilan yang akan digambar di layar
  return (
    // Fragment (<>...</>) agar bisa menaruh ScrollView dan Modal berdampingan
    <>
      {/* ScrollView = area yang bisa digulir; latar halaman, isi diberi padding lewat style container */}
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      {/* kotak gambar/ikon produk (thumbnail) berukuran besar */}
      <View style={styles.thumb}>
        {/* tampilkan gambar produk jika ada, fallback ke ikon kubus */}
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.thumbImage} />
        ) : (
          <Ionicons name="cube" size={48} color={c.textFaint} />
        )}
        {/* tombol hati favorit di pojok kanan atas */}
        <TouchableOpacity style={styles.favBtn} onPress={favToggle}>
          <Ionicons
            name={fav.isFav(product.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={fav.isFav(product.id) ? c.danger : c.textMuted}
          />
        </TouchableOpacity>
      </View>
      {/* baris label kategori + tag kode produk */}
      <View style={styles.badgeWrap}>
        {/* teks kategori produk */}
        <Text style={styles.category}>{product.category}</Text>
        {/* tag kecil berisi kode produk */}
        <View style={styles.codeTag}><Text style={styles.codeTagText}>{product.code}</Text></View>
      </View>
      {/* nama produk */}
      <Text style={styles.name}>{product.name}</Text>
      {/* harga produk dalam format Rupiah */}
      <Text style={styles.price}>{rp(product.price)}</Text>
      {/* baris info stok dan kode */}
      <View style={styles.meta}>
        {/* info stok: label "Stok" tebal lalu jumlah unit */}
        <Text style={styles.metaItem}><Text style={styles.metaLabel}>Stok</Text>{' '}{product.stock} unit</Text>
        {/* info kode: label "Kode" tebal lalu kode produk */}
        <Text style={styles.metaItem}><Text style={styles.metaLabel}>Kode</Text>{' '}{product.code}</Text>
      </View>

      {/* Rating summary (ringkasan rating) */}
      <View style={styles.ratingCard}>
        {/* sisi kiri: angka rata-rata, bintang, dan jumlah ulasan */}
        <View style={{ flex: 1 }}>
          {/* angka rata-rata; tampilkan "—" (strip) bila belum ada ulasan; toFixed(1) = 1 angka di belakang koma */}
          <Text style={styles.ratingBig}>{avg > 0 ? avg.toFixed(1) : '—'}</Text>
          {/* komponen bintang sesuai nilai rata-rata, ukuran 13 */}
          <Stars value={avg} size={13} />
          {/* teks jumlah ulasan */}
          <Text style={styles.ratingCount}>{reviews.length} ulasan</Text>
        </View>
        {/* tombol "Beri Ulasan" hanya muncul bila: bukan tamu, boleh mengulas, dan form belum terbuka; selain itu null (tidak tampil) */}
        {!isGuest && canReview && !showForm ? (
          // tombol untuk membuka form tulis ulasan
          <TouchableOpacity style={styles.writeBtn} onPress={() => setShowForm(true)}>
            {/* ikon pensil */}
            <Ionicons name="create-outline" size={14} color="#261A00" />
            {/* teks tombol */}
            <Text style={styles.writeBtnText}>Beri Ulasan</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Formulasional (form tulis ulasan) */}
      {/* form hanya tampil bila showForm aktif, boleh mengulas, dan bukan tamu; selain itu null */}
      {showForm && canReview && !isGuest ? (
        // kartu form
        <View style={styles.formCard}>
          {/* judul form */}
          <Text style={styles.formTitle}>Tulis Ulasan</Text>
          {/* baris 5 bintang yang bisa ditekan untuk memilih rating */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {/* ulangi 1..5 sebagai bintang pilihan */}
            {[1, 2, 3, 4, 5].map((i) => (
              // tombol bintang; ditekan untuk mengubah rating ke i
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                {/* bintang terisi bila i <= rating, jika tidak kosong; warna GOLD */}
                <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={26} color={GOLD} />
              </TouchableOpacity>
            ))}
          </View>
          {/* kolom input teks komentar ulasan */}
          <TextInput
            // style kolom komentar
            style={styles.commentInput}
            // teks petunjuk saat kosong
            placeholder="Ceritakan pengalamanmu dengan produk ini..."
            // warna teks petunjuk
            placeholderTextColor={c.textMuted}
            // nilai diambil dari state comment
            value={comment}
            // saat berubah, simpan ke state comment
            onChangeText={setComment}
            // multiline = boleh beberapa baris
            multiline
            // tinggi kira-kira 3 baris
            numberOfLines={3}
          />
          {/* baris tombol Batal dan Kirim */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {/* tombol Batal: menutup form */}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              {/* teks Batal */}
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
            {/* tombol Kirim Ulasan; saat mengirim, opacity 0.6; ditekan memanggil submitReview; disabled saat sending */}
            <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={submitReview} disabled={sending}>
              {/* kalau sedang mengirim tampilkan spinner, jika tidak tampilkan teks "Kirim Ulasan" */}
              {sending ? <ActivityIndicator color="#261A00" size="small" /> : <Text style={styles.sendText}>Kirim Ulasan</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Daftar ulasan */}
      <Text style={styles.sectionTitle}>Ulasan Pembeli</Text>
      {/* jika ulasan sedang dimuat, tampilkan spinner; jika kosong, tampilkan teks; jika ada, tampilkan daftar */}
      {loadingReviews ? (
        // animasi loading ulasan
        <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
      ) : reviews.length === 0 ? (
        // teks bila belum ada ulasan
        <Text style={styles.emptyReviews}>Belum ada ulasan.</Text>
      ) : (
        // ulangi setiap ulasan menjadi satu kartu ulasan
        reviews.map((r) => (
          // kartu satu ulasan; key unik memakai id ulasan
          <View key={r.id} style={styles.reviewItem}>
            {/* baris identitas: ikon orang + nama + tanggal */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {/* ikon profil pembeli */}
              <Ionicons name="person-circle" size={18} color={c.textMuted} />
              {/* nama penulis ulasan (disamarkan sebagai "Pembeli") */}
              <Text style={styles.reviewerName}>Pembeli</Text>
              {/* tanggal ulasan; diubah dari created_at menjadi format tanggal lokal Indonesia */}
              <Text style={styles.reviewDate}>• {new Date(r.created_at).toLocaleDateString('id')}</Text>
            </View>
            {/* baris bintang nilai ulasan */}
            <View style={{ flexDirection: 'row', gap: 2, marginBottom: 4 }}>
              {/* ulangi 1..5 sebagai bintang; terisi bila i <= rating ulasan */}
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name={i <= r.rating ? 'star' : 'star-outline'} size={11} color={GOLD} />
              ))}
            </View>
            {/* teks komentar ulasan; hanya tampil bila ada komentar */}
            {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
          </View>
        ))
      )}

      {/* catatan penting tentang garansi */}
      <Text style={styles.note}>
        Garansi orisinalitas & pemasangan 30 hari di bengkel Santren Jaya Motor. Simpan struk sebagai bukti klaim.
      </Text>
      {/* baris tombol aksi di bawah: Kembali + Masuk Keranjang */}
      <View style={styles.actions}>
        {/* tombol Kembali: kembali ke layar sebelumnya */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          {/* ikon panah kiri */}
          <Ionicons name="arrow-back" size={18} color={c.primary} />
          {/* teks Kembali */}
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
        {/* tombol Masuk Keranjang: membuka panel input jumlah (openQty) */}
        <TouchableOpacity
          // style tombol tambah
          style={styles.addBtn}
          // saat ditekan, buka panel input jumlah
          onPress={openQty}
        >
          {/* ikon plus */}
          <Ionicons name="add" size={18} color="#fff" />
          {/* teks tombol */}
          <Text style={styles.addBtnText}>Masuk Keranjang</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* ===== BOTTOM SHEET INPUT JUMLAH ===== */}
      {/* tampilkan QtySheet hanya saat showQty true; komponen ini menyimpan state jumlah sendiri */}
      {showQty ? (
        // panel input jumlah; onClose menutup panel, onConfirm menambahkan produk lalu kembali
        <QtySheet
          product={product}
          onClose={() => setShowQty(false)}
          onConfirm={confirmQty}
        />
      ) : null}
    </>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// StyleSheet.create membuat kumpulan style yang bisa dipanggil dengan nama, contoh styles.container
// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // isi layar: padding 16 semua sisi, jarak bawah 32
  container: { padding: 16, paddingBottom: 32 },
  // kotak gambar produk: tinggi 180, latar chip, sudut 14, isi di tengah
  thumb: { height: 180, backgroundColor: c.chip, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // gambar produk di detail: isi penuh kotak thumb
  thumbImage: { width: '100%', height: '100%', borderRadius: 14, resizeMode: 'cover' },
  // tombol hati favorit: di kanan atas thumb, bulat 38x38, latar kartu, garis tepi
  favBtn: {
    position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  // baris label kategori + kode: menyamping, rata tengah, jarak antar isi 8, jarak atas 14
  badgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  // teks kategori: ukuran 11, tebal, warna kuning gelap, spasi huruf 0.5
  category: { fontSize: 11, fontFamily: 'Inter_800ExtraBold',  color: c.warn, letterSpacing: 0.5 },
  // tag kode: latar abu muda, sudut 6, padding horizontal 8 vertikal 2
  codeTag: { backgroundColor: c.input, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  // teks kode di dalam tag: ukuran 10, warna abu, angka rata (tabular-nums)
  codeTagText: { fontSize: 10, color: c.textMuted, fontVariant: ['tabular-nums'] },
  // nama produk: ukuran 22, tebal, warna teks utama, jarak atas 8, tinggi baris 28
  name: { fontSize: 22, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginTop: 8, lineHeight: 28 },
  // harga produk: ukuran 26, tebal, warna biru utama, jarak atas 6
  price: { fontSize: 26, fontFamily: 'Inter_800ExtraBold',  color: c.primary, marginTop: 6 },
  // baris info stok/kode: menyamping, jarak antar info 16, jarak atas 10
  meta: { flexDirection: 'row', gap: 16, marginTop: 10 },
  // satu info: menyamping, rata tengah, jarak antar isi 4
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // label info: tebal, warna teks utama, ukuran 12
  metaLabel: { fontFamily: 'Inter_700Bold',  color: c.text, fontSize: 12 },
  // kartu ringkasan rating: menyamping, rata tengah, latar kartu, sudut 14, padding 14, jarak atas 16, garis tepi krem
  ratingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14,
    padding: 14, marginTop: 16, borderWidth: 1, borderColor: c.border,
  },
  // angka rata-rata rating: ukuran 28, tebal, warna teks utama, jarak bawah 4
  ratingBig: { fontSize: 28, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginBottom: 4 },
  // jumlah ulasan: ukuran 11, warna abu, jarak atas 4
  ratingCount: { fontSize: 11, color: c.textMuted, marginTop: 4 },
  // tombol "Beri Ulasan": menyamping, rata tengah, jarak antar isi 5, latar kuning aksen, sudut 10, padding
  writeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.accent,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  // teks tombol tulis ulasan: ukuran 12, tebal, warna cokelat gelap
  writeBtnText: { fontSize: 12, fontFamily: 'Inter_800ExtraBold',  color: '#261A00' },
  // kartu form ulasan: latar kartu, sudut 14, padding 14, jarak atas 10, garis tepi krem
  formCard: {
    backgroundColor: c.card, borderRadius: 14, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: c.border,
  },
  // judul form: ukuran 13, tebal, warna teks utama, jarak bawah 8
  formTitle: { fontSize: 13, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginBottom: 8 },
  // kolom komentar: latar abu muda, sudut 10, padding 10, ukuran 13, warna teks utama, teks rata atas (textAlignVertical top)
  commentInput: {
    backgroundColor: c.input, borderRadius: 10, padding: 10,
    fontSize: 13, color: c.text, textAlignVertical: 'top',
  },
  // tombol Batal: mengisi ruang 1, garis tepi, sudut 10, padding vertikal 11, isi di tengah
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  // teks Batal: ukuran 12, tebal, warna biru utama
  cancelText: { fontSize: 12, fontFamily: 'Inter_700Bold',  color: c.primary },
  // tombol Kirim: porsi 2 (lebih lebar), latar kuning aksen, sudut 10, padding vertikal 11, isi di tengah
  sendBtn: {
    flex: 2, backgroundColor: c.accent, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
  },
  // teks Kirim: ukuran 13, tebal, warna cokelat gelap
  sendText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold',  color: '#261A00' },
  // judul bagian (misal "Ulasan Pembeli"): ukuran 15, tebal, warna teks utama, jarak atas 18 bawah 8
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginTop: 18, marginBottom: 8 },
  // teks "Belum ada ulasan": ukuran 12, warna abu, rata tengah, padding vertikal 16
  emptyReviews: { fontSize: 12, color: c.textMuted, textAlign: 'center', paddingVertical: 16 },
  // kartu satu ulasan: latar kartu, sudut 12, padding 12, jarak bawah 8, garis tepi krem
  reviewItem: {
    backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: c.border,
  },
  // nama penulis ulasan: ukuran 12, tebal, warna teks utama
  reviewerName: { fontSize: 12, fontFamily: 'Inter_700Bold',  color: c.text },
  // tanggal ulasan: ukuran 10, warna abu
  reviewDate: { fontSize: 10, color: c.textMuted },
  // teks komentar ulasan: ukuran 12, warna abu, tinggi baris 17
  reviewComment: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
  // catatan garansi: ukuran 12, warna abu, jarak atas 14, tinggi baris 18
  note: { fontSize: 12, color: c.textMuted, marginTop: 14, lineHeight: 18 },
  // baris tombol aksi: menyamping, jarak atas 20, jarak antar tombol 10
  actions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  // tombol Kembali: porsi 1, garis tepi, sudut 12, padding vertikal 14, isi di tengah menyamping, jarak antar isi 6
  backBtn: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  // teks tombol Kembali: tebal, warna biru utama
  backBtnText: { fontFamily: 'Inter_700Bold',  color: c.primary },
  // tombol Masuk Keranjang: porsi 1, latar biru utama, sudut 12, padding vertikal 14, isi di tengah menyamping, jarak antar isi 6
  addBtn: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  // teks tombol Masuk Keranjang: putih, tebal
  addBtnText: { color: '#fff', fontFamily: 'Inter_700Bold'},
});
