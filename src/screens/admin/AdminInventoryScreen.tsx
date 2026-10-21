// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// mengambil React, hook useEffect (efek samping saat layar dibuka), useState (data yang bisa berubah), dan useMemo (komputasi efisien)
import React, { useCallback, useEffect, useMemo, useState } from "react";
// mengambil komponen bawaan React Native:
// View (kotak/div), Text (teks), ScrollView (area yang bisa digulir), StyleSheet (pembuat style),
// TextInput (kolom ketik), TouchableOpacity (tombol yang bisa ditekan), Alert (popup pesan),
// ActivityIndicator (animasi loading), RefreshControl (tarik layar untuk refresh), Image (gambar)
// Modal (popup dari bawah), FlatList (daftar efisien), KeyboardAvoidingView (hindari keyboard), Platform (deteksi OS)
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
// mengambil kumpulan ikon Ionicons dari Expo
import { Ionicons } from "@expo/vector-icons";
// mengambil fungsi adminGetProducts, adminAddProduct, adminUpdateProduct, adminDeleteProduct, adminUploadImage dari lib/admin
import {
  adminGetProducts,
  adminAddProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUploadImage,
  isLowStock
  ,
} from "../../lib/admin";
// mengambil fungsi rp untuk mengubah angka menjadi format Rupiah (contoh: Rp 85.000)
import { rp } from "../../lib/format";
// mengambil tipe data Product (bentuk/struktur data produk) dari models
import type { Product } from "../../models";
// mengambil variabel warna dari file theme supaya warna konsisten di seluruh aplikasi
import {
  navy,
  surface,
  cardBg,
  chipBg,
  muted,
  ink,
  bronze,
  amber,
} from "../../theme";
// mengambil ImagePicker dari expo-image-picker untuk kamera dan galeri
import * as ImagePicker from "expo-image-picker";
// mengambil hook kategori shared
import { useCategories } from "../../context/CategoriesContext";
import { useLowStock } from "../../context/LowStockContext";

// ===== KOMPONEN UTAMA =====

