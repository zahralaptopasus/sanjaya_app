// ===== IMPORT (mengambil library yang dibutuhkan) =====

// React + hook: useCallback, useMemo, useState
import React, { useCallback, useMemo, useState } from 'react';
// komponen React Native: View, Text, FlatList (daftar grid), TouchableOpacity, StyleSheet, Image
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions, Image } from 'react-native';
// SafeAreaView: area aman dari status bar (header bawaan tab dimatikan, jadi pakai milik kita)
import { SafeAreaView } from 'react-native-safe-area-context';
// useFocusEffect: muat ulang daftar setiap layar difokuskan kembali
import { useFocusEffect } from '@react-navigation/native';
// ikon Ionicons
import { Ionicons } from '@expo/vector-icons';
// fungsi repo untuk mengambil produk favorit user
import { getFavoriteProducts } from '../repo';
// tipe data Product
import type { Product } from '../models';
// fungsi format Rupiah
import { rp } from '../lib/format';
// store keranjang (untuk menambah produk favorit ke keranjang)
import { useCart } from '../store/cart';
// store mode tamu (menampilkan ajakan login bila belum masuk)
import { useGuest } from '../store/guest';
// store favorit (hapus favorit & sinkronkan status hati)
import { useFavorites } from '../store/favorites';
// bottom sheet input jumlah saat menambah ke keranjang
import QtySheet from '../components/QtySheet';
// loader halaman (spinner di tengah)
import PageLoader from '../components/PageLoader';
// palet warna dinamis (Terang/Gelap) & font
import { useColors } from '../store/preferences';
import { F, type Palette } from '../theme';

// ===== LAYAR FAVORIT =====

