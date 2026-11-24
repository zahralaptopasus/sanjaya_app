// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useEffect (saat layar dibuka) serta useState (data yang bisa berubah)
import React, { useEffect, useState } from 'react';
// mengambil komponen React Native: View (kotak), Text (teks), FlatList (daftar efisien),
// StyleSheet (pembuat style), ActivityIndicator (animasi loading), Image (gambar)
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil fungsi adminGetProducts (ambil daftar produk) dari lib/admin
import { adminGetProducts } from '../../lib/admin';
// mengambil fungsi rp (format Rupiah)
import { rp } from '../../lib/format';
// mengambil tipe data Product dari models
import type { Product } from '../../models';
// mengambil warna dari theme agar tampilan konsisten
import { navy, surface, cardBg, chipBg, muted, ink, bronze } from '../../theme';


// ===== KOMPONEN UTAMA =====

// komponen layar Preview Online Shop Admin
export default function AdminShopScreen() {
  // daftar produk yang akan ditampilkan
  const [products, setProducts] = useState<Product[]>([]);
  // penanda data pertama kali sedang dimuat
  const [loading, setLoading] = useState(true);

  // useEffect dijalankan sekali saat layar muncul: ambil produk lalu matikan loading
  useEffect(() => {
    adminGetProducts().then((p) => {
      // simpan hasil produk ke state
      setProducts(p);
      // hentikan loading setelah data diterima
      setLoading(false);
    });
  }, []);

  // jika masih loading, tampilkan animasi loading dan hentikan
  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: 'center' }} />;

  // return = tampilan layar
  return (
    // FlatList = daftar yang hanya merender item terlihat (hemat memori)
    <FlatList
      // latar halaman surface
      style={{ backgroundColor: surface }}
      // jarak isi 16 dan jarak bawah 32
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // data yang ditampilkan adalah daftar produk
      data={products}
      // keyExtractor = kunci unik tiap item berdasarkan id produk
      keyExtractor={(p) => p.id}
      // numColumns=2 = tampilkan dua kolom (grid)
      numColumns={2}
      // jarak antar kolom 12
      columnWrapperStyle={{ gap: 12 }}
      // ListHeaderComponent = bagian atas daftar (judul)
      ListHeaderComponent={
        <>
          {/* judul halaman */}
          <Text style={styles.header}>Online Shop</Text>
          {/* keterangan di bawah judul */}
          <Text style={styles.sub}>Preview produk yang tampil di aplikasi customer</Text>
        </>
      }
      // renderItem = cara menggambar tiap produk; item adalah produk saat ini
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* kotak gambar mini produk (thumbnail) */}
          <View style={styles.thumb}>
            {/* tampilkan gambar produk jika ada, fallback ikon kubus jika kosong */}
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumbImage} />
            ) : (
              <Ionicons name="cube" size={30} color="#8b8fa3" />
            )}
            {/* label stok di sudut kanan atas thumbnail */}
            <View style={styles.stockTag}>
              {/* teks stok: "Sisa x" jika stok <= 8 (style low), selain itu "Ready" */}
              <Text style={[styles.stockText, item.stock <= 8 && styles.low]}>{item.stock <= 8 ? `Sisa ${item.stock}` : 'Ready'}</Text>
            </View>
          </View>
          {/* kategori produk */}
          <Text style={styles.cat}>{item.category}</Text>
          {/* nama produk maksimal 2 baris */}
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          {/* kode produk */}
          <Text style={styles.code}>{item.code}</Text>
          {/* harga produk dalam format Rupiah */}
          <Text style={styles.price}>{rp(item.price)}</Text>
        </View>
      )}
      // ListEmptyComponent = tampilan saat daftar kosong
      ListEmptyComponent={<Text style={styles.empty}>Belum ada produk di online shop.</Text>}
    />
  );
}

// ===== STYLE (pengaturan tampilan) =====

const styles = StyleSheet.create({
  // judul halaman: ukuran 20, font Poppins tebal, warna ink
  header: { fontSize: 20, fontFamily: 'Poppins_800ExtraBold',  color: ink },
  // keterangan di bawah judul: ukuran 12, warna abu, jarak atas 2, bawah 14
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 14 },
  // kartu produk: mengisi kolom (flex 1), latar cardBg, sudut 16, padding 12, jarak bawah 12, garis tepi krem
  card: { flex: 1, backgroundColor: cardBg, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5DFD1' },
  // thumbnail: tinggi 92, latar chipBg, sudut 12, isi di tengah, jarak bawah 9
  thumb: { height: 150, backgroundColor: chipBg, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9, overflow: 'hidden' },
  // gambar thumbnail produk: tampil utuh (contain), sudut rapi mengikuti thumb
  thumbImage: { width: '100%', height: '100%', borderRadius: 12, resizeMode: 'contain' },
  // label stok: posisi absolut di pojok kanan atas, latar putih, sudut 6, padding 6/2, garis tepi krem
  stockTag: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#E5DFD1' },
  // teks stok: ukuran 9, font tebal, warna bronze
  stockText: { fontSize: 9, fontFamily: 'Inter_800ExtraBold',  color: bronze },
  // style stok rendah: warna merah
  low: { color: '#BA1A1A' },
  // kategori: ukuran 10, font tebal, warna bronze, jarak antar huruf 0.4
  cat: { fontSize: 10, fontFamily: 'Inter_800ExtraBold',  color: bronze, letterSpacing: 0.4 },
  // nama produk: ukuran 13, font tebal, warna ink, jarak atas 3, tinggi minimal 36, tinggi baris 17
  name: { fontSize: 13, fontFamily: 'Inter_700Bold',  color: ink, marginTop: 3, minHeight: 36, lineHeight: 17 },
  // kode produk: ukuran 10, warna abu, jarak atas 2, font angka rata (tabular-nums)
  code: { fontSize: 10, color: muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  // harga: ukuran 15, font tebal, warna navy, jarak atas 4
  price: { fontSize: 15, fontFamily: 'Inter_800ExtraBold',  color: navy, marginTop: 4 },
  // pesan kosong: rata tengah, warna abu, jarak atas 30, ukuran 13
  empty: { textAlign: 'center', color: muted, marginTop: 30, fontSize: 13 },
});
