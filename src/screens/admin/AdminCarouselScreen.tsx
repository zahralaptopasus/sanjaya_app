// ===== IMPORT =====
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Image, Modal, FlatList,
  KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCarousel } from "../../context/CarouselContext";
import { COMMON_ICONS } from "../../lib/categories";
import { adminUploadImage } from "../../lib/admin";
import { navy, surface, cardBg, chipBg, muted, ink, amber } from "../../theme";

// ===== TYPE =====
type Slide = {
  id: string;
  badge: string | null;
  title: string;
  subtitle: string | null;
  icon: string | null;
  image_url: string | null;
  action_type: "shop" | "products" | "coupon" | "url";
  action_value: string | null;
  button_label: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// pilihan aksi slide
const ACTION_TYPES: { value: Slide["action_type"]; label: string }[] = [
  { value: "shop", label: "Belanja" },
  { value: "products", label: "Produk" },
  { value: "coupon", label: "Kupon" },
  { value: "url", label: "Link" },
];

// ===== KOMPONEN UTAMA =====
export default function AdminCarouselScreen() {
  const { slides, loading, refresh, create, update, remove, reorder } = useCarousel();
  const [refreshing, setRefreshing] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editSlide, setEditSlide] = useState<Slide | null>(null);

  // form state
  const [badge, setBadge] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [icon, setIcon] = useState<string>(COMMON_ICONS[0]);
  const [actionType, setActionType] = useState<Slide["action_type"]>("shop");
  const [actionValue, setActionValue] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Belanja");
  const [order, setOrder] = useState(99);
  const [isActive, setIsActive] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // load slides (admin) on mount
  useEffect(() => {
    void (async () => {
      await refresh(true);
    })();
  }, [refresh]);

  // pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };

  // buka modal tambah
  const openAdd = () => {
    setBadge("");
    setTitle("");
    setSubtitle("");
    setIcon(COMMON_ICONS[0]);
    setActionType("shop");
    setActionValue("");
    setButtonLabel("Belanja");
    setOrder(slides.length > 0 ? Math.max(...slides.map(s => s.order)) + 1 : 1);
    setIsActive(true);
    setImageUri(null);
    setModalMode("add");
    setEditSlide(null);
    setModalOpen(true);
  };

  // buka modal edit
  const openEdit = (s: Slide) => {
    setBadge(s.badge ?? "");
    setTitle(s.title);
    setSubtitle(s.subtitle ?? "");
    setIcon(s.icon ?? COMMON_ICONS[0]);
    setActionType(s.action_type);
    setActionValue(s.action_value ?? "");
    setButtonLabel(s.button_label);
    setOrder(s.order);
    setIsActive(s.is_active);
    setImageUri(s.image_url);
    setModalMode("edit");
    setEditSlide(s);
    setModalOpen(true);
  };

  // tutup modal & reset form
  const closeModal = () => {
    setModalOpen(false);
    setEditSlide(null);
    setBadge("");
    setTitle("");
    setSubtitle("");
    setIcon(COMMON_ICONS[0]);
    setActionType("shop");
    setActionValue("");
    setButtonLabel("Belanja");
    setOrder(99);
    setIsActive(true);
    setImageUri(null);
  };

  // buka image picker (kamera / galeri)
  const pickImage = async (source: "camera" | "gallery") => {
    let permissionResult;
    if (source === "camera") {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (!permissionResult.granted) {
      Alert.alert(
        "Izin ditolak",
        `Aplikasi butuh akses ${source === "camera" ? "kamera" : "galeri"} untuk memilih gambar.`,
      );
      return;
    }

    let result;
    if (source === "camera") {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const clearImage = () => setImageUri(null);

  // simpan (create / update)
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Judul wajib diisi");
      return;
    }
    setSaving(true);
    try {
      let finalImage: string | null = null;
      if (imageUri && !imageUri.startsWith("http")) {
        setUploadingImage(true);
        try {
          finalImage = await adminUploadImage(imageUri);
        } finally {
          setUploadingImage(false);
        }
      } else if (imageUri && imageUri.startsWith("http")) {
        finalImage = imageUri;
      }

      const data = {
        badge: badge.trim() || null,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        icon,
        action_type: actionType,
        action_value: actionValue.trim() || null,
        button_label: buttonLabel.trim() || "Lihat",
        order,
        is_active: isActive,
        image_url: finalImage,
      };

      if (modalMode === "edit" && editSlide) {
        await update(editSlide.id, data);
      } else {
        await create(data);
      }
      closeModal();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa simpan slide");
    } finally {
      setSaving(false);
    }
  };

  // hapus slide
  const doDelete = async (s: Slide) => {
    try {
      await remove(s.id);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa hapus slide");
    }
  };

  const handleDelete = (s: Slide) => {
    const msg = `Yakin hapus slide "${s.title.split("\n")[0]}"? Tindakan ini tidak bisa dibatalkan.`;
    // di web, Alert.alert tidak menampilkan tombol -> pakai confirm bawaan browser
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doDelete(s);
      return;
    }
    Alert.alert("Hapus Slide", msg, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => doDelete(s) },
    ]);
  };

  // pindah urutan ke atas
  const moveUp = async (s: Slide, index: number) => {
    if (index === 0) return;
    const prev = slides[index - 1];
    try {
      await reorder([
        { id: s.id, order: prev.order },
        { id: prev.id, order: s.order },
      ]);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa pindah urutan");
    }
  };

  // pindah urutan ke bawah
  const moveDown = async (s: Slide, index: number) => {
    if (index === slides.length - 1) return;
    const next = slides[index + 1];
    try {
      await reorder([
        { id: s.id, order: next.order },
        { id: next.id, order: s.order },
      ]);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa pindah urutan");
    }
  };

  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: surface }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={navy} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Slide Beranda</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sub}>Atur banner yang muncul di halaman toko. Tarik ke bawah untuk refresh.</Text>

        {/* List slide */}
        {slides.length === 0 ? (
          <Text style={styles.empty}>Belum ada slide. Tambah di atas.</Text>
        ) : (
          <FlatList
            data={slides}
            keyExtractor={s => s.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.empty}>Belum ada slide.</Text>}
            renderItem={({ item: s, index }) => (
              <View style={styles.row}>
                {/* Thumbnail / ikon */}
                <View style={styles.thumb}>
                  {s.image_url ? (
                    <Image source={{ uri: s.image_url }} style={styles.thumbImg} />
                  ) : (
                    <Ionicons name={(s.icon ?? "image") as any} size={24} color={s.is_active ? navy : muted} />
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, !s.is_active && styles.rowTitleInactive]} numberOfLines={1}>
                    {s.title.replace("\n", " ")}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {ACTION_TYPES.find(a => a.value === s.action_type)?.label ?? s.action_type} • Urutan: {s.order} • {s.is_active ? "Aktif" : "Nonaktif"}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  <Switch
                    value={s.is_active}
                    onValueChange={() => update(s.id, { is_active: !s.is_active })}
                    thumbColor={s.is_active ? "#261A00" : "#fff"}
                    trackColor={{ false: "#FFEBEB", true: amber }}
                  />
                  <TouchableOpacity style={styles.actionBtn} onPress={() => moveUp(s, index)} disabled={index === 0}>
                    <Ionicons name="chevron-up" size={20} color={index === 0 ? muted : navy} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => moveDown(s, index)} disabled={index === slides.length - 1}>
                    <Ionicons name="chevron-down" size={20} color={index === slides.length - 1 ? muted : navy} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(s)}>
                    <Ionicons name="create" size={20} color={navy} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(s)}>
                    <Ionicons name="trash" size={20} color="#BA1A1A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT SLIDE ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === "edit" ? "Edit Slide" : "Tambah Slide"}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {/* Preview gambar */}
              {imageUri ? (
                <View style={styles.preview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImg} />
                  <TouchableOpacity style={styles.previewRemove} onPress={clearImage}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Tombol gambar (opsional) */}
              <View style={styles.imagePickerRow}>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage("gallery")}>
                  <Ionicons name="image" size={18} color={navy} />
                  <Text style={styles.imagePickerText}>Pilih dari Galeri</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage("camera")}>
                  <Ionicons name="camera" size={18} color={navy} />
                  <Text style={styles.imagePickerText}>Ambil Foto</Text>
                </TouchableOpacity>
              </View>

              {/* Badge */}
              <Text style={styles.sectionLabel}>Badge (opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="contoh: SANJAYABERKAH"
                placeholderTextColor={muted}
                value={badge}
                onChangeText={setBadge}
                autoCapitalize="characters"
              />

              {/* Judul */}
              <Text style={styles.sectionLabel}>Judul</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Judul slide (boleh baris baru)"
                placeholderTextColor={muted}
                value={title}
                onChangeText={setTitle}
                multiline
              />

              {/* Subjudul */}
              <Text style={styles.sectionLabel}>Subjudul (opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="contoh: pakai sekarang"
                placeholderTextColor={muted}
                value={subtitle}
                onChangeText={setSubtitle}
              />

              {/* Icon picker */}
              <Text style={styles.sectionLabel}>Ikon</Text>
              <View style={styles.iconGrid}>
                {(COMMON_ICONS as readonly string[]).map((ic: string) => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, icon === ic && styles.iconOptionActive]}
                    onPress={() => setIcon(ic)}
                  >
                    <Ionicons name={ic as any} size={22} color={icon === ic ? "#fff" : navy} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Aksi */}
              <Text style={styles.sectionLabel}>Aksi Tombol</Text>
              <View style={styles.chipRow}>
                {ACTION_TYPES.map(a => (
                  <TouchableOpacity
                    key={a.value}
                    style={[styles.chip, actionType === a.value && styles.chipActive]}
                    onPress={() => setActionType(a.value)}
                  >
                    <Text style={[styles.chipText, actionType === a.value && styles.chipTextActive]}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nilai aksi (hanya untuk kupon / link) */}
              {(actionType === "coupon" || actionType === "url") && (
                <>
                  <Text style={styles.sectionLabel}>
                    {actionType === "coupon" ? "Kode Kupon" : "URL Tujuan"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={actionType === "coupon" ? "contoh: SANJAYABERKAH" : "https://..."}
                    placeholderTextColor={muted}
                    value={actionValue}
                    onChangeText={setActionValue}
                    autoCapitalize="none"
                    keyboardType={actionType === "url" ? "url" : "default"}
                  />
                </>
              )}

              {/* Label tombol */}
              <Text style={styles.sectionLabel}>Label Tombol</Text>
              <TextInput
                style={styles.input}
                placeholder="contoh: Belanja"
                placeholderTextColor={muted}
                value={buttonLabel}
                onChangeText={setButtonLabel}
              />

              {/* Urutan */}
              <Text style={styles.sectionLabel}>Urutan</Text>
              <TextInput
                style={styles.input}
                placeholder="Urutan (angka)"
                placeholderTextColor={muted}
                value={String(order)}
                onChangeText={t => setOrder(Math.trunc(Number(t)) || 99)}
                keyboardType="number-pad"
              />

              {/* Active toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Aktif</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  thumbColor="#261A00"
                  trackColor={{ false: "#FFEBEB", true: amber }}
                />
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={saving || uploadingImage}>
                <Text style={styles.modalSaveText}>
                  {uploadingImage ? "Upload gambar..." : saving ? "Menyimpan..." : modalMode === "edit" ? "Update" : "Tambah"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  header: { fontSize: 20, fontFamily: "Poppins_800ExtraBold", color: ink },
  sub: { fontSize: 12, color: muted, marginBottom: 16 },
  empty: { textAlign: "center", color: muted, marginTop: 40, fontSize: 13 },
  addBtn: { backgroundColor: amber, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#261A00" },

  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: cardBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5DFD1" },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: chipBg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  rowTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: ink },
  rowTitleInactive: { textDecorationLine: "line-through", color: muted },
  rowMeta: { fontSize: 11, color: muted, marginTop: 2 },

  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D8D2C4", alignItems: "center", justifyContent: "center" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { height: "88%", backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: ink },

  modalForm: { flex: 1, marginBottom: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D8D2C4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 12 },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  sectionLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: ink, marginBottom: 6 },

  // preview gambar
  preview: { position: "relative", height: 150, borderRadius: 12, overflow: "hidden", marginBottom: 12, backgroundColor: chipBg },
  previewImg: { width: "100%", height: "100%", resizeMode: "cover" },
  previewRemove: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  imagePickerRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  imagePickerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderWidth: 1, borderColor: "#D8D2C4", borderRadius: 10, backgroundColor: "#fff" },
  imagePickerText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: navy },

  // icon picker
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  iconOption: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D8D2C4", alignItems: "center", justifyContent: "center" },
  iconOptionActive: { backgroundColor: navy, borderColor: navy },

  // chip aksi
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: "#D8D2C4", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff" },
  chipActive: { backgroundColor: navy, borderColor: navy },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  chipTextActive: { color: "#fff" },

  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  switchLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: ink },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5DFD1" },
  modalCancelBtn: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: amber, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalSaveText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#261A00" },
});