// membuat komponen layar Inventaris Admin; "export default" artinya bisa diimpor di file lain
export default function AdminInventoryScreen() {
  // state "products" menyimpan daftar produk dari server; awalnya array kosong
  const [products, setProducts] = useState<Product[]>([]);
  // state penanda data pertama kali sedang dimuat; awalnya true (sedang memuat)
  const [loading, setLoading] = useState(true);
  // state penanda layar sedang di-refresh (tarik ke bawah); awalnya false
  const [refreshing, setRefreshing] = useState(false);
  // state form (digunakan di modal tambah/edit)
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  // category ID yang dipilih (bukan index)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stock, setStock] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [location, setLocation] = useState("Gudang Utama");
  const [imageUri, setImageUri] = useState<string | null>(null);

  // state penanda proses penyimpanan sedang berjalan; awalnya false
  const [saving, setSaving] = useState(false);
  // state penanda upload gambar sedang berjalan
  const [uploadingImage, setUploadingImage] = useState(false);
  // state modal tambah/edit
  const [modalOpen, setModalOpen] = useState(false);
  // mode modal: 'add' atau 'edit'
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  // ID produk yang sedang diedit (hanya dipakai saat modalMode === 'edit')
  const [editProductId, setEditProductId] = useState<string | null>(null);
  // state pencarian & filter daftar
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Semua");

  const [lowOnly, setLowOnly] = useState(false);

  const { refresh: refreshLowStock } = useLowStock();

  // shared categories dari context
  const { activeCategories } = useCategories();

  // produk yang sudah difilter (search + kategori)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = catFilter === "Semua" || p.category === catFilter;
      const okSearch =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q);
      const okLow = !lowOnly || isLowStock(p.stock);
      return okCat && okSearch && okLow;
    });
  }, [products, search, catFilter, lowOnly]);

  // fungsi "load" untuk mengambil daftar produk; async artinya boleh menunggu (await)
  // useCallback menjaga "load" tetap sama antar render (refreshLowStock juga stabil)
  const load = useCallback(async () => {
    // memanggil adminGetProducts lalu menunggu hasilnya, disimpan di variabel p
    const p = await adminGetProducts();
    // menyimpan hasil ke state products sehingga tampilan otomatis diperbarui
    setProducts(p);
    // mengubah loading menjadi false karena data sudah dimuat
    setLoading(false);
    // mengubah refreshing menjadi false karena proses refresh selesai
    setRefreshing(false);
    void refreshLowStock();
  }, [refreshLowStock]);

  // useEffect menjalankan load() sekali saat layar pertama kali muncul
  // dibungkus async IIFE agar setState tidak terjadi sinkron di dalam efek
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // fungsi untuk membuka modal tambah
  const openAdd = () => {
    // reset form ke kondisi awal
    setCode("");
    setName("");
    setType("");
    setSelectedCategoryId(activeCategories[0]?.id ?? "");
    setPrice("");
    setPurchasePrice("");
    setStock("");
    setInitialStock("");
    setUnit("pcs");
    setLocation("Gudang Utama");
    setImageUri(null);
    setModalMode("add");
    setModalOpen(true);
  };

  // fungsi untuk buka modal edit dengan data produk
  const openEdit = (product: Product) => {
    setCode(product.code);
    // parse nama: jika format "Jenis - Nama", pisahkan
    const nameParts = product.name.split(" - ");
    if (nameParts.length > 1) {
      setType(nameParts[0]);
      setName(nameParts.slice(1).join(" - "));
    } else {
      setType("");
      setName(product.name);
    }
    // set category ID dari produk
    setSelectedCategoryId(product.category);
    setPrice(String(product.price));
    setPurchasePrice(String(product.purchasePrice ?? 0));
    setStock(String(product.stock));
    setInitialStock(String(product.initialStock ?? 0));
    setUnit(product.unit ?? "pcs");
    setLocation(product.location ?? "Gudang Utama");
    setImageUri(product.image || null);
    setEditProductId(product.id);
    setModalMode("edit");
    setModalOpen(true);
  };

  // fungsi tutup modal & reset form
  const closeModal = () => {
    setModalOpen(false);
    setEditProductId(null);
    setCode("");
    setName("");
    setType("");
    setSelectedCategoryId(activeCategories[0]?.id ?? "");
    setPrice("");
    setPurchasePrice("");
    setStock("");
    setInitialStock("");
    setUnit("pcs");
    setLocation("Gudang Utama");
    setImageUri(null);
  };

  // fungsi untuk membuka image picker (kamera atau galeri)
  const pickImage = async (source: "camera" | "gallery") => {
    // minta izin akses kamera/galeri
    let permissionResult;
    if (source === "camera") {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (!permissionResult.granted) {
      Alert.alert(
        "Izin ditolak",
        `Aplikasi butuh akses ${source === "camera" ? "kamera" : "galeri"} untuk memilih gambar.`,
      );
      return;
    }

    // buka picker
    let result;
    if (source === "camera") {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  // fungsi untuk menghapus gambar yang sudah dipilih
  const clearImage = () => setImageUri(null);

  // fungsi "save" untuk menyimpan barang baru atau update existing
  const save = async () => {
    // jika kode atau nama kosong (setelah spasi dihapus), tampilkan peringatan dan hentikan fungsi
    if (!code.trim() || !name.trim()) {
      Alert.alert("Lengkapi dulu", "Kode barang dan nama barang wajib diisi.");
      return;
    }
    // mengubah teks harga menjadi angka dan menyimpannya di p
    const p = Number(price);
    const pp = Number(purchasePrice);
    // mengubah teks stok menjadi angka dan menyimpannya di s
    const s = Number(stock);
    const is = Number(initialStock);
    // jika harga bukan angka valid atau <= 0, tampilkan peringatan dan hentikan fungsi
    if (isNaN(p) || p <= 0) {
      Alert.alert("Harga salah", "Masukkan harga lebih dari 0.");
      return;
    }
    // jika harga beli bukan angka valid atau < 0
    if (isNaN(pp) || pp < 0) {
      Alert.alert("Harga beli salah", "Masukkan harga beli 0 atau lebih.");
      return;
    }
    // jika stok bukan angka valid atau < 0, tampilkan peringatan dan hentikan fungsi
    if (isNaN(s) || s < 0) {
      Alert.alert("Stok salah", "Masukkan stok 0 atau lebih.");
      return;
    }
    // jika stok awal bukan angka valid atau < 0
    if (isNaN(is) || is < 0) {
      Alert.alert("Stok awal salah", "Masukkan stok awal 0 atau lebih.");
      return;
    }

    // menandai bahwa proses simpan sedang berjalan
    setSaving(true);

    // blok try: jalankan kode yang mungkin gagal
    try {
      let finalImageUrl: string | null | undefined = imageUri;

      // jika ada gambar lokal (dari image picker), upload ke Supabase Storage dulu
      if (imageUri && !imageUri.startsWith("http")) {
        setUploadingImage(true);
        try {
          finalImageUrl = await adminUploadImage(imageUri);
        } catch (uploadErr: any) {
          throw new Error(uploadErr?.message ?? "Gagal upload gambar");
        } finally {
          setUploadingImage(false);
        }
      } else if (imageUri && imageUri.startsWith("http")) {
        // gambar sudah URL (existing), biarkan apa adanya
        finalImageUrl = imageUri;
      } else {
        // tidak ada gambar
        finalImageUrl = null;
      }

      const productData = {
        code: code.trim().toUpperCase(),
        name: type.trim() ? `${type.trim()} - ${name.trim()}` : name.trim(),
        category: selectedCategoryId,
        unit: unit.trim(),
        price: Math.trunc(p),
        purchasePrice: Math.trunc(pp),
        stock: Math.trunc(s),
        initialStock: Math.trunc(is),
        location: location.trim() || "Gudang Utama",
        image: finalImageUrl,
      };

      if (modalMode === "edit" && editProductId) {
        // mode edit: update produk existing
        await adminUpdateProduct(editProductId, productData);
      } else {
        // mode tambah: insert produk baru
        await adminAddProduct(productData);
      }

      // memuat ulang daftar produk agar perubahan tampil
      load();

      // notifikasi berhasil
      Alert.alert(
        "Berhasil",
        modalMode === "edit"
          ? "Barang berhasil diupdate."
          : "Barang berhasil ditambah.",
        [{ text: "OK" }],
      );

      // tutup modal & reset form
      closeModal();
      // blok catch: dijalankan jika terjadi error pada try
    } catch (e: any) {
      // bedakan error upload vs database
      const isUploadError =
        e?.message?.includes("upload") || e?.message?.includes("Storage");
      Alert.alert(
        "Gagal",
        isUploadError
          ? `Upload gambar gagal: ${e?.message ?? "Unknown error"}`
          : modalMode === "edit"
            ? `Update gagal: ${e?.message ?? "Unknown error"}`
            : `Tambah gagal: ${e?.message ?? "Unknown error"}`,
      );
      // blok finally: selalu dijalankan baik sukses maupun gagal
    } finally {
      // mengakhiri status menyimpan
      setSaving(false);
    }
  };

  // fungsi hapus produk
  const doDelete = async (productId: string) => {
    try {
      await adminDeleteProduct(productId);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa hapus barang.");
    }
  };

  const handleDelete = (productId: string, productName: string) => {
    const msg = `Yakin hapus "${productName}"? Tindakan ini tidak bisa dibatalkan.`;
    // di web, Alert.alert tidak menampilkan tombol -> pakai confirm bawaan browser
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doDelete(productId);
      return;
    }
    Alert.alert("Hapus Barang", msg, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => doDelete(productId),
      },
    ]);
  };

  // jika masih loading, tampilkan animasi loading saja dan hentikan fungsi di sini
  if (loading)
    return (
      <ActivityIndicator
        size="large"
        color={navy}
        style={{ flex: 1, justifyContent: "center" }}
      />
    );

  // return = isi tampilan yang akan digambar di layar
  return (
    <>
      {/* ScrollView = area yang bisa digulir ke bawah */}
      <ScrollView
        style={{ backgroundColor: surface }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={navy}
          />
        }
      >
        {/* judul halaman */}
        <Text style={styles.header}>Inventaris Barang</Text>
        {/* teks keterangan kecil di bawah judul */}
        <Text style={styles.sub}>Tambah & kelola stok sparepart</Text>

        {/* tombol tambah barang - buka modal */}
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={18} color="#261A00" />
          <Text style={styles.addBtnText}>Tambah Barang</Text>
        </TouchableOpacity>

        {/* header daftar: search + filter kategori */}
        <View style={styles.listHeader}>
          {/* search bar */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama atau kode barang..."
              placeholderTextColor={muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={muted} />
              </TouchableOpacity>
            )}
          </View>
          {/* chip kategori horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterChipRow}
            contentContainerStyle={{ gap: 8 }}
          >
            <TouchableOpacity
              style={[styles.filterChip, catFilter === "Semua" && styles.filterChipActive]}
              onPress={() => setCatFilter("Semua")}
            >
              <Text style={[styles.filterChipText, catFilter === "Semua" && styles.filterChipTextActive]}>
                Semua
              </Text>
            </TouchableOpacity>
            {activeCategories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterChip, catFilter === c.id && styles.filterChipActive]}
                onPress={() => setCatFilter(c.id)}
              >
                <Text style={[styles.filterChipText, catFilter === c.id && styles.filterChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.filterChip, styles.lowChip, lowOnly && styles.lowChipActive]}
              onPress={() => setLowOnly((v) => !v)}
            >
              <Ionicons name="alert-circle" size={13} color={lowOnly ? "#fff" : "#BA1A1A"} />
              <Text style={[styles.filterChipText, lowOnly && styles.filterChipTextActive]}>
                Stok Minim
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* judul daftar inventaris beserta jumlah produk (filtered.length) */}
        <Text style={styles.listTitle}>
          Data Inventaris ({filtered.length})
        </Text>
        {/* daftar produk pakai FlatList untuk performa */}
        {filtered.length === 0 ? (
          <Text style={styles.empty}>Belum ada barang. Tambah di atas.</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>Barang tidak ditemukan.</Text>
            }
            renderItem={({ item: p }) => (
              <View key={p.id} style={styles.row}>
                {/* badge kecil di kiri menampilkan 2 huruf/angka terakhir dari kode produk */}
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{p.code.slice(-2)}</Text>
                </View>
                {/* wadah informasi produk yang mengisi ruang tersisa (flex:1) */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => openEdit(p)}
                  activeOpacity={0.8}
                >
                  {/* menampilkan kategori produk */}
                  <Text style={styles.rowCat}>
                    {activeCategories.find((c) => c.id === p.category)?.label ??
                      p.category}
                  </Text>
                  {/* menampilkan nama produk maksimal 2 baris */}
                  <Text style={styles.rowName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  {/* menampilkan kode produk lengkap */}
                  <Text style={styles.rowCode}>{p.code}</Text>
{/* baris metadata: harga, satuan, lokasi, stok */}
                    <View style={styles.rowMeta}>
                      {/* harga dalam format Rupiah */}
                      <Text style={styles.rowPrice}>{rp(p.price)}</Text>
                      {/* satuan */}
                      {p.unit && <Text style={styles.rowUnit}>{p.unit}</Text>}
                      {/* lokasi */}
                      {p.location && <Text style={styles.rowLocation}>{p.location}</Text>}
                      {/* stok; jika stok rendah (isLowStock) tampilkan badge peringatan */}
                      {isLowStock(p.stock) ? (
                        <View style={styles.lowBadge}>
                          <Ionicons name="alert-circle" size={12} color="#BA1A1A" />
                          <Text style={styles.lowText}>Sisa {p.stock}</Text>
                        </View>
                      ) : (
                        <Text style={styles.rowStock}>{p.stock} {p.unit ?? "unit"}</Text>
                      )}
                    </View>
                </TouchableOpacity>
                <View style={styles.actionGroup}>
                  {/* Tombol Edit */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEdit(p)}
                  >
                    <Ionicons name="create-outline" size={20} color="#1877F2" />
                  </TouchableOpacity>

                  {/* Tombol Hapus */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(p.id, p.name)}
                  >
                    <Ionicons name="trash" size={20} color="#BA1A1A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT BARANG ===== */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* overlay gelap - tap untuk tutup */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeModal}
          />
          {/* sheet putih di bawah */}
          <View style={styles.modalSheet}>
            {/* header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === "edit" ? "Edit Barang" : "Tambah Barang"}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            {/* Preview gambar produk */}
            {imageUri ? (
              <View style={styles.modalImagePreview}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.modalPreviewImage}
                />
                {imageUri.startsWith("http") && (
                  <View style={styles.modalExistingPhotoBadge}>
                    <Text style={styles.modalExistingPhotoText}>
                      Foto saat ini
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.modalRemoveImageBtn}
                  onPress={clearImage}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Tombol pilih gambar (kamera/galeri) */}
            <View style={styles.modalImagePickerRow}>
              <TouchableOpacity
                style={styles.modalImagePickerBtn}
                onPress={() => pickImage("gallery")}
              >
                <Ionicons name="image" size={18} color={navy} />
                <Text style={styles.modalImagePickerText}>
                  Pilih dari Galeri
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalImagePickerBtn}
                onPress={() => pickImage("camera")}
              >
                <Ionicons name="camera" size={18} color={navy} />
                <Text style={styles.modalImagePickerText}>Ambil Foto</Text>
              </TouchableOpacity>
            </View>

            {imageUri && (
              <Text style={styles.modalImageHint}>
                Gambar akan diupload saat simpan. Tap (x) untuk hapus.
              </Text>
            )}

            {/* input kode barang */}
            <TextInput
              style={styles.modalInput}
              placeholder="Kode barang, mis. SP-OLI-07"
              placeholderTextColor={muted}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              editable={modalMode === "add"}
            />
            {/* input nama sparepart */}
            <TextInput
              style={styles.modalInput}
              placeholder="Nama sparepart"
              placeholderTextColor={muted}
              value={name}
              onChangeText={setName}
            />
            {/* input jenis/pilihan barang (opsional) */}
            <TextInput
              style={styles.modalInput}
              placeholder="Jenis / pilihan barang (opsional)"
              placeholderTextColor={muted}
              value={type}
              onChangeText={setType}
            />
            {/* kategori - chip row horizontal */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.modalChipRow}
              contentContainerStyle={{ gap: 8 }}
            >
              {activeCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.modalChip,
                    selectedCategoryId === c.id && styles.modalChipActive,
                  ]}
                  onPress={() => setSelectedCategoryId(c.id)}
                >
                  <Text
                    style={[
                      styles.modalChipText,
                      selectedCategoryId === c.id && styles.modalChipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* baris satuan & harga beli */}
            <View style={styles.modalDuo}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Satuan (pcs, box, liter, dll)"
                placeholderTextColor={muted}
                value={unit}
                onChangeText={setUnit}
                autoCapitalize="none"
              />
              <View style={{ width: 10 }} />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Harga Beli (Rp)"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={purchasePrice}
                onChangeText={setPurchasePrice}
              />
            </View>
            {/* baris lokasi & stok awal */}
            <View style={styles.modalDuo}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Lokasi simpan"
                placeholderTextColor={muted}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="words"
              />
              <View style={{ width: 10 }} />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Stok Awal (ref)"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={initialStock}
                onChangeText={setInitialStock}
              />
            </View>
            {/* baris harga dan stok */}
            <View style={styles.modalDuo}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Harga Jual (Rp)"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={price}
                onChangeText={setPrice}
              />
              <View style={{ width: 10 }} />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Stok Saat Ini"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={stock}
                onChangeText={setStock}
              />
            </View>

            {/* actions: Batal + Simpan */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeModal}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={save}
                disabled={saving || uploadingImage}
              >
                <Ionicons
                  name={
                    saving || uploadingImage
                      ? "hourglass"
                      : modalMode === "edit"
                        ? "save"
                        : "add"
                  }
                  size={16}
                  color="#261A00"
                />
                <Text style={styles.modalSaveText}>
                  {uploadingImage
                    ? "Upload gambar..."
                    : saving
                      ? "Menyimpan..."
                      : modalMode === "edit"
                        ? "Update Barang"
                        : "Tambah Barang"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ===== STYLE (pengaturan tampilan) =====

// StyleSheet.create membuat kumpulan style yang dipanggil dengan nama, contoh styles.header
const styles = StyleSheet.create({
  // Wadah untuk tombol edit & hapus agar sejajar mendatar
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  // Style tombol Edit (Latar belakang biru muda)
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E8F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Style tombol Hapus (Latar belakang merah muda)
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  // judul halaman: ukuran 20, font Poppins tebal, warna ink
  header: { fontSize: 20, fontFamily: "Poppins_800ExtraBold", color: ink },
  // keterangan di bawah judul: ukuran 12, warna abu, jarak atas 2, jarak bawah 14
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 14 },
  // tombol tambah barang: latar amber, sudut 10, padding 12, row center, gap 8, margin bawah 12
  addBtn: {
    backgroundColor: amber,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: "Inter_800ExtraBold",
    color: "#261A00",
  },
  // header daftar: search + chips, margin bawah 12
  listHeader: { marginBottom: 12 },
  // search box: row, center, gap 8, putih, border abu, radius 12, padding horizontal 12, margin bawah 10
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: ink },
  // chip kategori filter horizontal
  filterChipRow: { flexGrow: 0, marginBottom: 8 },
  filterChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipActive: { backgroundColor: navy, borderColor: navy },
  filterChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  filterChipTextActive: { color: "#fff" },
  // judul daftar: ukuran 15, font Poppins tebal, warna ink, jarak bawah 10
  listTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: ink,
    marginBottom: 10,
  },
  // pesan kosong: teks di tengah, warna abu, jarak atas 20, ukuran 13
  empty: { textAlign: "center", color: muted, marginTop: 20, fontSize: 13 },
  // baris produk: menyamping, jarak elemen 10, latar cardBg, sudut 14, padding 12, jarak bawah 8, garis tepi krem
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  // badge kode: ukuran 38x38, sudut 10, latar chipBg, isi di tengah horizontal & vertikal
  codeBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  // teks badge kode: ukuran 11, font tebal, warna bronze
  codeText: { fontSize: 11, fontFamily: "Inter_800ExtraBold", color: bronze },
  // kategori produk: ukuran 10, font tebal, warna bronze, jarak antar huruf 0.4
  rowCat: {
    fontSize: 10,
    fontFamily: "Inter_800ExtraBold",
    color: bronze,
    letterSpacing: 0.4,
  },
  // nama produk: ukuran 13, font tebal, warna ink, jarak atas 2
  rowName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ink,
    marginTop: 2,
  },
  // kode produk: ukuran 10, warna abu, jarak atas 1, font angka rata (tabular-nums)
  rowCode: {
    fontSize: 10,
    color: muted,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  // baris metadata: menyamping, rata tengah vertikal, jarak elemen 10, jarak atas 4
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  // harga produk: ukuran 13, font tebal, warna navy
  rowPrice: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy },
  // stok produk: ukuran 11, warna abu
  rowStock: { fontSize: 11, color: muted },
  // satuan produk: ukuran 10, warna bronze
  rowUnit: { fontSize: 10, fontFamily: "Inter_700Bold", color: bronze },
  // lokasi produk: ukuran 10, warna muted
  rowLocation: { fontSize: 10, color: muted },
  // style tambahan saat stok rendah: warna bronze, font tebal
  lowChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  lowChipActive: { backgroundColor: "#BA1A1A", borderColor: "#BA1A1A" },
  lowBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFEBEB", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  lowText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#BA1A1A" },

  // ===== MODAL STYLES =====
  // overlay gelap full screen, justifyContent flex-end untuk slide up
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  // sheet putih: tinggi 85%, radius atas 24, latar surface, padding 16
  modalSheet: {
    height: "85%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  // header modal: row, space-between, center, margin bawah 16
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: ink },
  // preview gambar di modal
  modalImagePreview: {
    position: "relative",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: chipBg,
  },
  modalPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  modalRemoveImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalExistingPhotoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalExistingPhotoText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  // baris tombol image picker: 2 kolom
  modalImagePickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  modalImagePickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  modalImagePickerText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: navy,
  },
  modalImageHint: {
    fontSize: 11,
    color: muted,
    marginBottom: 8,
    fontStyle: "italic",
  },
  // input di modal
  modalInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: ink,
    marginBottom: 8,
  },
  // chip kategori di modal horizontal
  modalChipRow: { flexGrow: 0, marginBottom: 8 },
  modalChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modalChipActive: { backgroundColor: navy, borderColor: navy },
  modalChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  modalChipTextActive: { color: "#fff" },
  // row harga stok
  modalDuo: { flexDirection: "row" },
  // actions footer
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5DFD1",
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    color: navy,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  modalSaveText: {
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    color: "#261A00",
  },
});
