// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// React + hook: useState (state), useEffect (muat data user), useMemo (gaya dinamis)
import React, { useEffect, useMemo, useState } from 'react';
// komponen React Native: teks, kotak, tombol, input, gambar, dsb.
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
// ikon Ionicons
import { Ionicons } from '@expo/vector-icons';
// ImagePicker untuk memilih foto dari galeri
import * as ImagePicker from 'expo-image-picker';
// Supabase untuk membaca data user
import { supabase } from '../lib/supabase';
// fungsi akun: ubah profil, ganti sandi, unggah/hapus foto, kelola username
import {
  updateProfile, changePassword, uploadAvatar, removeAvatar,
  setMyUsername, normalizeUsername, usernameError,
} from '../lib/account';
// palet warna dinamis (Terang/Gelap) & font dari theme
import { useColors } from '../store/preferences';
import { F, type Palette } from '../theme';
// komponen loader halaman (spinner di tengah)
import PageLoader from '../components/PageLoader';

// ===== KOMPONEN FIELD (input berlabel, dipakai berulang) =====

// satu kolom input: label di atas, kotak input di bawah
function Field({ label, value, onChangeText, placeholder, keyboardType, secure, editable = true }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secure?: boolean;
  editable?: boolean;
}) {
  // palet warna aktif + gaya (dihitung ulang saat tema berganti)
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={{ marginBottom: 14 }}>
      {/* label kolom */}
      <Text style={styles.label}>{label}</Text>
      {/* kotak input */}
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        editable={editable}
        autoCapitalize="none"
      />
    </View>
  );
}

// ===== LAYAR EDIT PROFIL =====

