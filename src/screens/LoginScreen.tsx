// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useState (untuk menyimpan data yang bisa berubah di layar) + useMemo (memo gaya)
import React, { useState, useMemo } from 'react';
// mengambil komponen bawaan React Native: View (kotak), Text (teks), TextInput (kolom isian),
// TouchableOpacity (tombol tekan), StyleSheet (pembuat style), ActivityIndicator (animasi loading),
// KeyboardAvoidingView (menyesuaikan tampilan saat keyboard muncul), Platform (info sistem operasi),
// ScrollView (area gulir), Image (gambar), Alert (kotak dialog)
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil klien supabase (untuk autentikasi/daftar/login)
import { supabase } from '../lib/supabase';
// mengambil hook palet warna dinamis (Terang/Gelap) dan tipe paletnya
import { useColors } from '../store/preferences';
import type { Palette } from '../theme';
// mengambil useGuest (hook untuk masuk sebagai tamu)
import { useGuest } from '../store/guest';
// mengambil komponen ilustrasi bengkel (WorkshopIllustration) untuk hiasan atas
import WorkshopIllustration from '../components/WorkshopIllustration';
// mengambil modul WebBrowser (untuk membuka halaman login Google di luar aplikasi)
import * as WebBrowser from 'expo-web-browser';
// mengambil makeRedirectUri (membuat alamat pengalihan setelah login OAuth selesai)
import { makeRedirectUri } from 'expo-auth-session';

// ===== TIPE DATA =====

// membuat tipe Mode: hanya boleh bernilai 'login' atau 'register'
type Mode = 'login' | 'register';

// ===== KOMPONEN UTAMA =====

