// ===== IMPORT =====
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminGetProducts, adminCreatePO, adminGetPOs, adminReceivePOItem, adminReturnPOItem, adminUpdatePOStatus } from "../../lib/admin";
import { useLowStock } from "../../context/LowStockContext";
import { useSuppliers } from "../../context/SuppliersContext";
import { rp } from "../../lib/format";
import { toInt, catOf } from "../../lib/helpers";
import { statusLabel } from "../../lib/status";
import type { Product } from "../../models";
import { navy, surface, cardBg, chipBg, muted, ink, bronze, amber } from "../../theme";

// ===== TIPE DATA =====

// satu item yang sedang disusun di formulir PO (qty & price disimpan sebagai string agar enak diedit)
type DraftItem = {
  product_id: string;
  product_name: string;
  code: string;
  stock: number;
  qty: string;
  price: string;
};

// tanggal singkat bahasa Indonesia
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id", { day: "numeric", month: "short", year: "numeric" });

// ===== KOMPONEN UTAMA =====
export default function AdminPOScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pos, setPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchPO, setSearchPO] = useState("");
  // filter daftar PO: kategori barang + rentang tanggal
  const [filterCat, setFilterCat] = useState("Semua");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { suppliers, refresh: refreshSuppliers, loading: suppliersLoading } = useSuppliers();

  // modal buat PO
  const [modalOpen, setModalOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  // picker filter (pencarian + kategori)
  const [pickSearch, setPickSearch] = useState("");
  const [pickCat, setPickCat] = useState("Semua");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshLowStock } = useLowStock();

  // supplier picker modal
  const [pickingSupplier, setPickingSupplier] = useState(false);

  // status badge color mapping
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "draft": return styles.statusDraft;
      case "diajukan": return styles.statusDiajukan;
      case "dipesan": return styles.statusDipesan;
      case "diterima": return styles.statusDone;
      case "batal": return styles.statusBatal;
      case "retur": return styles.statusRetur;
      default: return styles.statusPending;
    }
  };

  // progress received per PO
  const getProgress = (o: any) => {
    const items = o.purchase_order_items ?? [];
    const total = items.reduce((s: number, it: any) => s + (it.qty ?? 0), 0);
    const received = items.reduce((s: number, it: any) => s + (it.received_qty ?? 0), 0);
    return total > 0 ? Math.round((received / total) * 100) : 0;
  };

  // partial receive modal state
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState<any>(null);

  // retur modal state
  const [returModalOpen, setReturModalOpen] = useState(false);
  const [returItem, setReturItem] = useState<any>(null);
  const [returQty, setReturQty] = useState("");
  const [returReason, setReturReason] = useState("");

  // handle open partial receive modal
  const openReceive = (item: any) => {
    setReceiveItem(item);
    setReceiveModalOpen(true);
  };

  // handle partial receive
  const handleReceive = async () => {
    if (!receiveItem) return;
    const qty = Math.trunc(Number(receiveItem.receiveQty));
    if (qty <= 0) {
      Alert.alert("Qty tidak valid");
      return;
    }
    try {
      await adminReceivePOItem(receiveItem.id, qty);
      setReceiveModalOpen(false);
      setReceiveItem(null);
      load();
      void refreshLowStock();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Gagal terima parsial");
    }
  };

  // handle open retur modal
  const openRetur = (item: any) => {
    setReturItem(item);
    setReturQty("");
    setReturReason("");
    setReturModalOpen(true);
  };

  // handle retur
  const handleRetur = async () => {
    if (!returItem) return;
    const qty = Math.trunc(Number(returQty));
    if (qty <= 0) {
      Alert.alert("Qty tidak valid");
      return;
    }
    try {
      await adminReturnPOItem(returItem.id, qty, returReason);
      setReturModalOpen(false);
      setReturItem(null);
      load();
      void refreshLowStock();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Gagal retur");
    }
  };

  // update PO status
  const handleStatusChange = async (poId: string, newStatus: string) => {
    try {
      await adminUpdatePOStatus(poId, newStatus as any);
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Gagal ubah status");
    }
  };

  // status action buttons
  const renderStatusActions = (o: any) => {
    const actions: any[] = [];
    
    if (o.status === "draft") {
      actions.push(
        <TouchableOpacity key="diajukan" style={styles.actionBtnSmall} onPress={() => handleStatusChange(o.id, "diajukan")}>
          <Text style={styles.actionText}>Diajukan</Text>
        </TouchableOpacity>
      );
    }
    if (o.status === "diajukan") {
      actions.push(
        <TouchableOpacity key="dipesan" style={styles.actionBtnSmall} onPress={() => handleStatusChange(o.id, "dipesan")}>
          <Text style={styles.actionText}>Dipesan</Text>
        </TouchableOpacity>
      );
      actions.push(
        <TouchableOpacity key="batal" style={[styles.actionBtnSmall, styles.actionBtnDanger]} onPress={() => handleStatusChange(o.id, "batal")}>
          <Text style={styles.actionTextDanger}>Batal</Text>
        </TouchableOpacity>
      );
    }
    if (o.status === "dipesan") {
      actions.push(
        <TouchableOpacity key="diterima" style={styles.actionBtnSmall} onPress={() => handleStatusChange(o.id, "diterima")}>
          <Text style={styles.actionText}>Terima Semua</Text>
        </TouchableOpacity>
      );
      actions.push(
        <TouchableOpacity key="batal" style={[styles.actionBtnSmall, styles.actionBtnDanger]} onPress={() => handleStatusChange(o.id, "batal")}>
          <Text style={styles.actionTextDanger}>Batal</Text>
        </TouchableOpacity>
      );
    }
    if (o.status === "diterima") {
      actions.push(
        <TouchableOpacity key="retur" style={[styles.actionBtnSmall, styles.actionBtnDanger]} onPress={() => handleStatusChange(o.id, "retur")}>
          <Text style={styles.actionTextDanger}>Retur</Text>
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.actionRow}>{actions}</View>;
  };

  // ambil produk & daftar PO
  // useCallback menjaga "load" tetap sama antar render (refreshSuppliers juga stabil)
  const load = useCallback(async () => {
    const [p, o] = await Promise.all([adminGetProducts(), adminGetPOs(), refreshSuppliers(true)]);
    setProducts(p);
    setPOs(o);
    setLoading(false);
    setRefreshing(false);
  }, [refreshSuppliers]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // daftar kategori untuk chip
  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map(catOf))).sort()],
    [products],
  );

  // produk hasil pencarian + filter kategori (untuk picker)
  const filteredPick = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = pickCat === "Semua" || catOf(p) === pickCat;
      const okSearch =
        q === "" || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return okCat && okSearch;
    });
  }, [products, pickSearch, pickCat]);

  // kumpulan kategori barang dalam sebuah PO (via product_id -> products)
  const poCategorySet = useCallback(
    (o: any): Set<string> =>
      new Set(
        (o.purchase_order_items ?? [])
          .map((it: any) => products.find((p: Product) => p.id === it.product_id))
          .filter(Boolean)
          .map((p: any) => catOf(p as Product)),
      ),
    [products],
  );

  // daftar PO hasil pencarian + filter kategori + rentang tanggal
  const filteredPO = useMemo(() => {
    const q = searchPO.trim().toLowerCase();
    return pos.filter((o) => {
      // 1) pencarian teks: kode PO / supplier / nama barang di dalam PO
      const okSearch =
        q === "" ||
        String(o.code ?? "").toLowerCase().includes(q) ||
        String(o.supplier ?? o.supplier_name ?? "").toLowerCase().includes(q) ||
        (o.purchase_order_items ?? []).some((it: any) =>
          String(it.product_name ?? "").toLowerCase().includes(q),
        );

      // 2) filter kategori: cocok jika salah satu item PO berkategori terpilih
      const okCat = filterCat === "Semua" || poCategorySet(o).has(filterCat);

      // 3) filter rentang tanggal berdasarkan created_at (YYYY-MM-DD)
      const day = String(o.created_at ?? "").slice(0, 10);
      const okStart = !startDate || day >= startDate;
      const okEnd = !endDate || day <= endDate;

      return okSearch && okCat && okStart && okEnd;
    });
  }, [pos, searchPO, filterCat, startDate, endDate, poCategorySet]);

  // total harga beli dari item yang disusun
  const total = useMemo(
    () => items.reduce((s, it) => s + toInt(it.qty) * toInt(it.price), 0),
    [items],
  );

  // supplier yang dipilih (dari ID)
  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  // tombol simpan aktif hanya bila supplier + item valid
  const canSave =
    supplierId.length > 0 &&
    items.length > 0 &&
    items.every((it) => toInt(it.qty) > 0 && toInt(it.price) >= 0) &&
    !saving;

  // buka modal buat PO (reset dulu)
  const openCreate = () => {
    setSupplierId("");
    setNotes("");
    setItems([]);
    setPicking(false);
    setPickSearch("");
    setPickCat("Semua");
    setModalOpen(true);
  };

  // tutup modal + reset
  const closeModal = () => {
    setModalOpen(false);
    setPicking(false);
    setSupplierId("");
    setNotes("");
    setItems([]);
  };

  // tambah produk ke daftar item (cegah duplikat), lalu balik ke form
  const addItem = (p: Product) => {
    setItems((prev) => {
      if (prev.some((it) => it.product_id === p.id)) return prev;
      return [
        ...prev,
        { product_id: p.id, product_name: p.name, code: p.code, stock: p.stock, qty: "1", price: String(p.price) },
      ];
    });
    setPicking(false);
  };

  // ubah qty/harga sebuah item (hanya angka)
  const updateItem = (idx: number, field: "qty" | "price", value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: clean } : it)));
  };

  // hapus item
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // simpan PO (draft status, tidak auto-receive)
  const save = async () => {
    if (!supplierId || items.length === 0) return;
    const payload = items.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      qty: toInt(it.qty),
      price: toInt(it.price),
    }));
    setSaving(true);
    try {
      const code = `PO-${Date.now().toString().slice(-6)}`;
      await adminCreatePO({
        code,
        supplier: selectedSupplier?.name ?? "",
        supplierId: supplierId,
        notes: notes.trim() || undefined,
        items: payload,
      });
      closeModal();
      load();
      void refreshLowStock();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa buat PO");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />
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
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.header}>Purchase Order</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pos.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Buat</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Pembelian ke supplier</Text>

        {/* Pencarian daftar PO */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari kode / supplier / nama barang..."
            placeholderTextColor={muted}
            value={searchPO}
            onChangeText={setSearchPO}
          />
          {searchPO.length > 0 && (
            <TouchableOpacity onPress={() => setSearchPO("")}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter kategori barang */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.filterChip, filterCat === c && styles.filterChipActive]}
              onPress={() => setFilterCat(c)}
            >
              <Text style={[styles.filterChipText, filterCat === c && styles.filterChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter rentang tanggal */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Dari (YYYY-MM-DD)"
            placeholderTextColor={muted}
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Sampai (YYYY-MM-DD)"
            placeholderTextColor={muted}
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>

        {/* Tombol reset filter (muncul hanya saat filter aktif) */}
        {(filterCat !== "Semua" || startDate !== "" || endDate !== "") && (
          <TouchableOpacity
            onPress={() => { setFilterCat("Semua"); setStartDate(""); setEndDate(""); }}
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            <Text style={styles.resetFilter}>Reset filter</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.listTitle}>Daftar PO ({filteredPO.length})</Text>

        {/* Daftar PO / empty state */}
        {filteredPO.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={28} color={bronze} />
            </View>
            <Text style={styles.emptyTitle}>
              {pos.length === 0 ? "Belum ada PO" : "Tidak ditemukan"}
            </Text>
            <Text style={styles.emptyDesc}>
              {pos.length === 0
                ? "Buat pembelian pertama lewat tombol Buat."
                : "Coba kata kunci lain."}
            </Text>
          </View>
        ) : (
          filteredPO.map((o: any) => {
            const progress = getProgress(o);
            const statusStyle = getStatusStyle(o.status);
            return (
              <View key={o.id} style={styles.poCard}>
                {/* kode + status */}
                <View style={styles.poTop}>
                  <Text style={styles.poCode}>{o.code}</Text>
                  <View style={statusStyle}>
                    <Text style={styles.statusText}>
                      {statusLabel(o.status)}
                      {o.status === "dipesan" && progress > 0 && progress < 100 && ` ${progress}%`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.poSupplier}>{o.supplier_name ?? o.supplier}</Text>
                <Text style={styles.poDate}>{shortDate(o.created_at)}</Text>

                <View style={styles.dashed} />

                {/* item-item PO */}
                {(o.purchase_order_items ?? []).map((it: any) => (
                  <View key={it.id} style={styles.poItemLine}>
                    <Text style={styles.poItemName} numberOfLines={1}>
                      {it.product_name}
                    </Text>
                    <Text style={styles.poItemQty}>×{it.qty}</Text>
                    <Text style={styles.poItemPrice}>{rp((it.price ?? 0) * (it.qty ?? 0))}</Text>
                    {(o.status === "dipesan" || o.status === "diterima") && it.received_qty < it.qty && (
                      <TouchableOpacity
                        style={styles.actionBtnMini}
                        onPress={() => openReceive(it)}
                      >
                        <Ionicons name="add-circle" size={16} color={navy} />
                        <Text style={styles.actionTextMini}>Terima</Text>
                      </TouchableOpacity>
                    )}
                    {o.status === "diterima" && it.received_qty > it.returned_qty && (
                      <TouchableOpacity
                        style={styles.actionBtnMini}
                        onPress={() => openRetur(it)}
                      >
                        <Ionicons name="return-up-back" size={16} color="#BA1A1A" />
                        <Text style={styles.actionTextMiniDanger}>Retur</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* status actions */}
                {renderStatusActions(o)}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===== MODAL BUAT PO ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />

          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{picking ? "Pilih Barang" : "Buat PO"}</Text>
              <TouchableOpacity onPress={picking ? () => setPicking(false) : closeModal}>
                <Ionicons name={picking ? "arrow-back" : "close"} size={22} color={ink} />
              </TouchableOpacity>
            </View>

            {picking ? (
              /* ----- PICKER PRODUK ----- */
              <>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={muted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari nama atau kode barang..."
                    placeholderTextColor={muted}
                    value={pickSearch}
                    onChangeText={setPickSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {pickSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setPickSearch("")}>
                      <Ionicons name="close-circle" size={18} color={muted} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, pickCat === c && styles.chipActive]}
                      onPress={() => setPickCat(c)}
                    >
                      <Text style={[styles.chipText, pickCat === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.resultCount}>{filteredPick.length} barang</Text>

                <FlatList
                  data={filteredPick}
                  keyExtractor={(p) => p.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  ListEmptyComponent={<Text style={styles.empty}>Barang tidak ditemukan.</Text>}
                  renderItem={({ item: p }) => {
                    const added = items.some((it) => it.product_id === p.id);
                    return (
                      <TouchableOpacity
                        style={[styles.pickRow, added && styles.pickRowAdded]}
                        onPress={() => addItem(p)}
                        disabled={added}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.itemMeta}>
                            {p.code} • {catOf(p)} • stok {p.stock}
                          </Text>
                        </View>
                        <Ionicons
                          name={added ? "checkmark-circle" : "add-circle-outline"}
                          size={20}
                          color={added ? bronze : navy}
                        />
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            ) : (
              /* ----- FORM PO ----- */
              <>
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  <Text style={styles.fieldLabel}>Supplier</Text>
                  <View style={styles.dropdownWrapper}>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => setPickingSupplier(true)}
                    >
                      <View style={styles.dropdownContent}>
                        <Ionicons name="business" size={18} color={supplierId ? navy : muted} />
                        <Text style={styles.dropdownText}>
                          {selectedSupplier ? selectedSupplier.name : "Pilih supplier"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color={muted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemsHeader}>
                    <Text style={styles.fieldLabel}>Item</Text>
                    <TouchableOpacity onPress={() => setPicking(true)}>
                      <Text style={styles.addItemText}>+ Tambah barang</Text>
                    </TouchableOpacity>
                  </View>

                  {items.length === 0 ? (
                    <Text style={styles.emptyItems}>Belum ada item. Tekan “Tambah barang”.</Text>
                  ) : (
                    items.map((it, idx) => (
                      <View key={it.product_id} style={styles.itemRow}>
                        <View style={styles.itemTop}>
                          <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                          <Text style={styles.itemSubtotal}>{rp(toInt(it.qty) * toInt(it.price))}</Text>
                        </View>
                        <Text style={styles.itemMeta}>{it.code} • stok {it.stock}</Text>

                        <View style={styles.itemBottom}>
                          <View style={{ width: 64 }}>
                            <Text style={styles.miniLabel}>Qty</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="number-pad"
                              value={it.qty}
                              onChangeText={(v) => updateItem(idx, "qty", v)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>Harga beli</Text>
                            <TextInput
                              style={styles.miniInput}
                              keyboardType="number-pad"
                              value={it.price}
                              onChangeText={(v) => updateItem(idx, "price", v)}
                            />
                          </View>
                          <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(idx)}>
                            <Ionicons name="trash-outline" size={16} color="#BA1A1A" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}

                  <View style={styles.dashed} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{rp(total)}</Text>
                  </View>

                  <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Nomor faktur, termin, dll."
                    placeholderTextColor={muted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </ScrollView>

                <View style={styles.footer}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !canSave && styles.saveDisabled]}
                    disabled={!canSave}
                    onPress={save}
                  >
                    <Text style={styles.saveText}>{saving ? "Menyimpan..." : "Simpan PO"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL PILIH SUPPLIER ===== */}
      <Modal visible={pickingSupplier} animationType="slide" transparent onRequestClose={() => setPickingSupplier(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPickingSupplier(false)} />
          <View style={styles.supplierSheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Pilih Supplier</Text>
              <TouchableOpacity onPress={() => setPickingSupplier(false)}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau kode supplier..."
                placeholderTextColor={muted}
                value={pickSearch}
                onChangeText={setPickSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {pickSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPickSearch("")}>
                  <Ionicons name="close-circle" size={18} color={muted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.resultCount}>
              {suppliersLoading ? "Memuat supplier..." : `${suppliers.length} supplier`}
            </Text>

            <FlatList
              data={suppliers}
              keyExtractor={s => s.id}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              ListEmptyComponent={
                suppliersLoading ? (
                  <ActivityIndicator size="small" color={navy} style={{ paddingVertical: 40 }} />
                ) : (
                  <Text style={styles.empty}>Belum ada supplier aktif.</Text>
                )
              }
              renderItem={({ item: s }) => (
                <TouchableOpacity
                  style={styles.supplierRow}
                  onPress={() => {
                    setSupplierId(s.id);
                    setPickingSupplier(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.itemMeta}>
                      {s.code} • {s.contactPerson ? `CP: ${s.contactPerson}` : ''}
                      {s.phone ? ` • ${s.phone}` : ''}
                    </Text>
                    <Text style={styles.itemMetaSmall}>{s.address || '-'}</Text>
                  </View>
                  <Ionicons
                    name={supplierId === s.id ? "checkmark-circle" : "add-circle-outline"}
                    size={20}
                    color={supplierId === s.id ? bronze : navy}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL TERIMA PARSIAL ===== */}
      <Modal visible={receiveModalOpen} animationType="slide" transparent onRequestClose={() => setReceiveModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setReceiveModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Terima Parsial</Text>
              <TouchableOpacity onPress={() => setReceiveModalOpen(false)}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalForm}>
              <Text style={styles.modalLabel}>{receiveItem?.product_name}</Text>
              <Text style={styles.modalMeta}>Ordered: {receiveItem?.qty} • Received: {receiveItem?.received_qty ?? 0}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Qty terima"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={receiveItem?.receiveQty ?? ""}
                onChangeText={v => setReceiveItem({ ...receiveItem, receiveQty: v })}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReceiveModalOpen(false)}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleReceive}>
                <Text style={styles.modalSaveText}>Terima</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL RETUR ===== */}
      <Modal visible={returModalOpen} animationType="slide" transparent onRequestClose={() => setReturModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setReturModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Retur Barang</Text>
              <TouchableOpacity onPress={() => setReturModalOpen(false)}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalForm}>
              <Text style={styles.modalLabel}>{returItem?.product_name}</Text>
              <Text style={styles.modalMeta}>Diterima: {returItem?.received_qty ?? 0} • Diretur: {returItem?.returned_qty ?? 0}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Qty retur"
                placeholderTextColor={muted}
                keyboardType="number-pad"
                value={returQty}
                onChangeText={setReturQty}
              />
              <TextInput
                style={[styles.modalInput, styles.inputMultiline]}
                placeholder="Alasan retur (opsional)"
                placeholderTextColor={muted}
                value={returReason}
                onChangeText={setReturReason}
                multiline
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReturModalOpen(false)}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: "#BA1A1A" }]} onPress={handleRetur}>
                <Text style={styles.modalSaveText}>Retur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ===== STYLE =====
const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  header: { fontSize: 20, fontFamily: "Poppins_800ExtraBold", color: ink },
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 14 },
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

  listTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: ink, marginBottom: 10 },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: chipBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: ink },
  emptyDesc: { fontSize: 12, color: muted, marginTop: 4, textAlign: "center", paddingHorizontal: 24 },

  // kartu PO bergaya struk
  poCard: {
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  poTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  poCode: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy, letterSpacing: 0.5 },
  pending: { backgroundColor: "#FFF8CC" },
  done: { backgroundColor: chipBg },
  poSupplier: { fontSize: 13, fontFamily: "Inter_700Bold", color: ink, marginTop: 6 },
  poDate: { fontSize: 10, color: muted, marginTop: 1 },
  dashed: {
    borderTopWidth: 1,
    borderColor: "#E0D9C9",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  poItemLine: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  poItemName: { flex: 1, fontSize: 12, color: ink },
  poItemQty: { fontSize: 11, color: muted, marginHorizontal: 8 },
  poItemPrice: { fontSize: 12, color: ink, fontFamily: "Inter_700Bold" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D8D2C4" },
  filterChipActive: { backgroundColor: navy, borderColor: navy },
  filterChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  filterChipTextActive: { color: "#fff" },
  resetFilter: { fontSize: 12, fontFamily: "Inter_700Bold", color: bronze },
  receiveBtn: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
    marginTop: 10,
  },
  receiveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },

  // modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    height: "90%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: ink },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: ink, marginBottom: 6 },
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
  inputMultiline: { minHeight: 64, textAlignVertical: "top" },

  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  addItemText: { fontSize: 12, fontFamily: "Inter_800ExtraBold", color: navy },
  emptyItems: { fontSize: 12, color: muted, paddingVertical: 8 },

  // item di form
  itemRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5DFD1",
    padding: 12,
    marginBottom: 8,
  },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: ink },
  itemSubtotal: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: bronze, marginLeft: 8 },
  itemMeta: { fontSize: 10, color: muted, marginTop: 2 },
  itemBottom: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 10 },
  miniLabel: { fontSize: 10, color: muted, marginBottom: 3 },
  miniInput: {
    backgroundColor: "#FBF9F4",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: ink,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F3C9C4",
    alignItems: "center",
    justifyContent: "center",
  },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  totalLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: muted },
  totalValue: { fontSize: 20, fontFamily: "Inter_800ExtraBold", color: navy },

  footer: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy },
  saveBtn: {
    flex: 1.4,
    backgroundColor: navy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#fff" },

  // dropdown supplier
  dropdownWrapper: { marginBottom: 14 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownContent: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dropdownText: { fontSize: 13, color: ink },

  // status badges
  statusDraft: { backgroundColor: "#E8F1FF", borderColor: navy },
  statusDiajukan: { backgroundColor: "#FFF8CC", borderColor: amber },
  statusDipesan: { backgroundColor: "#E8F5E9", borderColor: bronze },
  statusDone: { backgroundColor: chipBg },
  statusBatal: { backgroundColor: "#FFEBEB", borderColor: "#BA1A1A" },
  statusRetur: { backgroundColor: "#FCE4EC", borderColor: "#E91E63" },
  statusPending: { backgroundColor: "#FFF8CC" },
  status: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", color: bronze },

  // action buttons
  actionRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  actionBtnSmall: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
  },
  actionBtnDanger: { borderColor: "#BA1A1A" },
  actionText: { fontSize: 9, fontFamily: "Inter_700Bold", color: navy },
  actionTextDanger: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#BA1A1A" },

  // mini action buttons in item line
  actionBtnMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
  },
  actionTextMini: { fontSize: 9, fontFamily: "Inter_700Bold", color: navy },
  actionTextMiniDanger: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#BA1A1A" },

  // supplier picker modal
  supplierSheet: {
    height: "85%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  itemMetaSmall: { fontSize: 10, color: muted, marginTop: 1, lineHeight: 14 },

  // modal receive/retur
  modalSheet: {
    height: "50%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  modalForm: { marginBottom: 16 },
  modalLabel: { fontSize: 14, fontFamily: "Inter_800ExtraBold", color: ink, marginBottom: 2 },
  modalMeta: { fontSize: 11, color: muted, marginBottom: 10 },
  modalInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: ink,
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5DFD1" },
  modalCancelBtn: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalSaveText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "#fff" },

  // picker
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
  chipRow: { flexGrow: 0, marginBottom: 8 },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8D2C4",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: navy, borderColor: navy },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  chipTextActive: { color: "#fff" },
  resultCount: { fontSize: 11, color: muted, marginBottom: 6 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  pickRowAdded: { borderColor: bronze, backgroundColor: chipBg, opacity: 0.7 },
});
