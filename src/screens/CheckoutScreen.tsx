// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useEffect (efek samping/polling), useRef (referensi), useState (data yang bisa berubah)
import React, { useEffect, useRef, useState, useMemo } from 'react';
// mengambil komponen bawaan React Native: View (kotak/div), Text (teks), TextInput (input teks),
// TouchableOpacity (tombol), ScrollView (area yang bisa digulir), StyleSheet (pembuat style),
// ActivityIndicator (animasi loading), KeyboardAvoidingView (menghindar keyboard), Platform (deteksi platform), Alert (dialog)
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
// mengambil state management keranjang belanja
import { useCart } from '../store/cart';
// mengambil state management mode tamu (guest)
import { useGuest } from '../store/guest';
// mengambil fungsi createOrder dan createSnapToken (untuk membuat order & token pembayaran Midtrans)
// getOrderStatus (cek status asli pesanan), cancelOrder (batalkan pesanan + kembalikan stok)
// getAddresses (ambil data kendaraan utama untuk mengisi plat nomor otomatis)
import { createOrder, createSnapToken, getOrderStatus, cancelOrder, getAddresses } from '../repo';
// mengambil klien Supabase untuk membaca data profil (nama & nomor HP)
import { supabase } from '../lib/supabase';
// mengambil fungsi rp (untuk mengubah angka menjadi format Rupiah)
import { rp } from '../lib/format';
// mengambil komponen WebView untuk menampilkan halaman pembayaran Midtrans
import { WebView } from 'react-native-webview';
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil hook palet warna dinamis (Terang/Gelap) dan tipe paletnya
import { useColors } from '../store/preferences';
import type { Palette } from '../theme';

// ===== KOMPONEN UTAMA =====