// menampilkan daftar produk yang difavoritkan user; menerima navigation untuk pindah layar
export default function FavoritesScreen({ navigation }: any) {
  // daftar produk favorit
  const [items, setItems] = useState<Product[]>([]);
  // penanda sedang memuat
  const [loading, setLoading] = useState(true);
  // produk yang dipilih untuk diisi jumlahnya (null = panel tertutup)
  const [qtyProduct, setQtyProduct] = useState<Product | null>(null);
  // store keranjang, mode tamu, dan favorit
  const cart = useCart();
  const { isGuest } = useGuest();
  // ambil fungsi reload & toggle favorit (fungsi stabil dari provider)
  const { reload: reloadFav, toggle: toggleFav } = useFavorites();
  // palet warna aktif + gaya
  const c = useColors();
  // lebar layar saat ini; dipakai menghitung lebar tetap kartu grid 2 kolom
  const { width } = useWindowDimensions();
  // lebar kartu = (lebar layar - padding kiri/kanan list 16+16 - gap 14) / 2
  // dibuat tetap agar kartu tunggal tidak melebar penuh
  const cardW = (width - 16 * 2 - 14) / 2;
  const isMobile = width < 768;
  const styles = useMemo(() => makeStyles(c, cardW, isMobile), [c, cardW, isMobile]);

  // memuat daftar produk favorit dari server
  const load = useCallback(async () => {
    // tamu tidak punya favorit
    if (isGuest) { setItems([]); setLoading(false); return; }
    // ambil produk favorit lalu simpan
    const rows = await getFavoriteProducts();
    setItems(rows);
    setLoading(false);
  }, [isGuest]);

  // muat ulang setiap layar difokuskan (termasuk setelah kembali dari halaman lain)
  useFocusEffect(
    useCallback(() => {
      // tampilkan loader lalu muat daftar & sinkronkan status hati
      setLoading(true);
      load();
      reloadFav();
    }, [load, reloadFav]),
  );

  // membuka halaman detail produk (berada di dalam tab Belanja)
  const openDetail = (item: Product) =>
    navigation.navigate('MainTabs', {
      screen: 'ShopTab',
      params: { screen: 'Detail', params: { product: item } },
    });

  // menghapus produk dari favorit (langsung hilang dari daftar)
  const onUnfav = async (item: Product) => {
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    await toggleFav(item.id);
  };

  // tampilkan loader saat data sedang dimuat
  if (loading) return <PageLoader />;

  return (
    // wadah aman status bar + header biru (latar primary agar area status bar menyatu sampai atas)
    <SafeAreaView style={{ flex: 1, backgroundColor: c.primary }} edges={['top']}>
      {/* header biru halaman favorit */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorit</Text>
        <Text style={styles.headerSub}>{items.length} produk disimpan</Text>
        {/* garis aksen kuning tipis sebagai detail brand */}
        <View style={styles.accentLine} />
      </View>

      {/* daftar produk favorit, 2 kolom */}
      <FlatList
        // latar layar
        style={{ backgroundColor: c.bg, flex: 1 }}
        // jarak dalam daftar
        contentContainerStyle={styles.list}
        // data produk favorit
        data={items}
        // kunci unik memakai id produk
        keyExtractor={(item) => item.id}
        // jumlah kolom
        numColumns={2}
        // jarak antar kolom
        columnWrapperStyle={{ gap: 14 }}
        // tampilan bila belum ada produk favorit
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={46} color={c.textFaint} />
            <Text style={styles.emptyTitle}>Belum ada produk favorit</Text>
            <Text style={styles.emptyText}>
              {isGuest
                ? 'Masuk dulu untuk menyimpan produk favorit.'
                : 'Tekan ikon hati pada produk untuk menyimpannya di sini.'}
            </Text>
            {isGuest ? (
              // ajakan masuk/daftar untuk pengguna tamu
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={styles.emptyBtnText}>Masuk / Daftar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        // cara menggambar tiap produk
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* area produk: tekan untuk buka detail */}
            <TouchableOpacity onPress={() => openDetail(item)}>
              {/* kotak gambar/ikon produk */}
              <View style={styles.thumb}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumbImage} resizeMode={isMobile ? 'cover' : 'contain'} />
                ) : (
                  <Ionicons name="cube" size={30} color={c.textFaint} />
                )}
                {/* tombol hati terisi: tekan untuk menghapus dari favorit */}
                <TouchableOpacity style={styles.heart} onPress={() => onUnfav(item)}>
                  <Ionicons name="heart" size={16} color={c.danger} />
                </TouchableOpacity>
              </View>
              {/* harga */}
              <Text style={styles.price}>{rp(item.price)}</Text>
              {/* nama produk */}
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              {/* stok + kode */}
              <Text style={[styles.stock, item.stock <= 8 && styles.stockLow]}>
                {item.stock <= 8 ? `Sisa ${item.stock}` : `Stok ${item.stock}`} • {item.code}
              </Text>
            </TouchableOpacity>
            {/* tombol tambah ke keranjang (buka panel input jumlah) */}
            <TouchableOpacity style={styles.addBtn} onPress={() => setQtyProduct(item)}>
              <Ionicons name="add" size={15} color="#261A00" />
              <Text style={styles.addText}>Keranjang</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* panel input jumlah saat menambah ke keranjang */}
      {qtyProduct ? (
        <QtySheet
          product={qtyProduct}
          onClose={() => setQtyProduct(null)}
          onConfirm={(n) => { cart.add(qtyProduct, n); setQtyProduct(null); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ===== STYLE =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette, cardW: number, isMobile: boolean) => StyleSheet.create({
  // header biru halaman favorit
  header: { backgroundColor: c.primary, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16 },
  // judul header: putih, tebal (Poppins), ukuran 20
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: F.heading },
  // subjudul header: putih transparan
  headerSub: { color: 'rgba(255,255,255,0.68)', fontSize: 12, marginTop: 3, fontFamily: F.regular },
  // garis aksen kuning tipis di bawah header
  accentLine: { height: 3, width: 40, backgroundColor: c.accent, borderRadius: 3, marginTop: 12 },
  // isi daftar: jarak dalam 16, jarak bawah 110 agar item terakhir tidak ketutup tab bar mengambang
  list: { padding: 16, paddingBottom: 110 },
  // kartu produk: lebar tetap (agar kartu tunggal tidak melebar), latar kartu, sudut 16, padding 12, jarak bawah 14, garis tepi
  card: {
    width: cardW,
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  // kotak gambar produk: tinggi 104, latar chip, sudut 12, isi di tengah, jarak bawah 9
  thumb: {
    height: cardW - 24,
    backgroundColor: c.chip,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
    overflow: 'hidden',
  },
  // gambar produk: full size dalam thumb
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  // tombol hati: di kanan atas thumb, bulat 26x26, latar kartu, garis tepi
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  // harga produk: tebal, warna biru utama
  price: { fontSize: 14, fontFamily: F.extrabold, color: c.primary },
  // nama produk: dua baris, warna teks utama
  name: { fontSize: 12, fontFamily: F.semibold, color: c.text, marginTop: 3, minHeight: 32, lineHeight: 16 },
  // teks stok: kecil, warna teks sekunder
  stock: { fontSize: 10, color: c.textMuted, marginTop: 4, fontVariant: ['tabular-nums'] },
  // stok menipis: warna peringatan, tebal
  stockLow: { color: c.warn, fontFamily: F.bold },
  // tombol tambah keranjang: latar kuning aksen, sudut 10, isi di tengah menyamping
  addBtn: {
    backgroundColor: c.accent,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  // teks tombol tambah: tebal, warna cokelat gelap
  addText: { fontSize: 12, fontFamily: F.extrabold, color: '#261A00' },
  // tampilan kosong: di tengah, jarak atas
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 },
  // judul tampilan kosong
  emptyTitle: { fontSize: 15, fontFamily: F.bold, color: c.text, marginTop: 12 },
  // penjelasan tampilan kosong
  emptyText: { fontSize: 12.5, fontFamily: F.regular, color: c.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  // tombol masuk/daftar untuk tamu
  emptyBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 18 },
  // teks tombol masuk/daftar
  emptyBtnText: { color: '#fff', fontFamily: F.bold, fontSize: 14 },
});
