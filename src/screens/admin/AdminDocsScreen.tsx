// ===== IMPORT =====
import React, { useEffect, useMemo, useState } from "react";
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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { navy, surface, cardBg, chipBg, muted, ink, bronze, amber } from "../../theme";

// ===== TIPE DATA =====
type Doc = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

// ===== DAFTAR LAPORAN =====
// Setiap laporan terdaftar sebagai screen di App.tsx (AdminStack)
const REPORT_LINKS = [
  { label: "Inventory", route: "ReportsInventory", icon: "cube-outline" },
  { label: "Purchase Order", route: "ReportsPO", icon: "cart-outline" },
  { label: "Mutasi Stok", route: "ReportsStockMovement", icon: "swap-horizontal-outline" },
  { label: "Penjualan", route: "ReportsSales", icon: "cash-outline" },
  { label: "Faktur", route: "ReportsInvoices", icon: "receipt-outline" },
  { label: "Pengiriman", route: "ReportsShipping", icon: "car-outline" },
] as const;

// ===== KOMPONEN UTAMA =====
export default function AdminDocsScreen() {
  const navigation = useNavigation<any>();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // modal tambah/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // ambil daftar dokumen (urut terbaru)
  const load = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    // dibungkus IIFE async agar setState terjadi di callback (bukan body effect)
    void (async () => {
      await load();
    })();
  }, []);

  // dokumen hasil pencarian (nama / keterangan)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q),
    );
  }, [docs, search]);

  // buka modal tambah
  const openAdd = () => {
    setMode("add");
    setEditDoc(null);
    setName("");
    setDesc("");
    setModalOpen(true);
  };

  // buka modal edit dengan data dokumen
  const openEdit = (d: Doc) => {
    setMode("edit");
    setEditDoc(d);
    setName(d.name);
    setDesc(d.description ?? "");
    setModalOpen(true);
  };

  // tutup modal & reset
  const closeModal = () => {
    setModalOpen(false);
    setEditDoc(null);
    setName("");
    setDesc("");
  };

  // simpan (tambah / update)
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let error;
      if (mode === "edit" && editDoc) {
        ({ error } = await supabase
          .from("documents")
          .update({ name: name.trim(), description: desc.trim() || null })
          .eq("id", editDoc.id));
      } else {
        ({ error } = await supabase
          .from("documents")
          .insert({
            name: name.trim(),
            description: desc.trim() || null,
            created_at: new Date().toISOString(),
          }));
      }
      if (error) throw error;
      closeModal();
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa simpan dokumen");
    } finally {
      setSaving(false);
    }
  };

  // hapus dokumen
  const doDelete = async (id: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
    load();
  };

  const handleDelete = (d: Doc) => {
    const msg = `Yakin hapus "${d.name}"? Tindakan ini tidak bisa dibatalkan.`;
    // di web, Alert.alert tidak menampilkan tombol -> pakai confirm bawaan browser
    if (Platform.OS === "web") {
      if (window.confirm(msg))
        doDelete(d.id).catch((e) => Alert.alert("Gagal", e?.message));
      return;
    }
    Alert.alert("Hapus Dokumen", msg, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => doDelete(d.id).catch((e) => Alert.alert("Gagal", e?.message)),
      },
    ]);
  };

  if (loading)
    return (
      <ActivityIndicator
        size="large"
        color={navy}
        style={{ flex: 1, justifyContent: "center" }}
      />
    );

  return (
    <>
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
        {/* Header: judul + jumlah + tombol tambah */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.header}>Dokumen Gudang</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{docs.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Simpan & kelola dokumen operasional</Text>

        {/* Pencarian */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / keterangan..."
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Navigasi ke Laporan */}
        <View style={styles.navSection}>
          <Text style={styles.sectionTitle}>Laporan</Text>
          <View style={styles.navGrid}>
            {REPORT_LINKS.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.navItem}
                onPress={() => navigation.navigate(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={18} color={bronze} />
                <Text style={styles.navItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Judul daftar */}
        <Text style={styles.listTitle}>Daftar Dokumen</Text>

        {/* Daftar / empty state */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={30} color={bronze} />
            </View>
            <Text style={styles.emptyTitle}>
              {docs.length === 0 ? "Belum ada dokumen" : "Tidak ditemukan"}
            </Text>
            <Text style={styles.emptyDesc}>
              {docs.length === 0
                ? "Tambahkan dokumen operasional lewat tombol Tambah."
                : "Coba kata kunci lain."}
            </Text>
          </View>
        ) : (
          filtered.map((d) => (
            <View key={d.id} style={styles.row}>
              {/* Ikon dokumen */}
              <View style={styles.rowIcon}>
                <Ionicons name="document-text" size={20} color={bronze} />
              </View>

              {/* Info dokumen */}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {d.name}
                </Text>
                {d.description ? (
                  <Text style={styles.rowDesc} numberOfLines={2}>
                    {d.description}
                  </Text>
                ) : null}
                <Text style={styles.rowDate}>
                  {new Date(d.created_at).toLocaleDateString("id", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>

              {/* Aksi: edit + hapus */}
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.rowBtn} onPress={() => openEdit(d)}>
                  <Ionicons name="create-outline" size={17} color={navy} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rowBtn, styles.rowBtnDanger]}
                  onPress={() => handleDelete(d)}
                >
                  <Ionicons name="trash-outline" size={17} color="#BA1A1A" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT DOKUMEN ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === "edit" ? "Edit Dokumen" : "Tambah Dokumen"}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <Text style={styles.fieldLabel}>Nama dokumen</Text>
            <TextInput
              style={styles.input}
              placeholder="contoh: Faktur Supplier Astra"
              placeholderTextColor={muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Keterangan (opsional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Catatan singkat tentang dokumen ini"
              placeholderTextColor={muted}
              value={desc}
              onChangeText={setDesc}
              multiline
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !name.trim() && styles.modalSaveDisabled]}
                onPress={save}
                disabled={saving || !name.trim()}
              >
                <Text style={styles.modalSaveText}>
                  {saving ? "Menyimpan..." : mode === "edit" ? "Update" : "Simpan"}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { fontSize: 20, fontFamily: "Poppins_800ExtraBold", color: ink },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: chipBg,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontFamily: "Inter_800ExtraBold", color: bronze },
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 14 },
  addBtn: {
    backgroundColor: amber,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#261A00" },

  // pencarian
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 13, color: ink, padding: 0 },

  listTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: ink,
    marginBottom: 10,
  },

  // empty state
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: chipBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: ink },
  emptyDesc: {
    fontSize: 12,
    color: muted,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  // baris dokumen
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { fontSize: 13, fontFamily: "Inter_700Bold", color: ink },
  rowDesc: { fontSize: 11, color: muted, marginTop: 2 },
  rowDate: { fontSize: 10, color: muted, marginTop: 4 },
  rowActions: { flexDirection: "row", gap: 8 },
  rowBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5DFD1",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBtnDanger: { borderColor: "#F3C9C4" },

  // modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: ink },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: ink,
    marginBottom: 14,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#261A00" },

  // Navigasi Laporan
  navSection: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5DFD1",
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: ink,
    marginBottom: 10,
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  navItem: {
    width: "31%",
    minWidth: 96,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5DFD1",
    backgroundColor: chipBg,
  },
  navItemText: {
    color: ink,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