// komponen LoginScreen = layar login & daftar akun
export default function LoginScreen() {
  // state "mode" menyimpan apakah layar sedang di mode 'login' atau 'register'; setMode untuk mengubahnya
  const [mode, setMode] = useState<Mode>('login');
  // state "name" menyimpan nama lengkap yang diketik pengguna (awal kosong)
  const [name, setName] = useState('');
  // state "email" menyimpan email yang diketik pengguna (awal kosong)
  const [email, setEmail] = useState('');
  // state "pass" menyimpan kata sandi yang diketik pengguna (awal kosong)
  const [pass, setPass] = useState('');
  // state "showPass" menandai apakah kata sandi ditampilkan terang atau disembunyikan (awal false = tersembunyi)
  const [showPass, setShowPass] = useState(false);
  // state "loading" menandai proses login/daftar sedang berjalan (awal false)
  const [loading, setLoading] = useState(false);
  // state "googleLoading" menandai proses login Google sedang berjalan (awal false)
  const [googleLoading, setGoogleLoading] = useState(false);
  // state "guestLoading" menandai proses masuk sebagai tamu sedang berjalan (awal false)
  const [guestLoading, setGuestLoading] = useState(false);
  // state "err" menyimpan pesan error; bisa string atau null (awal null = tidak ada error)
  const [err, setErr] = useState<string | null>(null);
  // state "info" menyimpan pesan informasi; bisa string atau null (awal null)
  const [info, setInfo] = useState<string | null>(null);
  // mengambil fungsi enter dari useGuest (untuk masuk sebagai tamu)
  const { enter } = useGuest();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // variabel isLogin = true jika mode sekarang 'login'
  const isLogin = mode === 'login';

  // fungsi validate = memeriksa apakah isian sudah valid; mengembalikan pesan error atau null jika valid
  const validate = (): string | null => {
    // saat mode daftar, nama wajib diisi
    if (!isLogin && !name.trim()) return 'Nama wajib diisi';
    // email wajib diisi
    if (!email.trim()) return 'Email wajib diisi';
    // email harus berformat benar (dicek dengan pola regex)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Format email tidak valid';
    // kata sandi wajib diisi
    if (!pass) return 'Kata sandi wajib diisi';
    // kata sandi minimal 6 karakter
    if (pass.length < 6) return 'Kata sandi minimal 6 karakter';
    // jika semua lolos, kembalikan null (valid)
    return null;
  };

  // fungsi submit = menjalankan proses login atau daftar; "async" artinya boleh menunggu proses (await)
  const submit = async () => {
    // bersihkan pesan info sebelumnya
    setInfo(null);
    // jalankan validasi, simpan hasilnya di v
    const v = validate();
    // jika ada pesan error (v tidak null), tampilkan error dan hentikan fungsi
    if (v) {
      setErr(v);
      return;
    }
    // mulai keadaan loading
    setLoading(true);
    // bersihkan pesan error
    setErr(null);
    // blok try: coba jalankan, jika gagal lompat ke catch
    try {
      // simpan email tanpa spasi di awal/akhir
      const em = email.trim();
      // jika mode login
      if (isLogin) {
        // login memakai email + kata sandi lewat supabase; tunggu hasilnya
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pass });
        // jika ada error, lempar agar ditangkap catch
        if (error) throw error;
      } else {
        // jika mode daftar: buat akun baru beserta nama lengkap di data tambahan
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: pass,
          options: { data: { full_name: name.trim() } },
        });
        // jika ada error, lempar
        if (error) throw error;
        // setelah akun dibuat, jangan langsung login otomatis:
        // jika supabase memberi sesi (karena verifikasi email dimatikan), keluarkan dulu sesinya
        if (data.session) {
          // akhiri sesi otomatis supaya pengguna login manual di halaman login
          await supabase.auth.signOut();
        }
        // kosongkan isian nama dan kata sandi
        setName('');
        setPass('');
        // isi kolom email dengan email baru agar pengguna tinggal mengetik kata sandi
        setEmail(em);
        // tampilkan pesan info agar pengguna langsung login
        setInfo('Akun berhasil dibuat! Silakan login dengan akun barumu.');
        // pindahkan mode ke login
        setMode('login');
        // hentikan fungsi di sini
        return;
      }
    // blok catch: menangani error yang terjadi di try
    } catch (e: any) {
      // tampilkan pesan error dari server, atau pesan umum jika kosong
      setErr(e?.message ?? 'Terjadi kesalahan');
    // blok finally: selalu dijalankan, baik sukses maupun gagal
    } finally {
      // matikan keadaan loading
      setLoading(false);
    }
  };

  // fungsi guest = masuk sebagai tamu (langsung memanggil enter)
  const guest = async () => {
    setGuestLoading(true);
    try {
      enter();
    } finally {
      setGuestLoading(false);
    }
  };

  // fungsi forgot = mengirim link reset kata sandi ke email pengguna
  const forgot = async () => {
    // ambil email tanpa spasi
    const em = email.trim();
    // jika email kosong, minta isi dulu
    if (!em) {
      setErr('Masukkan email dulu untuk reset kata sandi');
      return;
    }
    // bersihkan error
    setErr(null);
    // minta supabase mengirim email reset kata sandi
    const { error } = await supabase.auth.resetPasswordForEmail(em);
    // jika error, tampilkan pesannya; jika berhasil, tampilkan info link terkirim
    if (error) setErr(error.message);
    else setErr('Link reset telah dikirim ke email (cek inbox/spam)');
  };

  // fungsi googleLogin = masuk memakai akun Google (OAuth)
  const googleLogin = async () => {
    // blok try: coba jalankan proses login Google
    try {
      // nyalakan indikator loading Google
      setGoogleLoading(true);
      // bersihkan error
      setErr(null);

      // ===== WEB (dibuka dari browser) =====
      // Platform.OS === 'web' = aplikasi dijalankan di browser (misal localhost:8081)
      if (Platform.OS === 'web') {
        // ambil email dari form tanpa spasi di awal/akhir; dipakai sebagai petunjuk akun Google
        const em = email.trim();
        // petunjuk login (opsional): jika email sudah diisi, berikan ke Google lewat login_hint
        // supaya Google melewati account chooser; bila chooser muncul, scope "email+profile"
        // tanggung jawab GoTrue (pakai "+") membuat Google menolak dengan error 400 malformed
        const queryParams: Record<string, string> = {};
        // jika email terisi, tawarkan akun itu langsung tanpa membuka daftar akun browser
        if (em) queryParams.login_hint = em;
        // di web pakai alamat origin halaman sebagai redirect (harus URL http yang valid, bukan skema sanjaya://)
        // biarkan supabase yang me-redirect halaman penuh; tidak perlu WebBrowser maupun pertukaran kode manual
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin, // contoh hasilnya: http://localhost:8081
            queryParams, // berisi login_hint bila email sudah diketik
          },
        });
        // jika error, lempar
        if (error) throw error;
        // selesai; halaman akan pindah ke Google, lalu kembali membawa sesi (ditangani detectSessionInUrl)
        return;
      }

      // ===== NATIVE (Android/iOS) =====
      // buat alamat pengalihan menggunakan skema 'sanjaya' dan path 'auth/callback'
      const redirectTo = makeRedirectUri({ scheme: 'sanjaya', path: 'auth/callback' });
      // cetak alamat pengalihan ke konsol untuk debugging
      console.log('[google] redirectTo =', redirectTo);
      // minta supabase memulai login OAuth provider google
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      // jika error, lempar
      if (error) throw error;
      // jika tidak ada URL, lempar error buatan
      if (!data?.url) throw new Error('Tidak dapat memulai login Google');

      // buka halaman login Google memakai browser; tunggu sampai selesai
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      // jika tidak sukses atau tidak ada URL balikan, anggap dibatalkan
      if (res.type !== 'success' || !res.url) {
        setErr('Login dibatalkan.');
        return;
      }
      // ubah URL balikan menjadi objek URL
      const url = new URL(res.url);
      // ambil kode otorisasi dari parameter 'code'
      const code = url.searchParams.get('code');
      // jika ada kode, tukar kode dengan sesi login (alur PKCE)
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        // jika ada error saat menukar, lempar
        if (exErr) throw exErr;
      }
    // blok catch: tangani error login Google
    } catch (e: any) {
      // tampilkan pesan error, atau pesan umum
      setErr(e?.message ?? 'Gagal login Google');
    // blok finally: selalu dijalankan
    } finally {
      // matikan indikator loading Google
      setGoogleLoading(false);
    }
  };

  // return = isi tampilan yang akan digambar di layar
  return (
    // View pembungkus utama layar login, memakai style screen
    <View style={styles.screen}>
      {/* KeyboardAvoidingView = mendorong konten naik saat keyboard muncul; hanya aktif di iOS (behavior padding) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ScrollView = area yang bisa digulir; keyboardShouldPersistTaps handled = ketukan tombol tetap terbaca walau keyboard terbuka */}
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* komponen ilustrasi bengkel di bagian atas */}
          <WorkshopIllustration />
          {/* kartu putih yang memuat form login/daftar */}
          <View style={styles.card}>
            {/* wadah lingkaran logo */}

            {/* judul dinamis: 'Login' atau 'Daftar' sesuai mode */}
            <Text style={styles.title}>{isLogin ? 'Login' : 'Daftar'}</Text>
            {/* subjudul dinamis: sapaan atau ajakan buat akun */}
            <Text style={styles.subtitle}>{isLogin ? 'Selamat datang kembali' : 'Buat akun Sanjaya Motor'}</Text>

            {/* kolom nama hanya muncul saat mode daftar; jika login null (tidak tampil) */}
            {!isLogin ? (
              // baris isian berbentuk pil untuk nama
              <View style={styles.pill}>
                {/* ikon orang di kiri kolom */}
                <Ionicons name="person-outline" size={16} color={c.textMuted} style={styles.pillIcon} />
                {/* kolom isian nama lengkap */}
                <TextInput
                  style={styles.pillInput}
                  placeholder="Nama lengkap"
                  placeholderTextColor={c.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            {/* baris isian berbentuk pil untuk email */}
            <View style={styles.pill}>
              {/* ikon surat di kiri kolom */}
              <Ionicons name="mail-outline" size={16} color={c.textMuted} style={styles.pillIcon} />
              {/* kolom isian email */}
              <TextInput
                style={styles.pillInput}
                placeholder="Email"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* baris isian berbentuk pil untuk kata sandi */}
            <View style={styles.pill}>
              {/* ikon gembok di kiri kolom */}
              <Ionicons name="lock-closed-outline" size={16} color={c.textMuted} style={styles.pillIcon} />
              {/* kolom isian kata sandi; secureTextEntry = sensor teks saat showPass false */}
              <TextInput
                style={styles.pillInput}
                placeholder="Kata sandi"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showPass}
                value={pass}
                onChangeText={setPass}
              />
              {/* tombol mata untuk menunjukkan/menyembunyikan kata sandi; hitSlop 8 = area tekan diperluas */}
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                {/* ikon mata: mata-tertutup saat sandi tampil, mata-terbuka saat tersembunyi */}
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* tombol "Lupa kata sandi?" hanya muncul saat mode login */}
            {isLogin ? (
              <TouchableOpacity onPress={forgot} style={styles.forgotWrap}>
                {/* teks lupa kata sandi */}
                <Text style={styles.forgot}>Lupa kata sandi?</Text>
              </TouchableOpacity>
            ) : null}

            {/* jika ada pesan error, tampilkan teks error */}
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {/* jika ada pesan info, tampilkan teks info */}
            {info ? <Text style={styles.info}>{info}</Text> : null}

            {/* tombol utama login/buat akun; saat loading tampil lebih pudar & tombol dinonaktifkan */}
            <TouchableOpacity style={[styles.primary, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading}>
              {/* jika loading tampil spinner; jika tidak tampil teks sesuai mode */}
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{isLogin ? 'Login' : 'Buat Akun'}</Text>}
            </TouchableOpacity>

            {/* baris pemisah dengan teks 'atau' di tengah */}
            <View style={styles.dividerRow}>
              {/* garis kiri */}
              <View style={styles.dividerLine} />
              {/* teks 'atau' */}
              <Text style={styles.dividerText}>atau</Text>
              {/* garis kanan */}
              <View style={styles.dividerLine} />
            </View>

            {/* tombol "Lanjutkan sebagai Tamu" */}
            <TouchableOpacity style={[styles.guest, guestLoading && { opacity: 0.7 }]} onPress={guest} disabled={guestLoading}>
              {/* saat loading tampil spinner kecil, jika tidak tampil ikon orang */}
              {guestLoading ? <ActivityIndicator color={c.text} size="small" /> : <Ionicons name="person-outline" size={16} color={c.text} />}
              {/* teks tombol tamu */}
              <Text style={styles.guestText}>Lanjutkan sebagai Tamu</Text>
            </TouchableOpacity>

            {/* tombol "Sign in with Google" */}
            <TouchableOpacity style={[styles.googleBtn, googleLoading && { opacity: 0.7 }]} onPress={googleLogin} disabled={googleLoading}>
              {/* saat loading tampil spinner kecil, jika tidak tampil logo Google */}
              {googleLoading ? <ActivityIndicator color={c.text} size="small" /> : <Image source={require('../../assets/images/google-g.png')} style={styles.googleIconImg} resizeMode="contain" />}
              {/* teks tombol Google; berubah jadi 'Membuka Google...' saat loading */}
              <Text style={styles.googleText}>{googleLoading ? 'Membuka Google...' : 'Sign in with Google'}</Text>
            </TouchableOpacity>

            {/* baris bawah: ajakan berpindah antara login dan daftar */}
            <View style={styles.footerRow}>
              {/* teks abu dinamis: 'Belum punya akun? ' atau 'Sudah punya akun? ' */}
              <Text style={styles.footerMuted}>{isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}</Text>
              {/* tombol tautan untuk berpindah mode; sekaligus membersihkan error */}
              <TouchableOpacity onPress={() => { setErr(null); setMode(isLogin ? 'register' : 'login'); }}>
                {/* teks tautan: 'Daftar' atau 'Masuk' */}
                <Text style={styles.footerLink}>{isLogin ? 'Daftar' : 'Masuk'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ===== STYLE (pengaturan tampilan; dihitung dari palet tema) =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // layar utama: mengisi penuh dan latar alternatif sesuai tema
  screen: { flex: 1, backgroundColor: c.bgAlt },
  // isi scroll: flexGrow 1 = mengisi tinggi layar, isi rata tengah, jarak dalam 20
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  // kartu form: latar kartu, sudut membulat 22, jarak dalam atas 22 / bawah 18 / samping 20
  card: {
    backgroundColor: c.card,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    // warna bayangan
    shadowColor: c.shadow,
    // transparansi bayangan
    shadowOpacity: 0.08,
    // radius sebaran bayangan
    shadowRadius: 16,
    // arah bayangan ke bawah 6
    shadowOffset: { width: 0, height: 6 },
    // elevation = bayangan di Android
    elevation: 6,
  },
  // judul: ukuran 20, font Inter ExtraBold, warna teks tema, teks rata tengah
  title: { fontSize: 20, fontFamily: 'Inter_800ExtraBold',  color: c.text, textAlign: 'center' },
  // subjudul: ukuran 12, warna teks sekunder, rata tengah, jarak atas 4, jarak bawah 16
  subtitle: { fontSize: 12, color: c.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  // baris isian berbentuk pil
  pill: {
    // susun menyamping (row)
    flexDirection: 'row',
    // rata tengah vertikal
    alignItems: 'center',
    // warna latar kolom isian
    backgroundColor: c.input,
    // sudut membulat 24 (pil)
    borderRadius: 24,
    // jarak dalam samping 14
    paddingHorizontal: 14,
    // jarak dalam atas-bawah 11
    paddingVertical: 11,
    // jarak bawah antar kolom 10
    marginBottom: 10,
    // garis tepi tebal 1
    borderWidth: 1,
    // warna garis tepi
    borderColor: c.border,
  },
  // ikon di dalam pil: jarak kanan 8
  pillIcon: { marginRight: 8 },
  // teks isian dalam pil: mengisi sisa ruang (flex 1), ukuran 14, warna teks tema, tanpa jarak vertikal
  pillInput: { flex: 1, fontSize: 14, color: c.text, paddingVertical: 0 },
  // wadah tautan lupa sandi: rata kanan (alignSelf flex-end), jarak atas 2, jarak bawah 10
  forgotWrap: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 10 },
  // teks lupa sandi: ukuran 11, warna teks sekunder, font Inter SemiBold
  forgot: { fontSize: 11, color: c.textMuted, fontFamily: 'Inter_600SemiBold'},
  // teks error: warna peringatan, ukuran 12, rata tengah, jarak bawah 10
  err: { color: c.danger, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  // teks info: warna sukses, ukuran 12, rata tengah, jarak bawah 10, font Inter SemiBold
  info: { color: c.success, fontSize: 12, textAlign: 'center', marginBottom: 10, fontFamily: 'Inter_600SemiBold'},
  // tombol utama: latar brand, sudut membulat 24, jarak dalam atas-bawah 13, isi rata tengah, jarak atas 2
  primary: {
    backgroundColor: c.primary,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  // teks tombol utama: warna di atas brand, font Inter Bold, ukuran 14
  primaryText: { color: c.onPrimary, fontFamily: 'Inter_700Bold',  fontSize: 14 },
  // baris pemisah: menyamping, rata tengah, jarak antar elemen 10, jarak vertikal 14
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  // garis pemisah: mengisi ruang (flex 1), tinggi 1, warna garis lembut
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  // teks 'atau': ukuran 11, warna teks sekunder
  dividerText: { fontSize: 11, color: c.textMuted },
  // tombol tamu: menyamping, rata tengah vertikal & horizontal, jarak 7, latar kolom isian, membulat 24
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: c.input,
    borderRadius: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  // teks tombol tamu: ukuran 13, font Inter SemiBold, warna teks tema
  guestText: { fontSize: 13, fontFamily: 'Inter_600SemiBold',  color: c.text },
  // tombol Google: menyamping, rata tengah, jarak 8, latar kartu, membulat 24, jarak atas 10
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.card,
    borderRadius: 24,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  // gambar logo Google: 20x20
  googleIconImg: { width: 20, height: 20 },
  // teks tombol Google: ukuran 13, font Inter SemiBold, warna teks tema
  googleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold',  color: c.text },
  // baris bawah: menyamping, rata tengah, jarak atas 14
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  // teks abu bawah: ukuran 12, warna teks sekunder
  footerMuted: { fontSize: 12, color: c.textMuted },
  // teks tautan bawah: ukuran 12, warna brand, font Inter Bold
  footerLink: { fontSize: 12, color: c.primary, fontFamily: 'Inter_700Bold'},
});
