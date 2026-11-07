// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useCallback, useMemo, useState
import React, { useCallback, useMemo, useState } from 'react';
// mengambil komponen React Native: View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, Platform, RefreshControl
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, Platform, RefreshControl } from 'react-native';
// mengambil SafeAreaView (area aman dari status bar karena header bawaan tab dimatikan)
import { SafeAreaView } from 'react-native-safe-area-context';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil useFocusEffect: menjalankan muat data setiap layar difokus (termasuk saat pertama & setelah edit)
import { useFocusEffect } from '@react-navigation/native';
// mengambil client Supabase untuk autentikasi (ambil data user & logout)
import { supabase } from '../lib/supabase';
// mengambil state management mode tamu (isGuest + exit)
import { useGuest } from '../store/guest';
// mengambil state management keranjang belanja (untuk clear saat keluar mode tamu)
import { useCart } from '../store/cart';
// mengambil preferensi (tema) agar baris "Tema" menampilkan pilihan aktif + palet warna aktif
import { usePreferences, useColors } from '../store/preferences';
// mengambil tipe palet warna dan font dari theme
import { F, type Palette } from '../theme';

// ===== DEFINISI MENU =====

// tipe satu item menu di halaman akun
type MenuItem = {
  // nama ikon Ionicons
  icon: string;
  // label yang ditampilkan
  label: string;
  // nama tab tujuan (mis. 'Orders', 'Cart'); kosong jika belum ada layar
  route?: string;
  // nilai yang muncul di kanan (mis. 'Terang')
  value?: string;
  // menandai layar belum tersedia (tampilkan "Segera hadir")
  soon?: boolean;
  // aksi khusus (mis. 'logout')
  action?: 'logout';
  // gaya merah (mis. untuk Keluar)
  danger?: boolean;
};

// tipe satu kelompok menu (judul + daftar item)
type MenuSection = { title: string; items: MenuItem[] };

// label tema sesuai pilihan pengguna (untuk baris "Tema")
const THEME_LABEL: Record<string, string> = { light: 'Terang', dark: 'Gelap', system: 'Ikuti Sistem' };

// fungsi pembuat daftar menu; themeLabel agar baris "Tema" menampilkan pilihan aktif
function buildSections(themeLabel: string): MenuSection[] {
  return [
    {
      title: 'Akun',
      items: [
        // pindah ke tab Riwayat Pesanan
        { icon: 'receipt-outline', label: 'Riwayat Pesanan', route: 'Orders' },
        // pindah ke tab Keranjang
        { icon: 'cart-outline', label: 'Keranjang Saya', route: 'Cart' },
        // buka layar Favorit (produk yang difavoritkan)
        { icon: 'heart-outline', label: 'Favorit Saya', route: 'Favorit' },
        // buka layar Edit Profil
        { icon: 'create-outline', label: 'Edit Profil', route: 'EditProfil' },
        // buka layar Alamat / Kendaraan
        { icon: 'location-outline', label: 'Alamat / Kendaraan Saya', route: 'Alamat' },
      ],
    },
    {
      title: 'Preferensi',
      items: [
        // buka layar Notifikasi
        { icon: 'notifications-outline', label: 'Notifikasi', route: 'Notifikasi' },
        // buka layar Tema (nilai = tema aktif)
        { icon: 'moon-outline', label: 'Tema', route: 'Tema', value: themeLabel },
      ],
    },
    {
      title: 'Bantuan',
      items: [
        // buka layar Tentang
        { icon: 'information-circle-outline', label: 'Tentang Santren Jaya Motor', route: 'Tentang' },
        // buka layar Pusat Bantuan
        { icon: 'help-buoy-outline', label: 'Pusat Bantuan / Hubungi', route: 'Bantuan' },
      ],
    },
  ];
}

// ===== KOMPONEN BARIS MENU =====