// membuat komponen layar Checkout (pembayaran); menerima prop navigation dari react-navigation
export default function CheckoutScreen({ navigation }: any) {
  // mengambil data keranjang belanja dari store cart
  const cart = useCart();
  // mengambil informasi mode tamu dari store guest
  const { isGuest } = useGuest();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // state untuk nama pemesan; terisi otomatis dari profil saat layar dibuka
  const [name, setName] = useState('');
  // state untuk nomor HP/WA pemesan; terisi otomatis dari profil
  const [phone, setPhone] = useState('');
  // state untuk plat nomor kendaraan; terisi otomatis dari kendaraan utama
  const [plat, setPlat] = useState('');
  // state pesan error validasi (inline); null = tidak ada error
  const [err, setErr] = useState<string | null>(null);
  // state penanda apakah sedang proses pembayaran; awalnya false
  const [paying, setPaying] = useState(false);
  // state untuk menyimpan URL pembayaran Midtrans Snap (jika sudah tersedia); awalnya null
  const [payUrl, setPayUrl] = useState<string | null>(null);
  // state penanda popup awal diblokir (hanya web): bila true, tampilkan hint di layar status
  const [webOpenFailed, setWebOpenFailed] = useState(false);
  // state penanda proses pembatalan pesanan sedang berjalan
  const [cancelling, setCancelling] = useState(false);
  // state pesan error pada layar status (mis. gagal membatalkan)
  const [payErr, setPayErr] = useState<string | null>(null);
  // kode pesanan dibangkitkan via Date.now() - diambil 6 digit terakhir untuk menghasilkan kode unik
  // memakai useState dengan lazy initializer supaya kode dibuat SATU KALI saat layar dibuka
  // (bukan di tiap render, dan bukan dengan membaca .current ref saat render)
  const [orderCode] = useState(() => `SJM-${Date.now().toString().slice(-6)}`);
  // referensi untuk menyimpan ID order dari database (dibutuhkan saat redirect WebView)
  const orderIdRef = useRef<string | null>(null);
  // penanda agar navigasi ke struk hanya terjadi sekali (cegah dobel dari polling & redirect WebView)
  const doneRef = useRef(false);
  // ref yang selalu menunjuk fungsi navigasi struk terbaru (agar polling memakai closure terbaru)
  const navToReceiptRef = useRef<(id: string | null, clearCart: boolean) => void>(() => {});

  // membuat fungsi untuk menuju ke layar struk/receipt
  // menerima dbOrderId (ID order dari database) atau null (fallback ke orderCode)
  // clearCart: kosongkan keranjang hanya saat pembayaran benar-benar lunas
  const goReceipt = (dbOrderId: string | null, clearCart = true) => {
    // cegah navigasi ganda (polling & redirect bisa memicu bersamaan)
    if (doneRef.current) return;
    doneRef.current = true;
    // membuat snapshot data pesanan untuk dikirim ke ReceiptScreen
    const snapshot = {
      // ID order yang akan ditampilkan di struk (gunakan dbOrderId jika ada, else orderCode)
      orderId: dbOrderId ?? orderCode,
      // waktu pembayaran dalam format ISO 8601
      paidAt: new Date().toISOString(),
      // nama pemesan
      name,
      // nomor HP/WA pemesan
      phone,
      // plat nomor kendaraan
      plat,
      // daftar item yang dibeli (hanya item yang dicentang di keranjang)
      items: cart.selectedItems.map((e) => ({ product: e.product, qty: e.qty })),
      // kode kupon yang dipakai (jika ada)
      coupon: cart.coupon,
      // subtotal sebelum diskon (dari item terpilih)
      subtotal: cart.selectedSubtotal,
      // nilai diskon (dari item terpilih)
      discount: cart.selectedDiscount,
    };
    // menghapus HANYA item yang dibeli (terpilih) dari keranjang saat lunas;
    // item yang tidak dicentang tetap tersimpan untuk dibeli nanti
    if (clearCart) cart.removeSelected();
    // mengganti halaman Checkout dengan Receipt (tidak bisa kembali ke checkout)
    navigation.replace('Receipt', snapshot);
  };
  // perbarui ref tiap render (via effect, bukan saat render) agar polling selalu
  // memakai versi goReceipt terbaru tanpa melanggar aturan "jangan akses ref saat render"
  useEffect(() => {
    navToReceiptRef.current = goReceipt;
  });

  // effect: saat layar dibuka, isi otomatis nama & nomor HP dari profil, plus plat dari kendaraan utama
  useEffect(() => {
    // pengguna tamu tidak punya profil
    if (isGuest) return;
    // penanda agar tidak setState setelah layar dilepas
    let active = true;
    // ambil data user lalu isi nama & nomor HP (hanya bila field masih kosong)
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const meta = (data.user?.user_metadata ?? {}) as any;
      // pakai bentuk fungsional agar tidak menimpa ketikan pengguna & aman dari dependensi
      setName((prev) => (prev.trim() ? prev : (meta.full_name ?? prev)));
      setPhone((prev) => (prev.trim() ? prev : (meta.phone ?? prev)));
    });
    // ambil kendaraan utama untuk mengisi plat nomor
    getAddresses('vehicle').then((rows) => {
      if (!active) return;
      // pilih kendaraan utama; bila tidak ada yang ditandai, pakai yang pertama
      const main = rows.find((r) => r.is_default) ?? rows[0];
      setPlat((prev) => (prev.trim() ? prev : (main?.plate ?? prev)));
    });
    // bersihkan agar tidak setState setelah layar dilepas
    return () => { active = false; };
  }, [isGuest]);


  // fungsi untuk memproses pembayaran: membuat order terlebih dahulu, lalu mendapatkan token Midtrans Snap
  const pay = async () => {
    // validasi: minimal ada satu item yang dicentang untuk dibayar
    if (cart.selectedCount === 0) {
      // tampilkan pesan error inline (aman di web karena Alert.alert tidak berfungsi di web)
      setErr('Pilih minimal satu item untuk dibayar.');
      return;
    }
    // validasi isian wajib: nama dan nomor HP/WA harus diisi sebelum melanjutkan pembayaran
    if (!name.trim() || !phone.trim()) {
      // tampilkan pesan error inline (aman di web karena Alert.alert tidak berfungsi di web)
      setErr('Nama dan nomor HP/WA wajib diisi.');
      return;
    }
    // bersihkan pesan error bila isian sudah valid
    setErr(null);
    // menandakan proses pembayaran sedang berjalan
    setPaying(true);
    // di web: buka tab kosong SEGERA (masih dalam gestur klik) agar tidak diblokir popup blocker
    const win = Platform.OS === 'web' ? window.open('', '_blank') : null;
    // catat bila popup awal gagal dibuka (mis. diblokir) untuk hint di layar status
    if (Platform.OS === 'web' && !win) setWebOpenFailed(true);
    // membuat order baru di database via API; mengirim kode, item, subtotal, diskon, total
    const dbOrderId = await createOrder({
      code: orderCode,
      items: cart.selectedItems.map((e) => ({
        // ID produk
        product_id: e.product.id,
        // nama produk
        name: e.product.name,
        // jumlah pembelian
        qty: e.qty,
        // harga satuan produk
        price: e.product.price,
      })),
      // subtotal belanja (item terpilih)
      subtotal: cart.selectedSubtotal,
      // diskon yang diterapkan (item terpilih)
      discount: cart.selectedDiscount,
      // total yang harus dibayar (item terpilih)
      total: cart.selectedTotal,
    });

    // jika stok barang tidak cukup
    if (dbOrderId === 'STOK_KURANG') {
      // menghentikan proses pembayaran
      setPaying(false);
      // menampilkan alert bahwa stok kurang
      Alert.alert('Stok kurang', 'Ada barang yang stoknya tidak mencukupi. Kurangi jumlah lalu coba lagi.');
      return;
    }

    // jika gagal membuat order (dbOrderId null)
    if (!dbOrderId) {
      // menghentikan proses pembayaran
      setPaying(false);
      // menampilkan alert gagal membuat pesanan
      Alert.alert('Gagal', 'Tidak bisa membuat pesanan. Coba lagi.');
      return;
    }

    // mendapatkan token Snap Midtrans untuk halaman pembayaran
    const url = await createSnapToken(dbOrderId);
    if (url) {
      // menyimpan ID order dari database ke ref
      orderIdRef.current = dbOrderId;
      // di web: arahkan tab kosong yang sudah dibuka ke halaman bayar, lalu tampilkan layar status
      if (Platform.OS === 'web') {
        // arahkan tab ke halaman pembayaran Snap (ganti URL tab kosong yang dibuka tadi)
        if (win) win.location.href = url;
        // simpan URL pembayaran untuk ditampilkan di layar status web
        setPayUrl(url);
        // menghentikan proses loading pembayaran
        setPaying(false);
        return;
      }
      // menyimpan URL pembayaran untuk menampilkan WebView (native)
      setPayUrl(url);
      // menghentikan proses loading pembayaran
      setPaying(false);
      return;
    }

    // jika gagal mendapatkan token Snap: tutup tab kosong (web), tampilkan error, jangan anggap lunas
    if (win) win.close();
    setPaying(false);
    setErr('Gagal memulai pembayaran Midtrans. Coba lagi.');
  };

  // handler perubahan navigasi pada WebView (mendeteksi pembayaran berhasil di halaman Midtrans)
  const handleNavChange = (nav: any) => {
    // mengambil URL saat ini dari WebView
    const url = (nav?.url ?? '') as string;
    // mendeteksi status pembayaran berhasil: status_code 200 atau transaction_status settlement/capture
    if (/status_code=200|transaction_status=settlement|transaction_status=capture/i.test(url)) {
      // arahkan ke halaman struk dengan ID order yang sesuai
      goReceipt(orderIdRef.current ?? orderCode);
    }
  };

  // fungsi membatalkan pesanan: tandai 'cancelled' + kembalikan stok, lalu tampilkan struk GAGAL
  const cancelPay = async () => {
    // ambil id order asli; bila belum ada, tidak ada yang bisa dibatalkan
    const id = orderIdRef.current;
    if (!id) return;
    // bersihkan pesan error lalu tandai proses pembatalan berjalan
    setPayErr(null);
    setCancelling(true);
    // panggil RPC cancel_order (order gagal + stok kembali)
    const ok = await cancelOrder(id);
    // hentikan indikator proses
    setCancelling(false);
    if (ok) {
      // tampilkan struk GAGAL; keranjang dipertahankan agar bisa pesan ulang
      goReceipt(id, false);
    } else {
      // beri tahu user bila pembatalan gagal
      setPayErr('Gagal membatalkan pesanan. Coba lagi.');
    }
  };

  // efek polling: selama menunggu pembayaran, pantau status order asli tiap 4 detik
  useEffect(() => {
    // hanya berjalan bila URL pembayaran sudah tersedia (order sudah dibuat)
    if (!payUrl) return;
    // ambil id order dari ref (order asli di database)
    const id = orderIdRef.current;
    if (!id) return;
    // fungsi cek status dari database lalu arahkan sesuai hasil
    const tick = async () => {
      // lewati bila navigasi struk sudah dilakukan
      if (doneRef.current) return;
      // ambil status terbaru (RLS: hanya order milik user sendiri)
      const st = String((await getOrderStatus(id)) ?? '').toLowerCase();
      if (doneRef.current) return;
      if (st === 'paid' || st === 'settlement' || st === 'capture') {
        // lunas: kosongkan keranjang, tampilkan struk LUNAS
        navToReceiptRef.current(id, true);
      } else if (st === 'failed' || st === 'cancelled') {
        // gagal/kedaluwarsa: tampilkan struk GAGAL, keranjang dipertahankan
        navToReceiptRef.current(id, false);
      }
    };
    // cek langsung sekali, lalu ulangi tiap 4 detik
    tick();
    const timer = setInterval(tick, 4000);
    // bersihkan interval saat layar ditutup / payUrl berubah
    return () => clearInterval(timer);
  }, [payUrl]);

  // jika sudah memiliki payUrl (token Midtrans tersedia), tampilkan halaman pembayaran
  if (payUrl) {
    // di web WebView tidak didukung → tampilkan layar status; pembayaran dibuka di tab browser baru
    if (Platform.OS === 'web') {
      return (
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {/* isi layar status pembayaran web (tanpa tombol "Selesai"; menunggu hasil pembayaran asli) */}
          <View style={styles.payStatusWrap}>
            {/* ikon lingkaran besar */}
            <View style={styles.payStatusIcon}>
              <Ionicons name="browsers-outline" size={30} color={c.primary} />
            </View>
            {/* judul status */}
            <Text style={styles.payStatusTitle}>Menunggu Pembayaran</Text>
            {/* keterangan status */}
            <Text style={styles.payStatusDesc}>
              Selesaikan pembayaran di tab Midtrans yang terbuka. Halaman ini otomatis
              berubah setelah pembayaran berhasil atau kedaluwarsa (15 menit).
            </Text>
            {/* indikator menunggu */}
            <ActivityIndicator color={c.primary} style={{ marginTop: 14 }} />
            {/* hint bila popup awal diblokir browser */}
            {webOpenFailed ? (
              <Text style={styles.payStatusHint}>
                Tab otomatis tidak terbuka (terblokir). Klik tombol di bawah untuk membukanya.
              </Text>
            ) : null}
            {/* tombol membuka halaman pembayaran kembali */}
            <TouchableOpacity
              style={styles.payStatusBtn}
              onPress={() => window.open(payUrl, '_blank')}
            >
              <Ionicons name="open-outline" size={16} color="#261A00" />
              <Text style={styles.payStatusBtnText}>Buka Halaman Pembayaran</Text>
            </TouchableOpacity>
            {/* tombol membatalkan pesanan (order jadi gagal + stok kembali) */}
            <TouchableOpacity style={styles.payStatusGhost} onPress={cancelPay} disabled={cancelling}>
              {cancelling ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <Text style={styles.payStatusGhostText}>Batalkan Pesanan</Text>
              )}
            </TouchableOpacity>
            {/* pesan error bila pembatalan gagal */}
            {payErr ? <Text style={styles.payStatusHint}>{payErr}</Text> : null}
          </View>
        </View>
      );
    }

    // (native) WebView menampilkan halaman pembayaran Midtrans Snap
    return (
      <View style={{ flex: 1 }}>
        {/* header WebView: tombol "Batalkan Pesanan" (order gagal + stok kembali) */}
        <View style={styles.webviewHeader}>
          <TouchableOpacity onPress={cancelPay} disabled={cancelling}>
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold'}}>
              {cancelling ? 'Membatalkan…' : 'Batalkan Pesanan'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* WebView menampilkan halaman pembayaran Midtrans Snap */}
        <WebView source={{ uri: payUrl }} onNavigationStateChange={handleNavChange} startInLoadingState />
      </View>
    );
  }

  // jika user dalam mode tamu, blokir akses ke halaman checkout
  if (isGuest) {
    return (
      <View style={[styles.blocked, { backgroundColor: c.bg }]}>
        {/* ikon gembok untuk menunjukkan akses terbatas */}
        <Ionicons name="lock-closed" size={40} color={c.textMuted} />
        {/* teks judul blokir */}
        <Text style={{ fontSize: 17, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginTop: 14 }}>Login Dulu</Text>
        {/* penjelasan mengapa diblokir */}
        <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4, textAlign: 'center' }}>
          Untuk melanjutkan pembayaran, silakan masuk atau daftar akun.
        </Text>
      </View>
    );
  }

  // return tampilan utama halaman checkout (form data pemesan + ringkasan belanja + tombol bayar)
  return (
    // KeyboardAvoidingView = mendorong isi saat keyboard muncul (khusus iOS)
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* ===== KARTU DATA PEMESAN ===== */}
        <View style={styles.card}>
          {/* header kartu: ikon lingkaran + judul */}
          <View style={styles.cardHeadRow}>
            {/* ikon lingkaran biru muda */}
            <View style={styles.cardIcon}>
              <Ionicons name="person-circle-outline" size={20} color={c.primary} />
            </View>
            {/* kolom judul + keterangan */}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Data Pemesan</Text>
              <Text style={styles.cardSub}>Lengkapi data untuk proses pembayaran</Text>
            </View>
          </View>

          {/* field nama: label + input berikon */}
          <View style={styles.fieldGroup}>
            {/* label field */}
            <Text style={styles.fieldLabel}>Nama Lengkap</Text>
            {/* baris input + ikon; garis merah bila tidak valid */}
            <View style={[styles.inputRow, err && !name.trim() && styles.inputRowErr]}>
              {/* ikon prefix */}
              <Ionicons name="person-outline" size={16} color={c.textMuted} />
              {/* input teks (tanpa garis tepi sendiri) */}
              <TextInput
                style={styles.inputInner}
                placeholder="Nama"
                placeholderTextColor={c.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); if (err) setErr(null); }}
              />
            </View>
          </View>

          {/* field HP/WA */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>No. HP / WA</Text>
            <View style={[styles.inputRow, err && !phone.trim() && styles.inputRowErr]}>
              <Ionicons name="call-outline" size={16} color={c.textMuted} />
              <TextInput
                style={styles.inputInner}
                placeholder="HP / WA"
                placeholderTextColor={c.textMuted}
                value={phone}
                onChangeText={(t) => { setPhone(t); if (err) setErr(null); }}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* field plat nomor */}
          <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>Plat Nomor</Text>
            <View style={styles.inputRow}>
              <Ionicons name="car" size={16} color={c.textMuted} />
              <TextInput
                style={styles.inputInner}
                placeholder="Plat Nomor"
                placeholderTextColor={c.textMuted}
                value={plat}
                onChangeText={setPlat}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* pesan error bila ada isian wajib yang kosong */}
          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={14} color={c.danger} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}
        </View>

        {/* ===== KARTU RINGKASAN BELANJA ===== */}
        <View style={styles.card}>
          {/* header kartu: ikon + judul + badge jumlah item */}
          <View style={styles.cardHeadRow}>
            {/* ikon lingkaran biru muda */}
            <View style={styles.cardIcon}>
              <Ionicons name="receipt-outline" size={20} color={c.primary} />
            </View>
            {/* kolom judul */}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Ringkasan Belanja</Text>
              <Text style={styles.cardSub}>Daftar item yang akan dibeli</Text>
            </View>
            {/* badge jumlah item */}
            <View style={styles.badge}><Text style={styles.badgeText}>{cart.selectedCount} item</Text></View>
          </View>

          {/* daftar item yang dibeli (item terpilih) */}
          {cart.selectedItems.map((e, i) => (
            <View key={i} style={styles.lineRow}>
              {/* kolom kiri: nama produk + jumlah */}
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName} numberOfLines={1}>{e.product.name}</Text>
                {/* jumlah kecil */}
                <Text style={styles.lineSub}>x{e.qty}</Text>
              </View>
              {/* harga subtotal per item */}
              <Text style={styles.lineValue}>{rp(e.product.price * e.qty)}</Text>
            </View>
          ))}

          {/* pemisah putus-putus */}
          <View style={styles.divider} />
          {/* baris subtotal */}
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Subtotal</Text>
            <Text style={styles.sumValue}>{rp(cart.selectedSubtotal)}</Text>
          </View>
          {/* baris diskon (hanya tampil bila ada kupon terpakai) */}
          {cart.selectedDiscount > 0 ? (
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: c.warn }]}>Diskon</Text>
              <Text style={[styles.sumValue, { color: c.warn }]}>- {rp(cart.selectedDiscount)}</Text>
            </View>
          ) : null}
          {/* baris total bayar */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Bayar</Text>
            <Text style={styles.totalValue}>{rp(cart.selectedTotal)}</Text>
          </View>
        </View>

        {/* ===== KARTU METODE PEMBAYARAN ===== */}
        <View style={styles.card}>
          {/* header kartu metode */}
          <View style={styles.cardHeadRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="shield-checkmark" size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Metode Pembayaran</Text>
              <Text style={styles.cardSub}>via Midtrans • transaksi aman</Text>
            </View>
          </View>
          {/* deretan pill metode pembayaran */}
          <View style={styles.methodRow}>
            {/* pill QRIS */}
            <View style={styles.methodChip}>
              <Ionicons name="qr-code" size={15} color={c.warn} />
              <Text style={styles.methodChipText}>QRIS</Text>
            </View>
            {/* pill Virtual Account */}
            <View style={styles.methodChip}>
              <Ionicons name="card-outline" size={15} color={c.warn} />
              <Text style={styles.methodChipText}>Virtual Account</Text>
            </View>
            {/* pill GoPay */}
            <View style={styles.methodChip}>
              <Ionicons name="phone-portrait" size={15} color={c.warn} />
              <Text style={styles.methodChipText}>GoPay</Text>
            </View>
          </View>
          {/* catatan kecil keamanan */}
          <View style={styles.secureRow}>
            <Ionicons name="lock-closed" size={12} color={c.textMuted} />
            <Text style={styles.secureText}>Hanya pembayaran asli yang akan diverifikasi.</Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== FOOTER BAYAR ===== */}
      <View style={styles.bottomBar}>
        {/* baris atas: label + nilai total */}
        <View style={styles.payTopRow}>
          <Text style={styles.payLabel}>Total Bayar</Text>
          <Text style={styles.payValue}>{rp(cart.selectedTotal)}</Text>
        </View>
        {/* tombol bayar kuning aksen */}
        <TouchableOpacity style={styles.payBtn} onPress={pay} disabled={paying}>
          {/* saat proses pembayaran tampil spinner, jika tidak tampil ikon gembok + teks */}
          {paying ? (
            <ActivityIndicator color="#261A00" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={16} color="#261A00" />
              <Text style={styles.payBtnText}>Bayar dengan Midtrans</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// StyleSheet.create membuat kumpulan style yang bisa dipanggil dengan nama
// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // kartu dasar putih: latar putih, sudut 16, padding 16, garis tepi lembut, jarak bawah 12, bayangan halus
  card: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 12,
    shadowColor: c.primary, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  // baris header kartu: menyamping, rata tengah, jarak isi 10, jarak bawah 14
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  // ikon lingkaran header: 38x38, bulat penuh, latar biru muda, isi di tengah
  cardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  // judul kartu: ukuran 16, tebal
  cardTitle: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: c.text },
  // keterangan kartu: ukuran 11, warna abu, jarak atas 2
  cardSub: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  // grup satu field form: jarak bawah antar field 12
  fieldGroup: { marginBottom: 12 },
  // label field: ukuran 11, tebal, warna abu, jarak bawah 6
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textMuted, marginBottom: 6 },
  // baris input: menyamping, rata tengah, tinggi 50, garis tepi lembut, sudut 12, latar putih, jarak isi 8
  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 50, borderWidth: 1.5, borderColor: c.border,
    borderRadius: 12, paddingHorizontal: 12, gap: 8, backgroundColor: c.card,
  },
  // kondisi input bermasalah (validasi): garis tepi merah
  inputRowErr: { borderColor: c.danger },
  // kolom teks input: mengisi ruang, ukuran 15
  inputInner: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 0 },
  // kotak pesan error: menyamping, rata tengah, jarak isi 6, latar merah muda, sudut 10, padding 10, jarak atas 10
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.dangerSoft, borderRadius: 10, padding: 10, marginTop: 10 },
  // teks pesan error: ukuran 12, warna merah
  errText: { fontSize: 12, color: c.danger, flex: 1 },
  // badge jumlah item: latar kuning aksen, sudut 12, padding horizontal 10 vertikal 4
  badge: { backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  // teks badge: warna cokelat gelap, ukuran 11, tebal
  badgeText: { color: '#261A00', fontSize: 11, fontFamily: 'Inter_800ExtraBold' },
  // baris item ringkasan: menyamping, tersebar, rata tengah, jarak bawah 10
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  // nama item: ukuran 13, warna teks utama
  lineName: { fontSize: 13, color: c.text },
  // jumlah item (x2): ukuran 11, warna abu, jarak atas 2
  lineSub: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  // harga item: tebal, ukuran 13
  lineValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 13, color: c.text },
  // pemisah putus-putus: garis atas putus-putus abu, jarak vertikal 10
  divider: { borderTopWidth: 1, borderColor: c.border, borderStyle: 'dashed', marginVertical: 10 },
  // baris ringkasan angka: menyamping, tersebar, padding vertikal 3
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  // label ringkasan: warna abu, ukuran 13
  sumLabel: { color: c.textMuted, fontSize: 13 },
  // nilai ringkasan: tebal, ukuran 13, warna gelap
  sumValue: { fontFamily: 'Inter_700Bold', fontSize: 13, color: c.text },
  // baris total: menyamping, tersebar, rata tengah, jarak atas 8
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  // label total: ukuran 15, tebal
  totalLabel: { fontSize: 15, fontFamily: 'Inter_800ExtraBold', color: c.text },
  // nilai total: ukuran 20, sangat tebal, warna biru utama
  totalValue: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: c.primary },
  // deretan pill metode: menyamping, jarak isi 8, boleh membungkus ke baris baru
  methodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  // pill metode: menyamping, rata tengah, jarak isi 6, latar chip, garis tepi krem, sudut 10
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  // teks pill metode: ukuran 11, tebal, warna kuning gelap
  methodChipText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.warn },
  // baris catatan keamanan: menyamping, rata tengah, jarak isi 5, jarak atas 12
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  // teks catatan keamanan: ukuran 11, warna abu
  secureText: { fontSize: 11, color: c.textMuted },
  // footer bawah: latar putih, garis atas, padding 16
  bottomBar: { padding: 16, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border },
  // baris total di footer: menyamping, tersebar, rata tengah, jarak bawah 12
  payTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  // label total di footer: ukuran 12, warna abu
  payLabel: { fontSize: 12, color: c.textMuted },
  // nilai total di footer: ukuran 20, tebal, warna biru utama
  payValue: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: c.primary },
  // tombol bayar: latar kuning aksen, sudut 16, tinggi 52, isi di tengah menyamping, jarak isi 8
  payBtn: {
    backgroundColor: c.accent, borderRadius: 16, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  // teks tombol bayar: warna cokelat gelap, tebal, ukuran 15
  payBtnText: { color: '#261A00', fontSize: 15, fontFamily: 'Inter_800ExtraBold' },
  // pembungkus isi layar status pembayaran web: isi rata tengah, padding 24
  payStatusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  // ikon lingkaran besar layar status: 72x72 bulat, latar biru muda, isi tengah
  payStatusIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  // judul layar status: ukuran 17, tebal, rata tengah, jarak atas 14
  payStatusTitle: { fontSize: 17, fontFamily: 'Inter_800ExtraBold', color: c.text, marginTop: 14, textAlign: 'center' },
  // keterangan layar status: ukuran 13, warna abu, rata tengah, jarak atas 6, tinggi baris 19
  payStatusDesc: { fontSize: 13, color: c.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  // hint popup diblokir: ukuran 12, tebal, warna kuning tua, rata tengah, jarak atas 10
  payStatusHint: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.warn, marginTop: 10, textAlign: 'center' },
  // tombol utama layar status: latar kuning aksen, sudut 16, tinggi 50, isi tengah menyamping, jarak atas 22
  payStatusBtn: {
    marginTop: 22, backgroundColor: c.accent, borderRadius: 16, height: 50, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  // teks tombol utama layar status: cokelat gelap, tebal, ukuran 14
  payStatusBtnText: { color: '#261A00', fontSize: 14, fontFamily: 'Inter_800ExtraBold' },
  // tombol sekunder layar status (ghost): padding 10, jarak atas 12
  payStatusGhost: { marginTop: 12, padding: 10 },
  // teks tombol sekunder layar status: biru utama, tebal, ukuran 13
  payStatusGhostText: { color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 13 },
  // header halaman WebView pembayaran
  webviewHeader: {
    // warna latar header
    backgroundColor: c.primary,
    // padding vertikal
    paddingVertical: 14,
    // padding horizontal
    paddingHorizontal: 16,
    // tombol Selesai rata kanan
    alignItems: 'flex-end',
  },
  // layar blokir untuk mode tamu
  blocked: {
    // flex 1 agar menutupi layar
    flex: 1,
    // isi rata tengah horizontal
    alignItems: 'center',
    // isi rata tengah vertikal
    justifyContent: 'center',
    // padding dalam layar blokir
    padding: 24,
  },
});
