// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React beserta hook useRef (referensi ke komponen), useState (data yang bisa berubah), useMemo (memo gaya)
import React, { useRef, useState, useMemo } from 'react';
// mengambil komponen bawaan React Native: View (kotak), Text (teks), StyleSheet (pembuat style),
// Image (gambar), TouchableOpacity (tombol tekan), ScrollView (area gulir), Dimensions (ukuran layar)
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
// mengambil SafeAreaView (wadah aman dari poni/lekukan layar)
import { SafeAreaView } from 'react-native-safe-area-context';
// mengambil AsyncStorage (penyimpanan lokal di perangkat untuk mengingat apakah welcome sudah dilihat)
import AsyncStorage from '@react-native-async-storage/async-storage';
// mengambil hook palet warna dinamis (Terang/Gelap) dan tipe paletnya
import { useColors } from '../store/preferences';
import type { Palette } from '../theme';

// ===== DATA SLIDE ONBOARDING =====

// tipe Slide menjelaskan bentuk tiap slide: img (gambar), t1 & t2 (baris judul), desc (deskripsi)
type Slide = { img: any; t1: string; t2: string; desc: string };

// array SLIDES menyimpan tiga slide pengenalan aplikasi
const SLIDES: Slide[] = [
  {
    // gambar slide pertama
    img: require('../../assets/images/onboarding_1.png'),
    // baris judul atas
    t1: 'Sparepart Motor',
    // baris judul bawah
    t2: 'Lengkap & Terpercaya',
    // deskripsi singkat
    desc: 'Cari oli, rem, kelistrikan, dan komponen mesin untuk motor Anda di satu tempat.',
  },
  {
    // gambar slide kedua
    img: require('../../assets/images/onboarding_2.png'),
    t1: 'Belanja Mudah,',
    t2: 'Bayar Aman',
    desc: 'Tambah ke keranjang lalu bayar lewat transfer, e-wallet, QRIS, atau tunai di toko (COD).',
  },
  {
    // gambar slide ketiga
    img: require('../../assets/images/onboarding_3.png'),
    t1: 'Pantau Pesanan',
    t2: 'Sampai Selesai',
    desc: 'Lihat status pesanan dan cetak struk kapan saja dari ponsel Anda.',
  },
];

// ===== KOMPONEN UTAMA =====