// baris menu (ikon + label + nilai + chevron); didefinisikan di luar komponen agar stabil
function MenuRow({ item, last, onPress }: { item: MenuItem; last?: boolean; onPress: (i: MenuItem) => void }) {
  // palet warna aktif + gaya (dihitung ulang saat tema berganti)
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    // baris: ikon + label + nilai/chevron
    <TouchableOpacity style={[styles.row, !last && styles.rowBorder]} activeOpacity={0.7} onPress={() => onPress(item)}>
      {/* kotak ikon (merah bila danger) */}
      <View style={[styles.iconBox, item.danger && styles.iconBoxDanger]}>
        <Ionicons name={item.icon as any} size={19} color={item.danger ? c.danger : c.primary} />
      </View>
      {/* label menu */}
      <Text style={[styles.label, item.danger && styles.labelDanger]}>{item.label}</Text>
      {/* nilai kanan (opsional) */}
      {item.value ? <Text style={styles.value}>{item.value}</Text> : null}
      {/* chevron hanya untuk item biasa */}
      {!item.danger ? <Ionicons name="chevron-forward" size={18} color={c.textFaint} /> : null}
    </TouchableOpacity>
  );
}

// ===== KOMPONEN UTAMA =====

// komponen layar Akun / Profil; menerima navigation untuk pindah tab
export default function ProfileScreen({ navigation }: any) {
  // nama user yang ditampilkan
  const [name, setName] = useState('Pelanggan');
  // email user
  const [email, setEmail] = useState('');
  // username user (dari tabel profiles)
  const [username, setUsername] = useState('');
  // nomor HP user (dari metadata)
  const [phone, setPhone] = useState('');
  // url foto profil (dari metadata); null = pakai gambar bawaan
  const [avatar, setAvatar] = useState<string | null>(null);
  // penanda sedang memuat data user
  const [loading, setLoading] = useState(true);
  // state penanda sedang tarik-untuk-refresh (pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);
  // mengambil info mode tamu dan fungsi keluar mode tamu
  const { isGuest, exit } = useGuest();
  // mengambil objek keranjang (dibersihkan saat masuk mode tamu)
  const cart = useCart();
  // mengambil preferensi tema untuk ditampilkan pada baris "Tema"
  const { theme } = usePreferences();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // daftar menu; baris Tema menampilkan label tema aktif
  const sections = buildSections(THEME_LABEL[theme] ?? 'Terang');

  // fungsi: ambil data user dari Supabase Auth (dipanggil saat fokus & saat pull-to-refresh)
  const loadUser = useCallback(async () => {
    // jika mode tamu, tidak ada user yang perlu diambil
    if (isGuest) { setLoading(false); return; }
    // ambil data user yang sedang login
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (u) {
      // metadata user (full_name, phone & avatar_url bisa ada)
      const meta = (u.user_metadata ?? {}) as any;
      // email user
      const mail = u.email ?? '';
      // nama: pakai full_name, jika tidak ada ambil bagian sebelum '@', terakhir 'Pelanggan'
      setName(meta.full_name ?? (mail ? mail.split('@')[0] : 'Pelanggan'));
      setEmail(mail);
      // nomor HP dari metadata
      setPhone(meta.phone ?? '');
      // foto profil dari metadata (boleh null)
      setAvatar(meta.avatar_url ?? null);
      // username diambil dari tabel profiles (sumber yang dipakai untuk login)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', u.id)
        .maybeSingle();
      setUsername(((profile as any)?.username as string | undefined) ?? '');
    }
    setLoading(false);
  }, [isGuest]);

  // muat data user setiap kali layar difokus (pertama kali & setelah kembali dari Edit Profil)
  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  // fungsi: muat ulang data user saat layar ditarik ke bawah
  const onRefresh = async () => {
    // nyalakan indikator refresh
    setRefreshing(true);
    // ambil ulang data lalu tunggu selesai
    await loadUser();
    // matikan indikator refresh
    setRefreshing(false);
  };

  // menampilkan notifikasi "Segera hadir" (web: window.alert, native: Alert)
  const soon = (label: string) => {
    const msg = `${label} akan tersedia di pembaruan berikutnya.`;
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Segera hadir', msg);
  };

  // keluar dari akun (setelah konfirmasi)
  const confirmLogout = () => {
    // lakukan signOut Supabase -> App otomatis kembali ke layar login
    const doLogout = () => { supabase.auth.signOut(); };
    // web: Alert.alert tidak berfungsi, pakai window.confirm
    if (Platform.OS === 'web') {
      if (window.confirm('Keluar dari akun ini?')) doLogout();
      return;
    }
    // native: dialog konfirmasi
    Alert.alert('Keluar', 'Keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: doLogout },
    ]);
  };

  // menangani tekan item menu
  const onPressItem = (item: MenuItem) => {
    // Keluar -> minta konfirmasi
    if (item.action === 'logout') { confirmLogout(); return; }
    // punya tab tujuan -> pindah tab
    if (item.route) { navigation?.navigate(item.route); return; }
    // sisanya: layar belum ada
    soon(item.label);
  };

  // return = tampilan halaman akun
  return (
    // SafeAreaView: latar biru utama agar menyatu dengan header
    <SafeAreaView style={{ flex: 1, backgroundColor: c.primary }} edges={['top']}>
      {/* ===== HEADER biru (rata kiri + garis aksen kuning) ===== */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Akun Saya</Text>
        <Text style={styles.headerSub}>{isGuest ? 'Mode tamu' : 'Profil & pengaturan akun'}</Text>
        <View style={styles.accentLine} />
      </View>

      {/* ===== KONTEN ===== */}
      <ScrollView
        style={{ backgroundColor: c.bg, flex: 1 }}
        contentContainerStyle={styles.content}
        // selalu bisa "memantul" ke bawah agar tarik-untuk-refresh tetap jalan walau konten pendek (iOS)
        alwaysBounceVertical
        // refreshControl = fitur tarik layar ke bawah untuk memuat ulang data user
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {isGuest ? (
          // ===== TAMPILAN MODE TAMU =====
          <View style={styles.guestBox}>
            {/* avatar */}
            <Image source={require('../../assets/images/profile.png')} style={styles.avatarImg} />
            {/* badge mode tamu */}
            <View style={styles.guestTag}>
              <Text style={styles.guestTagText}>Mode Tamu</Text>
            </View>
            {/* status */}
            <Text style={styles.pName}>Belum masuk</Text>
            {/* penjelasan */}
            <Text style={styles.guestText}>Kamu bisa lihat-lihat katalog. Masuk untuk belanja & melihat riwayat pesanan.</Text>
            {/* tombol masuk/daftar */}
            <TouchableOpacity style={styles.btn} onPress={() => { cart.clear(); exit(); }}>
              <Text style={styles.btnText}>Masuk / Daftar</Text>
            </TouchableOpacity>

            {/* tetap bisa akses info toko & bantuan tanpa login */}
            <View style={[styles.group, { marginTop: 20, alignSelf: 'stretch' }]}>
              <MenuRow item={{ icon: 'information-circle-outline', label: 'Tentang Santren Jaya Motor', route: 'Tentang' }} onPress={onPressItem} />
              <MenuRow item={{ icon: 'help-buoy-outline', label: 'Pusat Bantuan / Hubungi', route: 'Bantuan' }} last onPress={onPressItem} />
            </View>
          </View>
        ) : (
          // ===== TAMPILAN USER SUDAH LOGIN =====
          <View>
            {/* kartu profil */}
            <View style={styles.profileCard}>
              {/* avatar + badge pensil */}
              <View style={styles.avatarWrap}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImg} />
                ) : (
                  <Image source={require('../../assets/images/profile.png')} style={styles.avatarImg} />
                )}
                {/* badge edit: arahkan ke layar Edit Profil */}
                <TouchableOpacity style={styles.editBadge} onPress={() => navigation?.navigate('EditProfil')}>
                  <Ionicons name="pencil" size={12} color="#261A00" />
                </TouchableOpacity>
              </View>
              {/* kolom teks: nama + email + nomor HP */}
              <View style={{ flex: 1 }}>
                <Text style={styles.pName} numberOfLines={1}>{loading ? 'Memuat…' : name}</Text>
                <Text style={styles.pEmail} numberOfLines={1}>{loading ? ' ' : email || 'Pengguna'}</Text>
                {username ? (
                  // username yang dipakai untuk login
                  <Text style={styles.pUsername} numberOfLines={1}>@{username}</Text>
                ) : null}
                {phone ? (
                  // nomor HP (hanya bila diisi)
                  <Text style={styles.pPhone} numberOfLines={1}>{phone}</Text>
                ) : null}
              </View>
            </View>

            {/* ===== DAFTAR MENU bergrup ===== */}
            {sections.map((sec) => (
              <View key={sec.title}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                <View style={styles.group}>
                  {sec.items.map((it, i) => (
                    <MenuRow key={it.label} item={it} last={i === sec.items.length - 1} onPress={onPressItem} />
                  ))}
                </View>
              </View>
            ))}

            {/* ===== KELUAR (baris merah) ===== */}
            <View style={[styles.group, { marginTop: 20 }]}>
              <MenuRow item={{ icon: 'log-out-outline', label: 'Keluar', action: 'logout', danger: true }} last onPress={onPressItem} />
            </View>

            {/* keterangan versi aplikasi */}
            <Text style={styles.version}>Santren Jaya Motor • v1.0</Text>
          </View>
        )}
      </ScrollView>
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
  // area isi yang bisa digulir
  content: { padding: 16, paddingBottom: 32 },
  // kartu profil
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: c.border,
    shadowColor: c.primary, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  // pembungkus avatar (agar badge bisa diposisikan absolut)
  avatarWrap: { marginRight: 14 },
  // gambar avatar
  avatarImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primarySoft },
  // badge pensil di sudut avatar
  editBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: c.accent, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center',
  },
  // nama user
  pName: { fontSize: 16, fontFamily: F.bold, color: c.text },
  // email user
  pEmail: { fontSize: 12.5, fontFamily: F.regular, color: c.textMuted, marginTop: 2 },
  // username untuk login
  pUsername: { fontSize: 12.5, fontFamily: F.semibold, color: c.primary, marginTop: 2 },
  // nomor HP user
  pPhone: { fontSize: 12.5, fontFamily: F.regular, color: c.primary, marginTop: 2 },
  // judul kelompok menu
  sectionTitle: {
    fontSize: 11, fontFamily: F.bold, color: c.textMuted, letterSpacing: 1.2,
    marginTop: 20, marginBottom: 8, marginLeft: 4,
  },
  // kartu kelompok menu
  group: {
    backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border,
    overflow: 'hidden',
  },
  // satu baris menu
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  // garis pemisah antar baris
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  // kotak ikon
  iconBox: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  // kotak ikon untuk item danger (merah)
  iconBoxDanger: { backgroundColor: c.dangerSoft },
  // label menu
  label: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: c.text },
  // label menu danger (merah)
  labelDanger: { color: c.danger },
  // nilai kanan (mis. 'Terang')
  value: { fontSize: 12.5, fontFamily: F.regular, color: c.textMuted, marginRight: 6 },
  // versi aplikasi
  version: { textAlign: 'center', fontSize: 11, color: c.textMuted, marginTop: 18, fontFamily: F.regular },
  // kotak tampilan mode tamu
  guestBox: { alignItems: 'center', paddingTop: 8 },
  // badge mode tamu
  guestTag: { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 12 },
  // teks badge mode tamu
  guestTagText: { fontSize: 11, fontFamily: F.extrabold, color: '#261A00' },
  // penjelasan mode tamu
  guestText: { fontSize: 13, color: c.textMuted, marginTop: 6, textAlign: 'center', fontFamily: F.regular, paddingHorizontal: 8 },
  // tombol umum (Masuk/Daftar)
  btn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, alignSelf: 'stretch' },
  // teks tombol
  btnText: { color: '#fff', fontFamily: F.bold, fontSize: 15 },
});
