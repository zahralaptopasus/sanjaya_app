// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React dan hook useEffect (untuk mengambil status pesanan saat layar dibuka)
import React, { useEffect, useMemo } from 'react';
// mengambil komponen bawaan React Native: View (kotak/div), Text (teks), ScrollView (area yang bisa digulir),
// TouchableOpacity (tombol), StyleSheet (pembuat style), Share (berbagi teks), Alert (dialog), ActivityIndicator (animasi loading),
// Platform (deteksi web/native) dan Linking (membuka URL pembayaran di perangkat native)
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
// mengambil fungsi rp (untuk mengubah angka menjadi format Rupiah)
import { rp } from '../lib/format';
// mengambil hook palet warna dinamis (Terang/Gelap) dan tipe paletnya
import { useColors } from '../store/preferences';
import type { Palette } from '../theme';
// mengambil data demo dan tipe CartItem dari models
import { demoProducts, type CartItem } from '../models';
// mengambil ikon Ionicons dari Expo
import { Ionicons } from '@expo/vector-icons';
// mengambil modul expo-print untuk membuat PDF dari HTML
import * as Print from 'expo-print';
// mengambil modul expo-sharing untuk membagikan file PDF
import * as Sharing from 'expo-sharing';
// mengambil fungsi status pesanan, metode pembayaran, URL pembayaran, pembatalan, dan daftar produk (untuk "Bayar Lagi") dari repo
import { getOrderStatus, getOrderPaymentMethod, getOrderSnapUrl, cancelOrder, getProducts } from '../repo';
// mengambil hook useCart (untuk menyiapkan ulang item saat "Bayar Lagi" langsung ke Checkout)
import { useCart } from '../store/cart';

// ===== TIPE DATA =====

// tipe untuk item dalam snapshot struk (produk + jumlah)
type SnapshotItem = { product: CartItem['product']; qty: number };

// ===== KONSTANTA =====

// biaya jasa pasang & tune up (service fee)
const SERVICE_FEE = 15000;

// ===== FUNGSI BANTUAN =====