// layar untuk mengubah nama, nomor HP, foto, dan kata sandi
export default function EditProfileScreen({ navigation }: any) {
  // state field profil
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // url foto profil yang tersimpan
  const [avatar, setAvatar] = useState<string | null>(null);
  // gambar baru yang baru dipilih (belum diunggah)
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // penanda memuat data awal
  const [loading, setLoading] = useState(true);
  // penanda proses simpan berjalan
  const [saving, setSaving] = useState(false);

  // state form ganti sandi
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  // penanda proses ganti sandi berjalan
  const [changingPw, setChangingPw] = useState(false);
  // palet warna aktif + gaya yang dihitung ulang saat tema berganti
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // effect: ambil data user saat layar dibuka
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (u) {
        const meta = (u.user_metadata ?? {}) as any;
        setName(meta.full_name ?? '');
        setPhone(meta.phone ?? '');
        setEmail(u.email ?? '');
        setAvatar(meta.avatar_url ?? null);
        // username tersimpan di tabel profiles, bukan di metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', u.id)
          .maybeSingle();
        setUsername(((profile as any)?.username as string | undefined) ?? '');
      }
      setLoading(false);
    })();
  }, []);

  // notifikasi kecil (web pakai window.alert, native pakai Alert)
  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  // memilih foto dari galeri
  const pickPhoto = async () => {
    // minta izin (di web otomatis diizc.textan)
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Izin diperlukan', 'Izc.textan akses galeri untuk mengganti foto.');
      return;
    }
    // buka galeri; di native minta base64 agar bisa diunggah
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: Platform.OS !== 'web',
    });
    // simpan gambar bila tidak dibatalkan
    if (!result.canceled && result.assets.length > 0) setPicked(result.assets[0]);
  };

  // menyimpan perubahan profil (username + foto + nama + HP)
  const saveProfile = async () => {
    if (!name.trim()) { notify('Belum lengkap', 'Nama wajib diisi.'); return; }
    // validasi format username sebelum menyimpan apa pun
    const uname = normalizeUsername(username);
    const uErr = usernameError(uname);
    if (uErr) { notify('Username tidak valid', uErr); return; }

    setSaving(true);
    try {
      // simpan username lebih dulu; database juga mengecek apakah sudah dipakai
      const unameRes = await setMyUsername(uname);
      if (!unameRes.ok) {
        notify('Gagal menyimpan username', unameRes.error ?? 'Coba lagi.');
        return;
      }
      // unggah foto dulu bila ada yang baru dipilih
      if (picked) {
        const up = await uploadAvatar({
          uri: picked.uri,
          base64: (picked as any).base64 ?? null,
          mimeType: picked.mimeType ?? null,
          file: (picked as any).file ?? null,
        });
        if (!up.ok) { notify('Gagal unggah foto', up.error ?? 'Coba lagi.'); return; }
        setAvatar(up.url ?? null);
        setPicked(null);
      }
      // simpan nama & nomor HP ke metadata akun
      const res = await updateProfile({ full_name: name.trim(), phone: phone.trim() });
      if (!res.ok) { notify('Gagal menyimpan', res.error ?? 'Coba lagi.'); return; }
      notify('Tersimpan', 'Profil berhasil diperbarui.');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  // menghapus foto profil
  const deletePhoto = async () => {
    // aksi hapus sesungguhnya
    const doDelete = async () => {
      const res = await removeAvatar();
      if (res.ok) { setAvatar(null); setPicked(null); }
      else notify('Gagal menghapus', res.error ?? 'Coba lagi.');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Hapus foto profil?')) await doDelete();
      return;
    }
    Alert.alert('Hapus Foto', 'Hapus foto profil?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  };

  // menyimpan kata sandi baru
  const submitPassword = async () => {
    if (!pwOld || !pwNew || !pwConfirm) { notify('Belum lengkap', 'Isi semua kolom kata sandi.'); return; }
    if (pwNew.length < 6) { notify('Terlalu pendek', 'Kata sandi baru minimal 6 karakter.'); return; }
    if (pwNew !== pwConfirm) { notify('Tidak sama', 'Konfirmasi kata sandi tidak cocok.'); return; }
    setChangingPw(true);
    try {
      const res = await changePassword(pwOld, pwNew);
      if (!res.ok) { notify('Gagal mengganti', res.error ?? 'Coba lagi.'); return; }
      setPwOld(''); setPwNew(''); setPwConfirm('');
      notify('Berhasil', 'Kata sandi berhasil diganti.');
    } finally {
      setChangingPw(false);
    }
  };

  // tampilkan loader di tengah halaman saat data awal masih dimuat
  if (loading) {
    return <PageLoader />;
  }

  return (
    // KeyboardAvoidingView agar input tidak tertutup keyboard (iOS)
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ===== FOTO PROFIL ===== */}
        <View style={styles.avatarBox}>
          {/* pratinjau: gambar baru > gambar tersimpan > gambar bawaan */}
          <Image
            source={picked ? { uri: picked.uri } : avatar ? { uri: avatar } : require('../../assets/images/profile.png')}
            style={styles.avatar}
          />
          {/* tombol ganti & hapus foto */}
          <View style={styles.avatarBtns}>
            <TouchableOpacity style={styles.smallBtn} onPress={pickPhoto}>
              <Ionicons name="images-outline" size={16} color={c.primary} />
              <Text style={styles.smallBtnText}>Ganti Foto</Text>
            </TouchableOpacity>
            {(avatar || picked) ? (
              <TouchableOpacity style={styles.smallBtn} onPress={deletePhoto}>
                <Ionicons name="trash-outline" size={16} color={c.danger} />
                <Text style={[styles.smallBtnText, { color: c.danger }]}>Hapus</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ===== FORM PROFIL ===== */}
        <Text style={styles.section}>Informasi Profil</Text>
        <View style={styles.card}>
          <Field label="Nama lengkap" value={name} onChangeText={setName} placeholder="Nama kamu" />
          <Field label="Username (untuk login)" value={username} onChangeText={setUsername} placeholder="contoh: budi.santoso" />
          <Field label="Nomor HP" value={phone} onChangeText={setPhone} placeholder="08xxxxxxxxxx" keyboardType="phone-pad" />
          <Field label="Email (tidak dapat diubah)" value={email} onChangeText={() => {}} editable={false} />
        </View>
        <TouchableOpacity style={[styles.primary, saving && { opacity: 0.7 }]} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Simpan Perubahan</Text>}
        </TouchableOpacity>

        {/* ===== FORM GANTI SANDI ===== */}
        <Text style={styles.section}>Ubah Kata Sandi</Text>
        <View style={styles.card}>
          <Field label="Kata sandi lama" value={pwOld} onChangeText={setPwOld} placeholder="••••••" secure />
          <Field label="Kata sandi baru" value={pwNew} onChangeText={setPwNew} placeholder="Minimal 6 karakter" secure />
          <Field label="Konfirmasi kata sandi baru" value={pwConfirm} onChangeText={setPwConfirm} placeholder="Ulangi kata sandi baru" secure />
        </View>
        <TouchableOpacity style={[styles.primary, changingPw && { opacity: 0.7 }]} onPress={submitPassword} disabled={changingPw}>
          {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Simpan Kata Sandi</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ===== STYLE =====

// makeStyles = pembuat style berdasarkan palet warna aktif
const makeStyles = (c: Palette) => StyleSheet.create({
  // wadah layar
  container: { flex: 1, backgroundColor: c.bg },
  // area konten yang bisa digulir
  content: { padding: 16, paddingBottom: 40 },
  // kotak foto profil (rata tengah)
  avatarBox: { alignItems: 'center', marginTop: 6, marginBottom: 8 },
  // gambar avatar bulat
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primarySoft },
  // baris tombol di bawah avatar
  avatarBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  // tombol kecil (ganti/hapus foto)
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  // teks tombol kecil
  smallBtnText: { fontSize: 13, fontFamily: F.semibold, color: c.primary },
  // judul bagian
  section: { fontSize: 12, fontFamily: F.bold, color: c.textMuted, letterSpacing: 1, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  // kartu putih pembungkus field
  card: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16 },
  // label field
  label: { fontSize: 12, fontFamily: F.semibold, color: c.textMuted, marginBottom: 6 },
  // kotak input
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: F.regular, color: c.text, backgroundColor: c.input },
  // input nonaktif (email)
  inputDisabled: { backgroundColor: c.bgAlt, color: c.textMuted },
  // tombol utama biru
  primary: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  // teks tombol utama
  primaryText: { color: '#fff', fontFamily: F.bold, fontSize: 15 },
  // layar loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
});