// komponen WelcomeScreen = layar pengenalan sebelum masuk; menerima prop navigation untuk berpindah layar
export default function WelcomeScreen({ navigation }: any) {
  // useRef menyimpan referensi ke ScrollView agar bisa digulir secara program
  const scrollRef = useRef<ScrollView>(null);
  // state "index" menyimpan nomor slide yang sedang tampil (awal 0 = slide pertama)
  const [index, setIndex] = useState(0);
  // variabel w = lebar layar perangkat (dipakai untuk ukuran tiap halaman & perhitungan gulir)
  const w = Dimensions.get('window').width;
  // variabel last = true jika sedang berada di slide terakhir
  const last = index === SLIDES.length - 1;
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // CATATAN: untuk sementara Welcome selalu tampil tiap aplikasi dibuka (saat belum login).
  // Gerbang "sekali saja" (cek penanda 'welcome_seen' lalu langsung replace ke Login) sengaja
  // dimatikan. Nanti untuk mode "hanya setelah download", hidupkan kembali effect berikut:
  //   useEffect(() => {
  //     AsyncStorage.getItem('welcome_seen').then((v) => {
  //       if (v === 'true' || v === '1') navigation.replace('Login');
  //     });
  //   }, []);

  // fungsi finish = menandai welcome sudah dilihat lalu pindah ke layar Login
  const finish = async () => {
    // simpan penanda 'welcome_seen' bernilai 'true'
    await AsyncStorage.setItem('welcome_seen', 'true');
    // pindah ke layar Login (replace)
    navigation.replace('Login');
  };

  // fungsi next = lanjut ke slide berikutnya, atau menyelesaikan welcome jika sudah slide terakhir
  const next = () => {
    // jika di slide terakhir, panggil finish
    if (last) {
      finish();
    } else {
      // nomor slide berikutnya
      const ni = index + 1;
      // perbarui state index
      setIndex(ni);
      // gulir ScrollView ke halaman berikutnya (posisi x = ni * lebar layar), dengan animasi
      scrollRef.current?.scrollTo({ x: ni * w, animated: true });
    }
  };

  // fungsi onScrollEnd = dipanggil saat pengguna selesai menggeser; menghitung slide yang aktif
  const onScrollEnd = (e: any) => {
    // ambil posisi geser horizontal (x)
    const x = e.nativeEvent.contentOffset.x;
    // hitung nomor slide dengan membagi x dengan lebar layar lalu dibulatkan
    const i = Math.round(x / w);
    // jika nomor slide berbeda dari state, perbarui index
    if (i !== index) setIndex(i);
  };

  // return = isi tampilan yang akan digambar di layar
  return (
    // SafeAreaView = wadah aman dari area atas & bawah layar (edges top & bottom)
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* header atas yang berisi nama merek */}
      <View style={styles.header}>
        {/* teks merek "SANJAYA" */}
        <Text style={styles.brand}>SANJAYA</Text>
      </View>

      {/* ScrollView horizontal berisi slide-slide pengenalan */}
      <ScrollView
        // referensi ke scroll agar bisa digulir lewat kode
        ref={scrollRef}
        // horizontal = digulir ke samping
        horizontal
        // pagingEnabled = tiap geser berhenti tepat satu halaman
        pagingEnabled
        // sembunyikan indikator gulir horizontal
        showsHorizontalScrollIndicator={false}
        // saat selesai menggeser, panggil onScrollEnd
        onMomentumScrollEnd={onScrollEnd}
        // seberapa sering event gulir dipanggil (makin kecil makin halus, di sini 16ms)
        scrollEventThrottle={16}
        // gaya: mengisi ruang yang tersedia
        style={{ flex: 1 }}
        // gaya isi: flexGrow 1 agar mengisi tinggi bila konten pendek
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* loop semua slide; untuk tiap slide buat satu halaman */}
        {SLIDES.map((s) => (
          // halaman slide; lebar disesuaikan lebar layar (w)
          <View key={s.t1} style={[styles.page, { width: w }]}>
            {/* wadah gambar di tengah */}
            <View style={styles.imgWrap}>
              {/* gambar slide; resizeMode contain = diperkecil agar muat tanpa terpotong */}
              <Image source={s.img} style={styles.img} resizeMode="contain" />
            </View>
            {/* judul baris atas */}
            <Text style={styles.t1}>{s.t1}</Text>
            {/* judul baris bawah */}
            <Text style={styles.t2}>{s.t2}</Text>
            {/* deskripsi slide */}
            <Text style={styles.desc}>{s.desc}</Text>
          </View>
        ))}
      </ScrollView>

      {/* baris titik indikator + tombol Lewati */}
      <View style={styles.dotsRow}>
        {/* kumpulan titik penanda halaman */}
        <View style={styles.dots}>
          {/* loop semua slide untuk membuat titik; (_ , i) = item diabaikan, ambil indeksnya */}
          {SLIDES.map((_, i) => (
            // satu titik; gaya digabung: dasar dot + aktif/idle + melebar saat aktif
            <View
              key={i}
              style={[
                styles.dot,
                // pilih gaya titik aktif atau tidak aktif
                i === index ? styles.dotActive : styles.dotIdle,
                // titik yang aktif lebarnya 22 (berbentuk kapsul)
                i === index && { width: 22 },
              ]}
            />
          ))}
        </View>
        {/* tombol Lewati hanya muncul bila belum di slide terakhir */}
        {!last ? (
          // tombol lompat ke akhir; hitSlop 8 = area tekan diperluas
          <TouchableOpacity onPress={finish} hitSlop={8}>
            {/* teks Lewati */}
            <Text style={styles.skip}>Lewati</Text>
          </TouchableOpacity>
        ) : (
          // placeholder kosong selebar 50 agar tata letak tidak bergeser saat tombol Lewati hilang
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* wadah tombol utama di bawah */}
      <View style={styles.btnWrap}>
        <TouchableOpacity
          // saat ditekan panggil next (lanjut / selesai)
          onPress={next}
          // activeOpacity 0.9 = sedikit meredup saat ditekan
          activeOpacity={0.9}
          // gaya tombol: dasar btn + varian tombol terakhir atau tombol lanjut
          style={[styles.btn, last ? styles.btnLast : styles.btnNext]}
        >
          {/* teks tombol dinamis: 'Mulai Sekarang →' di slide terakhir, 'Lanjut →' selain itu */}
          <Text style={[styles.btnText, last ? styles.btnTextLast : styles.btnTextNext]}>
            {last ? 'Mulai Sekarang  →' : 'Lanjut  →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ===== STYLE (pengaturan tampilan; dihitung dari palet tema) =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // wadah utama: mengisi penuh layar, latar mengikuti tema (Terang: biru sangat muda, Gelap: biru tua)
  root: { flex: 1, backgroundColor: c.primarySoft },
  // header: isi rata kanan (brand di kanan), jarak samping 20, jarak atas 8, jarak bawah 4
  header: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  // teks merek: warna brand, ukuran 16, font Inter ExtraBold, jarak antar huruf 0.5
  brand: { color: c.primary, fontSize: 16, fontFamily: 'Inter_800ExtraBold',  letterSpacing: 0.5 },
  // halaman slide: jarak samping 24, isi rata kiri (align-items flex-start)
  page: { paddingHorizontal: 24, alignItems: 'flex-start' },
  // wadah gambar: mengisi ruang (flex 1), lebar penuh, isi rata tengah, jarak vertikal 12
  imgWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  // gambar: lebar 92% dari wadah, tinggi 260
  img: { width: '92%', height: 260 },
  // judul baris atas: ukuran 24, font Inter ExtraBold, warna teks tema
  t1: { fontSize: 24, fontFamily: 'Inter_800ExtraBold',  color: c.text, lineHeight: 28 },
  // judul baris bawah: ukuran 24, font Inter ExtraBold, warna brand
  t2: { fontSize: 24, fontFamily: 'Inter_800ExtraBold',  color: c.primary, lineHeight: 28 },
  // deskripsi: ukuran 13, warna teks sekunder, jarak atas 8, tinggi baris 18
  desc: { fontSize: 13, color: c.textMuted, marginTop: 8, lineHeight: 18 },
  // baris titik + tombol: menyamping, rata tengah, titik di kiri & tombol di kanan (space-between)
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // kumpulan titik: menyamping, rata tengah vertikal
  dots: { flexDirection: 'row', alignItems: 'center' },
  // satu titik dasar: tinggi 8, sudut membulat 4, jarak kanan 6 (lebar diatur oleh dotIdle/dotActive)
  dot: { height: 8, borderRadius: 4, marginRight: 6 },
  // titik aktif: latar warna brand
  dotActive: { backgroundColor: c.primary },
  // titik tidak aktif: lebar 8, warna redup
  dotIdle: { width: 8, backgroundColor: c.textFaint },
  // teks Lewati: ukuran 13, warna brand, font Inter SemiBold
  skip: { fontSize: 13, color: c.primary, fontFamily: 'Inter_600SemiBold'},
  // wadah tombol: jarak samping 24, jarak atas 8, jarak bawah 24
  btnWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  // tombol dasar: tinggi 52, sudut membulat 14, isi rata tengah
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // tombol saat bukan slide terakhir: latar brand
  btnNext: { backgroundColor: c.primary },
  // tombol saat slide terakhir: latar aksen (kuning)
  btnLast: { backgroundColor: c.accent },
  // teks tombol dasar: font Inter Bold, ukuran 14
  btnText: { fontFamily: 'Inter_700Bold',  fontSize: 14 },
  // teks tombol lanjut: warna di atas brand
  btnTextNext: { color: c.onPrimary },
  // teks tombol terakhir: biru tua (agar kontras di latar kuning)
  btnTextLast: { color: '#082A66' },
});