// fungsi untuk mengamankan karakter khusus di HTML (escaping) agar aman saat generate PDF
function htmlEscape(s: string) {
  return s
    // mengganti & dengan &amp;
    .replace(/&/g, '&amp;')
    // mengganti < dengan &lt;
    .replace(/</g, '&lt;')
    // mengganti > dengan &gt;
    .replace(/>/g, '&gt;')
    // mengganti " dengan &quot;
    .replace(/"/g, '&quot;')
    // mengganti ' dengan &#39;
    .replace(/'/g, '&#39;');
}

// fungsi untuk membuat HTML struk (digunakan oleh expo-print untuk generate PDF)
function generateHTML(params: any) {
  // mengambil parameter yang dibutuhkan untuk generate struk
  const { items, name, phone, plat, orderId, paidAt, subtotal, discount, coupon, totalBayar, code, paymentMethod } = params;
  // membuat objek Date dari waktu pembayaran
  const date = new Date(paidAt);
  // membuat baris tabel untuk setiap item belanja
  const rows = items.map((e: SnapshotItem) => `
    <tr>
      <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(e.product.name)}</td>
      <td style="padding:6px; border-bottom:1px solid #eee; text-align:center;">${e.qty} x ${rp(e.product.price)}</td>
      <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${rp(e.product.price * e.qty)}</td>
    </tr>
  `).join('');
  // membuat baris untuk biaya jasa
  const svc = `<tr><td style="padding:6px; border-bottom:1px solid #eee;">Jasa Pasang & Tune Up</td><td style="padding:6px; border-bottom:1px solid #eee; text-align:center;">1 x ${rp(SERVICE_FEE)}</td><td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${rp(SERVICE_FEE)}</td></tr>`;
  // membuat baris diskon (hanya ditampilkan jika ada kupon)
  const discRow = coupon ? `<tr><td colspan="2" style="padding:6px; text-align:right; color:#785900;"><b>Diskon ${htmlEscape(coupon)}</b></td><td style="padding:6px; text-align:right; color:#785900;">-${rp(discount)}</td></tr>` : '';

  // mengembalikan template HTML lengkap untuk struk
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8" /><style>
    body{font-family:system-ui,sans-serif; margin:24px; color:#131B2E; font-size:11pt;}
    .header{text-align:center; margin-bottom:16px;}
    .header h1{margin:0; font-size:16pt; color:#0B3D91;}
    .header p{margin:2px 0; color:#434652; font-size:10pt;}
    table{width:100%; border-collapse:collapse; margin-top:12px;}
    th{text-align:left; padding:6px; border-bottom:2px solid #0B3D91; font-size:10pt; color:#434652;}
    .total-row{font-weight:bold; font-size:11pt;}
    .grand{font-size:14pt; color:#0B3D91; font-weight:900;}
    .footer{margin-top:24px; text-align:center; color:#434652; font-size:9pt;}
    .code-box{margin-top:16px; padding:12px; background:#F2F3FF; border-radius:8px; text-align:center;}
    .code{font-family:monospace; font-size:14pt; letter-spacing:2px; font-weight:800; color:#0B3D91;}
  </style></head>
  <body>
    <div class="header">
      <h1>SANJAYA</h1>
      <p>Santren Jaya Motor Workshop</p>
      <p>Jl. Santren No. 42, Sleman, DIY</p>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center;">Qty x Harga</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>
        ${rows}
        ${svc}
        ${discRow}
        <tr class="total-row"><td colspan="2" style="padding-top:10px;">Total Barang & Jasa</td><td style="text-align:right; padding-top:10px;">${rp(subtotal + SERVICE_FEE)}</td></tr>
        <tr class="total-row"><td colspan="2" style="padding-top:6px;">Total Bayar</td><td class="grand" style="text-align:right; padding-top:6px;">${rp(totalBayar)}</td></tr>
      </tbody>
    </table>
    <div class="code-box">
      <div>Kode Verifikasi</div>
      <div class="code">${htmlEscape(orderId)}</div>
      <div style="margin-top:4px; font-size:8pt;">Tunjukkan saat pengambilan unit</div>
    </div>
    <div class="footer">
      No. Transaksi: ${code}<br/>
      Waktu: ${String(date.getDate()).padStart(2,'0')} ${date.toLocaleString('id',{month:'short'})} ${date.getFullYear()}, ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')} WIB<br/>
      Metode: ${htmlEscape(String(paymentMethod ?? 'Midtrans (Online)'))}<br/>
      Pelanggan: ${htmlEscape(name)}${phone ? ` | ${htmlEscape(phone)}` : ''} | Plat: ${htmlEscape(plat)}<br/>
      Terima kasih telah berbelanja di Sanjaya Motor.
    </div>
  </body>
  </html>`;
}

// ===== KOMPONEN UTAMA =====

// komponen layar Struk (Receipt) untuk menampilkan bukti pembayaran
// menerima prop navigation dan route (untuk mengambil parameter dari CheckoutScreen atau OrdersScreen)
export default function ReceiptScreen({ navigation, route }: any) {
  // mengambil parameter yang dikirim dari halaman sebelumnya (fallback ke nilai default)
  const {
    // ID order (bisa berupa code atau db id)
    orderId = 'SJM-0000',
    // ID asli pesanan (UUID) dari database, dipakai untuk mengambil status asli (opsional)
    dbId,
    // waktu pembayaran dalam format ISO
    paidAt = new Date().toISOString(),
    // nama pemesan
    name = 'Ahmad Santoso',
    // nomor HP/WA (opsional)
    phone,
    // plat nomor kendaraan
    plat = 'AB 4821 YZ',
    // daftar item belanja
    items: paramItems,
    // kode kupon
    coupon: paramCoupon,
    // subtotal belanja
    subtotal: paramSubtotal,
    // diskon yang diterapkan
    discount: paramDiscount,
    // metode pembayaran yang dikirim dari Checkout / Riwayat ('midtrans' | 'cod')
    paymentMethod: paramPaymentMethod,
    // status awal (mis. COD 'pending') agar struk tidak sempat menampilkan status lain
    initialStatus,
  } = route?.params ?? {};

  // menyiapkan daftar item untuk struk; jika tidak ada parameter, pakai data demo
  const items: SnapshotItem[] =
    Array.isArray(paramItems) && paramItems.length > 0
      ? paramItems
      : [
          { product: demoProducts[0], qty: 2 },
          { product: demoProducts[1], qty: 1 },
          { product: demoProducts[2], qty: 2 },
        ];

  // membuat objek Date untuk tanggal/waktu struk
  const date = new Date(paidAt);
  // menghitung subtotal jika tidak diberikan via parameter
  const subtotal = typeof paramSubtotal === 'number' ? paramSubtotal : items.reduce((a, e) => a + e.product.price * e.qty, 0);
  // menentukan kode kupon (default SANJAYABERKAH jika tidak ada)
  const coupon: string | null = paramCoupon ?? 'SANJAYABERKAH';
  // menghitung diskon (default 10.000 jika pakai kupon SANJAYABERKAH)
  const discount = typeof paramDiscount === 'number' ? paramDiscount : coupon === 'SANJAYABERKAH' ? 10000 : 0;
  // menghitung total barang + jasa
  const totalBarang = subtotal + SERVICE_FEE;
  // menghitung total bayar (maksimal 0)
  const totalBayar = Math.max(0, totalBarang - discount);
  // membuat kode transaksi untuk struk (format #SJM-YYYYMMDD-XXXX)
  const code = `#SJM-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(orderId).slice(-4)}`;

  // state penanda apakah sedang proses print/share PDF
  const [printing, setPrinting] = React.useState(false);
  // state penanda sedang mengambil/membuka URL pembayaran (pesanan menunggu)
  const [opening, setOpening] = React.useState(false);
  // state penanda sedang membatalkan pesanan
  const [cancelling, setCancelling] = React.useState(false);
  // state penanda sedang menyiapkan "Bayar Lagi" (memuat produk & membuka Checkout)
  const [retrying, setRetrying] = React.useState(false);
  // state status asli pesanan dari database; null = belum dimuat / bukan order database
  // bila initialStatus dikirim (mis. COD pending), pakai nilai itu agar tampilan langsung tepat
  const [dbStatus, setDbStatus] = React.useState<string | null>(
    initialStatus ? String(initialStatus) : null,
  );
  // state metode pembayaran dari database; null = belum dimuat / bukan order database
  const [dbPaymentMethod, setDbPaymentMethod] = React.useState<string | null>(null);
  // mengambil objek keranjang belanja (untuk menyiapkan ulang item saat "Bayar Lagi")
  const cart = useCart();
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // penanda apakah orderId berbentuk UUID (berarti order asli di database, bukan kode fallback)
  // gunakan dbId bila tersedia (dikirim dari halaman riwayat pesanan), jika tidak pakai orderId
  const isRealOrder = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dbId ?? orderId));

  // effect: ambil status pesanan dari database; bila masih pending, pantau tiap 4 detik
  useEffect(() => {
    // hanya cari status bila order adalah order asli dari database
    if (!isRealOrder) return;
    // flag untuk mencegah setState setelah layar dibersihkan (unmount)
    let active = true;
    // fungsi untuk mengambil status lalu memperbarui state
    const fetchStatus = async () => {
      // ambil status terbaru dari database (RLS: hanya order milik user sendiri)
      const st = await getOrderStatus(String(dbId ?? orderId));
      // pastikan komponen masih aktif sebelum mengubah state
      if (!active) return;
      setDbStatus(st);
    };
    // panggil langsung saat pertama kali layar dibuka
    fetchStatus();
    // interval pemantauan agar status berubah otomatis saat pembayaran diverifikasi (pending -> paid)
    const timer = setInterval(fetchStatus, 4000);
    // bersihkan interval dan flag saat layar ditutup
    return () => { active = false; clearInterval(timer); };
  }, [isRealOrder, orderId, dbId]);

  // effect: ambil metode pembayaran dari database (untuk memastikan COD/Midtrans akurat
  // meskipun struk dibuka langsung dari Riwayat Pesanan)
  useEffect(() => {
    // hanya untuk order asli dari database
    if (!isRealOrder) return;
    // flag agar tidak setState setelah layar ditutup
    let active = true;
    getOrderPaymentMethod(String(dbId ?? orderId)).then((m) => {
      if (active) setDbPaymentMethod(m);
    });
    // bersihkan flag saat layar ditutup / order berubah
    return () => { active = false; };
  }, [isRealOrder, orderId, dbId]);

  // menentukan status tampilan struk berdasarkan status database
  // s berisi status DB (lowercase); jika tidak ada data, anggap sudah lunas (perilaku lama)
  const s = String(dbStatus ?? '').toLowerCase();
  // statusPaid: benar-benar lunas (atau data tidak tersedia)
  const statusPaid = dbStatus === null || s === 'paid' || s === 'settlement' || s === 'capture';
  // statusPending: menunggu pembayaran
  const statusPending = !statusPaid && s === 'pending';
  // statusFailed: gagal / batal / lainnya
  const statusFailed = !statusPaid && !statusPending;

  // metode pembayaran efektif: database > parameter > default Midtrans
  const paymentMethod: 'midtrans' | 'cod' =
    (dbPaymentMethod ?? paramPaymentMethod) === 'cod' ? 'cod' : 'midtrans';
  // apakah pesanan memakai tunai di tempat
  const isCod = paymentMethod === 'cod';
  // label metode pembayaran untuk tampilan & PDF
  const methodLabel = isCod ? 'Tunai di Tempat (COD)' : 'Midtrans (Online)';
  // COD yang masih menunggu pembayaran tunai
  const codPending = isCod && statusPending;

  // fungsi untuk membuat dan membagikan PDF struk via expo-print & expo-sharing
  const handlePrint = async () => {
    // menandakan sedang mencetak
    setPrinting(true);
    try {
      // generate HTML untuk struk
      const html = generateHTML({ items, name, phone, plat, orderId, paidAt, subtotal, discount, coupon, totalBayar, code, paymentMethod: methodLabel });
      // di web: expo-print tidak bisa membuat file PDF → buka dialog print browser
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          w.print();
        }
        return;
      }
      // mencetak HTML menjadi file PDF
      const { uri } = await Print.printToFileAsync({ html });
      // membagikan/simpan file PDF
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Simpan / Cetak Struk' });
    } catch (e) {
      // jika gagal, tampilkan error ke console dan alert
      console.error(e);
      Alert.alert('Gagal', 'Tidak bisa membuat PDF struk.');
    } finally {
      // menghentikan indikator loading
      setPrinting(false);
    }
  };

  // fungsi untuk membagikan struk dalam bentuk teks
  const handleShareText = async () => {
    // menyusun isi teks struk
    const txt = `STRUK PEMBAYARAN\nSANJAYA Motor\nNo: ${code}\nTanggal: ${date.toLocaleString('id')}\nMetode: ${methodLabel}\nNama: ${name}\n${phone ? 'HP: ' + phone + '\n' : ''}Plat: ${plat}\n\n${items.map(e => `${e.product.name} x${e.qty} = ${rp(e.product.price * e.qty)}`).join('\n')}\nJasa Pasang = ${rp(SERVICE_FEE)}\n${coupon ? `Diskon ${coupon} = -${rp(discount)}\n` : ''}Total Bayar = ${rp(totalBayar)}\nKode: ${orderId}\nTerima kasih!`;
    try { await Share.share({ message: txt, title: 'Struk Pembayaran' }); } catch {}
  };

  // fungsi untuk membuka kembali halaman pembayaran Midtrans (khusus pesanan menunggu)
  const handleOpenPayment = async () => {
    // tandai sedang memproses
    setOpening(true);
    try {
      // ambil URL pembayaran tersimpan dari database (pakai dbId bila ada)
      const url = await getOrderSnapUrl(String(dbId ?? orderId));
      // bila URL belum tersedia (mis. order lama), beri tahu pengguna
      if (!url) {
        Alert.alert('Belum tersedia', 'Halaman pembayaran belum tersedia untuk pesanan ini.');
        return;
      }
      // web: buka tab browser baru; native: buka browser eksternal
      if (Platform.OS === 'web') window.open(url, '_blank');
      else await Linking.openURL(url);
    } finally {
      // selesai memproses
      setOpening(false);
    }
  };

  // fungsi untuk membatalkan pesanan yang masih menunggu (stok dikembalikan oleh server)
  const handleCancel = async () => {
    // tandai sedang memproses
    setCancelling(true);
    // panggil server untuk membatalkan pesanan
    const ok = await cancelOrder(String(dbId ?? orderId));
    // selesai memproses
    setCancelling(false);
    // perbarui status tampilan bila berhasil
    if (ok) setDbStatus('cancelled');
    else Alert.alert('Gagal', 'Tidak bisa membatalkan pesanan ini.');
  };

  // fungsi "Bayar Lagi" (saat pesanan gagal): siapkan ulang item lalu langsung buka Checkout
  const handleRetry = async () => {
    // tandai sedang memproses
    setRetrying(true);
    try {
      // ambil daftar produk terkini (harga & stok terbaru)
      const products = await getProducts();
      // buat peta id -> produk agar pencarian cepat
      const byId = new Map(products.map((p) => [p.id, p]));
      // kosongkan keranjang agar berisi ulang item pesanan ini saja
      cart.clear();
      // hitung item yang berhasil dimasukkan
      let added = 0;
      // telusuri tiap item struk; cocokkan berdasarkan id produk
      items.forEach((e) => {
        const p = byId.get(e.product.id);
        // hanya tambahkan bila produk masih dijual
        if (p) { cart.add(p, e.qty); added += 1; }
      });
      // jika tidak ada yang bisa ditambahkan, beri tahu pengguna
      if (added === 0) {
        Alert.alert('Produk tidak tersedia', 'Produk pada pesanan ini sudah tidak dijual lagi.');
        return;
      }
      // langsung buka layar Checkout (bukan keranjang)
      navigation.navigate('Checkout');
    } finally {
      // selesai memproses
      setRetrying(false);
    }
  };

  // return tampilan struk pembayaran
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      {/* bagian header status pembayaran (disesuaikan status asli dari database) */}
      <View style={{ alignItems: 'center' }}>
        {/* lingkaran luar; warna mengikuti status */}
        <View style={[styles.circle, { backgroundColor: statusFailed ? c.dangerSoft : statusPending ? c.accent + '33' : c.accent + '22' }]}>
          {/* lingkaran dalam; warna mengikuti status */}
          <View style={[styles.check, { backgroundColor: statusFailed ? c.danger + '33' : statusPending ? c.accent + '66' : c.primarySoft }]}>
            {/* ikon sesuai status: silang (gagal), jam pasir (menunggu), centang (berhasil) */}
            <Ionicons
              name={statusFailed ? 'close' : codPending ? 'cash-outline' : statusPending ? 'hourglass-outline' : 'checkmark'}
              size={30}
              color={statusFailed ? c.danger : statusPending ? c.warn : c.warn}
            />
          </View>
        </View>
        {/* judul sesuai status */}
        <Text style={{ fontSize: 22, fontFamily: 'Inter_800ExtraBold',  color: c.text, marginTop: 8 }}>
          {statusFailed ? 'Pembayaran Gagal' : codPending ? 'Pesanan Dibuat' : statusPending ? 'Menunggu Pembayaran' : 'Pembayaran Berhasil!'}
        </Text>
        {/* keterangan sesuai status */}
        <Text style={{ textAlign: 'center', color: c.textMuted, fontSize: 13, marginTop: 4 }}>
          {statusFailed
            ? 'Pembayaran tidak selesai. Silakan cek Riwayat Pesanan atau ulangi pemesanan.'
            : codPending
            ? 'Silakan bayar tunai saat pengambilan unit motor. Status otomatis menjadi LUNAS setelah admin mengonfirmasi — cek Riwayat Pesanan.'
            : statusPending
            ? 'Pembayaran sedang diverifikasi. Status otomatis menjadi Lunas setelah dikonfirmasi — cek Riwayat Pesanan.'
            : 'Terima kasih, pesanan Anda telah diverifikasi oleh tim Sanjaya Motor.'}
        </Text>
      </View>

      {/* kartu struk */}
      <View style={styles.card}>
        {/* garis header berwarna biru utama */}
        <View style={styles.headerBar} />
        <View style={{ padding: 16 }}>
          {/* baris header toko + status LUNAS */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {/* informasi toko */}
            <View>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_800ExtraBold',  color: c.primary }}>SANJAYA</Text>
              <Text style={{ fontSize: 12, color: c.textMuted }}>Santren Jaya Motor Workshop</Text>
              <Text style={{ fontSize: 11, color: c.textMuted }}>Jl. Santren No. 42, Sleman, DIY</Text>
            </View>
            {/* badge status: LUNAS / MENUNGGU / GAGAL sesuai status database */}
            <View style={statusFailed ? styles.badgeFailed : statusPending ? styles.badgePending : styles.lunas}>
              <Text style={statusFailed ? styles.badgeFailedText : statusPending ? styles.badgePendingText : styles.lunasText}>
                {statusFailed ? 'GAGAL' : codPending ? 'BAYAR DI TEMPAT' : statusPending ? 'MENUNGGU' : 'LUNAS'}
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>No. Transaksi</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_800ExtraBold',  color: c.text }}>{code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Waktu Transaksi</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold',  color: c.text }}>
                {`${String(date.getDate()).padStart(2, '0')} ${date.toLocaleString('id', { month: 'short' })} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} WIB`}
              </Text>
            </View>
          </View>

          <View style={[styles.row, { backgroundColor: c.primarySoft }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_800ExtraBold',  fontSize: 13, color: c.text }}>{name}</Text>
              {phone ? <Text style={{ fontSize: 12, color: c.textMuted }}>{phone}</Text> : null}
            </View>
            <View style={styles.plat}><Text style={{ fontSize: 11, fontFamily: 'Inter_800ExtraBold',  color: c.primary }}>{plat}</Text></View>
          </View>

          <View style={[styles.lineRow, { marginTop: 16 }]}>
            <Text style={styles.section}>Rincian Komponen & Jasa</Text>
            <Text style={styles.section}>Subtotal</Text>
          </View>

          {items.map((e, i) => (
            <View key={i} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{e.product.name}</Text>
                <Text style={styles.itemSub}>{e.qty} x {rp(e.product.price)}</Text>
              </View>
              <Text style={styles.itemPrice}>{rp(e.product.price * e.qty)}</Text>
            </View>
          ))}

          <View style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>Jasa Pasang & Tune Up Berkala</Text>
              <Text style={styles.itemSub}>Standar Mekanik Sanjaya</Text>
            </View>
            <Text style={styles.itemPrice}>{rp(SERVICE_FEE)}</Text>
          </View>

          {coupon ? (
            <View style={styles.couponBox}>
              <Text style={{ fontFamily: 'Inter_800ExtraBold',  fontSize: 12, color: c.warn }}>{coupon}</Text>
              <Text style={{ fontSize: 11, color: c.textMuted }}>Voucher Spesial Member</Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontFamily: 'Inter_800ExtraBold',  color: c.warn }}>-{rp(discount)}</Text>
            </View>
          ) : null}

          <View style={[styles.lineRow, { marginTop: 16 }]}>
            <Text style={styles.section}>Ringkasan</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={{ fontSize: 13, color: c.textMuted }}>Metode Pembayaran</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', color: isCod ? c.warn : c.primary }}>{methodLabel}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={{ fontSize: 13, color: c.textMuted }}>Total Nilai Barang & Jasa</Text>
            <Text style={{ fontFamily: 'Inter_600SemiBold'}}>{rp(totalBarang)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.lineRow}>
              <Text style={{ fontSize: 13, color: c.warn }}>Diskon Kupon Pelanggan</Text>
              <Text style={{ fontFamily: 'Inter_700Bold',  color: c.warn }}>-{rp(discount)}</Text>
            </View>
          ) : null}
          <View style={[styles.lineRow, { marginTop: 8 }]}>
            <View>
              <Text style={{ fontFamily: 'Inter_800ExtraBold',  fontSize: 14, color: c.text }}>Total Bayar</Text>
              <Text style={{ fontSize: 11, color: c.textMuted }}>{methodLabel}</Text>
            </View>
            <Text style={{ fontSize: 22, fontFamily: 'Inter_900Black',  color: c.primary }}>{rp(totalBayar)}</Text>
          </View>

          {/* kode verifikasi kasir hanya ditampilkan untuk pesanan yang sudah lunas */}
          {statusPaid ? (
            <View style={styles.qrBox}>
              <Text style={{ fontFamily: 'Inter_800ExtraBold',  fontSize: 13, color: c.text }}>Kode Verifikasi Kasir / Mekanik</Text>
              <Text style={{ textAlign: 'center', fontSize: 11, color: c.textMuted, marginTop: 2 }}>Tunjukkan kode ini saat pengambilan unit motor</Text>
              <Text style={{ fontSize: 34, marginTop: 12 }}>▦▦▦</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_800ExtraBold',  letterSpacing: 1, marginTop: 8 }}>{orderId}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* tombol cetak/bagikan hanya muncul untuk pesanan lunas */}
      {statusPaid ? (
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btnSecondary, { marginRight: 8 }]} onPress={handleShareText}>
            <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold'}}>Bagikan (Teks)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handlePrint} disabled={printing}>
            {printing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold'}}>Cetak / Simpan PDF</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* tombol bayar lagi khusus saat pesanan gagal → langsung ke Checkout */}
      {statusFailed ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleRetry} disabled={retrying}>
            {retrying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold'}}>Coba Bayar Lagi</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* tombol lanjutkan pembayaran + batalkan khusus saat pesanan masih menunggu */}
      {statusPending ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          {/* COD: tidak ada halaman Midtrans — tampilkan instruksi bayar tunai */}
          {isCod ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accent + '22', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Ionicons name="cash-outline" size={18} color={c.warn} />
              <Text style={{ color: c.warn, fontSize: 12, fontFamily: 'Inter_700Bold', flexShrink: 1 }}>
                Bayar tunai di toko saat pengambilan unit.
              </Text>
            </View>
          ) : (
            /* tombol membuka halaman pembayaran Midtrans */
            <TouchableOpacity style={styles.btnPrimary} onPress={handleOpenPayment} disabled={opening}>
              {opening
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold'}}>Buka Halaman Pembayaran</Text>}
            </TouchableOpacity>
          )}
          {/* tombol membatalkan pesanan menunggu */}
          <TouchableOpacity
            style={{ marginTop: 10, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.danger }}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator color={c.danger} size="small" />
              : <Text style={{ color: c.danger, fontFamily: 'Inter_700Bold' }}>Batalkan Pesanan</Text>}
          </TouchableOpacity>
        </View>
      ) : null}


      <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.popToTop()}>
        <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold'}}>← Kembali ke Beranda</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// StyleSheet.create membuat kumpulan style untuk ReceiptScreen
// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // container ScrollView
  container: {
    // jarak dalam kontainer
    padding: 16,
  },
  // lingkaran luar status sukses
  circle: {
    // ukuran lingkaran
    width: 80,
    height: 80,
    // sudut membulat penuh
    borderRadius: 40,
    // isi rata tengah horizontal
    alignItems: 'center',
    // isi rata tengah vertikal
    justifyContent: 'center',
  },
  // lingkaran dalam status sukses
  check: {
    // ukuran lingkaran
    width: 60,
    height: 60,
    // sudut membulat penuh
    borderRadius: 30,
    // isi rata tengah
    alignItems: 'center',
    justifyContent: 'center',
  },
  // kartu struk utama
  card: {
    // warna latar kartu
    backgroundColor: c.card,
    // sudut membulat 16
    borderRadius: 16,
    // jarak atas kartu
    marginTop: 16,
    // overflow hidden untuk sudut membulat
    overflow: 'hidden',
  },
  // garis header kartu
  headerBar: {
    // tinggi garis
    height: 8,
    // warna garis
    backgroundColor: c.primary,
  },
  // badge status LUNAS
  lunas: {
    // warna latar
    backgroundColor: c.primarySoft,
    // sudut membulat 8
    borderRadius: 8,
    // padding horizontal
    paddingHorizontal: 12,
    // padding vertikal
    paddingVertical: 6,
    // rata kiri atas
    alignSelf: 'flex-start',
  },
  // teks badge LUNAS
  lunasText: {
    // font tebal sangat
    fontFamily: 'Inter_900Black',
    // ukuran font
    fontSize: 12,
    // warna teks
    color: c.warn,
    // jarak antar huruf
    letterSpacing: 1,
  },
  // badge status MENUNGGU (latar kuning lembut)
  badgePending: {
    backgroundColor: c.accent + '33',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  // teks badge MENUNGGU
  badgePendingText: {
    fontFamily: 'Inter_900Black',
    fontSize: 12,
    color: c.warn,
    letterSpacing: 1,
  },
  // badge status GAGAL (latar merah muda)
  badgeFailed: {
    backgroundColor: c.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  // teks badge GAGAL
  badgeFailedText: {
    fontFamily: 'Inter_900Black',
    fontSize: 12,
    color: c.danger,
    letterSpacing: 1,
  },
  // label info transaksi
  label: {
    // ukuran font
    fontSize: 11,
    // warna teks
    color: c.textMuted,
    // jarak bawah
    marginBottom: 2,
  },
  // grid info transaksi (No. Transaksi & Waktu)
  infoGrid: {
    // warna latar
    backgroundColor: c.input,
    // sudut membulat 12
    borderRadius: 12,
    // jarak dalam
    padding: 12,
    // arah flex horizontal
    flexDirection: 'row',
    // jarak atas
    marginTop: 12,
    // jarak antar kolom
    gap: 12,
  },
  // baris info pelanggan
  row: {
    // sudut membulat 12
    borderRadius: 12,
    // jarak dalam
    padding: 12,
    // arah flex
    flexDirection: 'row',
    // jarak atas
    marginTop: 10,
    // rata tengah vertikal
    alignItems: 'center',
  },
  // badge plat nomor
  plat: {
    // warna latar
    backgroundColor: c.primarySoft,
    // sudut membulat 6
    borderRadius: 6,
    // padding horizontal
    paddingHorizontal: 8,
    // padding vertikal
    paddingVertical: 6,
  },
  // judul seksi (Rincian, Ringkasan)
  section: {
    // ukuran font
    fontSize: 11,
    // font tebal
    fontFamily: 'Inter_800ExtraBold',
    // warna teks
    color: c.textMuted,
  },
  // baris rincian item (label dan nilai)
  lineRow: {
    // arah flex horizontal
    flexDirection: 'row',
    // jarak kiri-kanan
    justifyContent: 'space-between',
    // jarak atas
    marginTop: 10,
  },
  // nama item
  itemName: {
    // font tebal
    fontFamily: 'Inter_700Bold',
    // ukuran font
    fontSize: 13,
    // warna teks
    color: c.text,
  },
  // sub info item (qty x harga)
  itemSub: {
    // ukuran font
    fontSize: 12,
    // warna teks
    color: c.textMuted,
    // jarak atas
    marginTop: 2,
  },
  // harga item
  itemPrice: {
    // font tebal
    fontFamily: 'Inter_800ExtraBold',
    // ukuran font
    fontSize: 13,
    // warna teks
    color: c.text,
  },
  // box kupon
  couponBox: {
    // warna latar
    backgroundColor: c.input,
    // sudut membulat 8
    borderRadius: 8,
    // jarak dalam
    padding: 8,
    // arah flex
    flexDirection: 'row',
    // rata tengah vertikal
    alignItems: 'center',
    // jarak atas
    marginTop: 12,
  },
  // box kode verifikasi
  qrBox: {
    // warna latar
    backgroundColor: c.input,
    // sudut membulat 12
    borderRadius: 12,
    // jarak dalam
    padding: 16,
    // isi rata tengah horizontal
    alignItems: 'center',
    // jarak atas
    marginTop: 16,
  },
  // baris tombol
  btnRow: {
    // arah flex
    flexDirection: 'row',
    // jarak atas
    marginTop: 16,
    // isi rata tengah
    justifyContent: 'center',
  },
  // tombol utama (Cetak/Simpan PDF)
  btnPrimary: {
    // warna latar
    backgroundColor: c.primary,
    // sudut membulat 12
    borderRadius: 12,
    // padding vertikal
    paddingVertical: 12,
    // padding horizontal
    paddingHorizontal: 24,
    // isi rata tengah
    alignItems: 'center',
    // lebar minimum
    minWidth: 160,
  },
  // tombol sekunder (Bagikan Teks)
  btnSecondary: {
    // warna latar
    backgroundColor: c.card,
    // garis tepi
    borderWidth: 1,
    // warna garis tepi
    borderColor: c.primary,
    // sudut membulat 12
    borderRadius: 12,
    // padding vertikal
    paddingVertical: 12,
    // padding horizontal
    paddingHorizontal: 24,
    // isi rata tengah
    alignItems: 'center',
    // lebar minimum
    minWidth: 130,
  },
  // tombol kembali ke beranda
  homeBtn: {
    // isi rata tengah horizontal
    alignItems: 'center',
    // jarak atas
    marginTop: 16,
    // jarak bawah
    marginBottom: 32,
    // jarak dalam
    padding: 12,
  },
});
