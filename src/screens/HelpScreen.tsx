// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// React + hook useMemo (menghitung ulang gaya saat tema berganti) & useState (indeks FAQ terbuka)
import { useMemo, useState } from 'react';
// komponen React Native
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
// ikon Ionicons
import { Ionicons } from '@expo/vector-icons';
// info kontak toko
import { business } from '../lib/business';
// palet warna dinamis (Terang/Gelap) & font dari theme
import { useColors } from '../store/preferences';
import { F, type Palette } from '../theme';

// ===== DAFTAR FAQ =====

// daftar pertanyaan yang sering diajukan
const FAQ: { q: string; a: string }[] = [
  { q: 'Bagaimana cara memesan sparepart?', a: 'Pilih produk di tab Belanja, masukkan ke keranjang, lalu lanjutkan ke pembayaran.' },
  { q: 'Metode pembayaran apa yang tersedia?', a: 'Pembayaran online melalui Midtrans (transfer bank, e-wallet, QRIS, dan kartu), atau bayar tunai di tempat (COD) saat pengambilan di toko.' },
  { q: 'Apakah pesanan bisa dikirim?', a: 'Bisa. Isi alamat pengiriman saat checkout, atau hubungi kami untuk pengambilan di toko.' },
  { q: 'Bagaimana cara memeriksa status pesanan?', a: 'Buka tab Pesanan untuk melihat status tiap pesanan (menunggu pembayaran, lunas, atau gagal).' },
  { q: 'Bagaimana jika stok produk habis?', a: 'Anda bisa menghubungi kami; kami akan mengabari ketika barang tersedia kembali.' },
];

// ===== LAYAR PUSAT BANTUAN =====

// layar bantuan: FAQ + tombol hubungi toko
export default function HelpScreen() {
  // indeks FAQ yang sedang terbuka (-1 = semua tertutup)
  const [openIdx, setOpenIdx] = useState<number>(-1);
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* pengantar */}
      <Text style={styles.intro}>Butuh bantuan? Lihat pertanyaan umum atau hubungi kami langsung.</Text>

      {/* ===== TOMBOL KONTAK ===== */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL(`https://wa.me/${business.whatsapp}`)}>
          <View style={[styles.contactIcon, { backgroundColor: '#25D366' }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          </View>
          <Text style={styles.contactText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL(`tel:${business.phone.replace(/\s/g, '')}`)}>
          <View style={[styles.contactIcon, { backgroundColor: c.primary }]}>
            <Ionicons name="call" size={18} color="#fff" />
          </View>
          <Text style={styles.contactText}>Telepon</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL(`mailto:${business.email}`)}>
          <View style={[styles.contactIcon, { backgroundColor: '#B23B00' }]}>
            <Ionicons name="mail" size={18} color="#fff" />
          </View>
          <Text style={styles.contactText}>Email</Text>
        </TouchableOpacity>
      </View>

      {/* ===== FAQ ===== */}
      <Text style={styles.section}>Pertanyaan Umum</Text>
      <View style={styles.card}>
        {FAQ.map((item, i) => {
          // apakah item ini sedang terbuka
          const isOpen = openIdx === i;
          return (
            <View key={item.q} style={[i < FAQ.length - 1 && styles.rowBorder]}>
              <TouchableOpacity
                style={styles.qRow}
                activeOpacity={0.7}
                onPress={() => setOpenIdx(isOpen ? -1 : i)}
              >
                <Text style={styles.qText}>{item.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
              </TouchableOpacity>
              {isOpen ? <Text style={styles.aText}>{item.a}</Text> : null}
            </View>
          );
        })}
      </View>

      {/* kontak tambahan */}
      <Text style={styles.footer}>{business.name} · {business.email}</Text>
    </ScrollView>
  );
}

// ===== STYLE =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // wadah layar
  container: { flex: 1, backgroundColor: c.bg },
  // area konten
  content: { padding: 16, paddingBottom: 40 },
  // pengantar
  intro: { fontSize: 13, fontFamily: F.regular, color: c.textMuted, marginBottom: 14, marginLeft: 4 },
  // baris tombol kontak
  actions: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  // tombol kontak
  contact: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 16 },
  // lingkaran ikon kontak
  contactIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // teks kontak
  contactText: { fontSize: 12, fontFamily: F.semibold, color: c.text },
  // judul bagian
  section: { fontSize: 12, fontFamily: F.bold, color: c.textMuted, letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  // kartu FAQ
  card: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  // garis pemisah
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  // baris pertanyaan
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  // teks pertanyaan
  qText: { flex: 1, fontSize: 13.5, fontFamily: F.semibold, color: c.text },
  // teks jawaban
  aText: { fontSize: 12.5, fontFamily: F.regular, color: c.textMuted, lineHeight: 19, paddingHorizontal: 14, paddingBottom: 14, marginTop: -4 },
  // teks footer
  footer: { fontSize: 11, fontFamily: F.regular, color: c.textMuted, textAlign: 'center', marginTop: 18 },
});
