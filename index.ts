import 'react-native-gesture-handler';
import { Alert, Platform, type AlertButton } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// ===== WEB: Alert.alert tidak berfungsi di react-native-web =====
// Di react-native-web, Alert.alert hanyalah fungsi kosong (no-op), sehingga
// dialog konfirmasi (hapus barang, logout, batalkan pesanan) tidak muncul di browser.
// Shim di bawah memakai window.alert / window.confirm agar semua pemanggilan
// Alert.alert yang sudah ada tetap bekerja saat aplikasi dijalankan di web.
if (Platform.OS === 'web') {
  const webAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    // gabungkan judul & pesan menjadi satu teks
    const body = [title, message].filter(Boolean).join('\n\n');
    // tanpa tombol kustom → cukup tampilkan alert biasa
    if (!buttons || buttons.length === 0) {
      window.alert(body);
      return;
    }
    // pisahkan tombol batal dan tombol aksi utama
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    const actionButton =
      buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
    // hanya 1 tombol / tidak ada tombol batal → tampilkan alert lalu jalankan aksi
    if (buttons.length === 1 || !cancelButton) {
      window.alert(body);
      actionButton?.onPress?.();
      return;
    }
    // 2 tombol atau lebih → gunakan confirm browser
    if (window.confirm(body)) actionButton?.onPress?.();
    else cancelButton.onPress?.();
  };

  // timpa implementasi Alert.alert bawaan react-native-web
  Alert.alert = webAlert as unknown as typeof Alert.alert;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
