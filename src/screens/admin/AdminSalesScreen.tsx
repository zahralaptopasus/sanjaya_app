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
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { adminGetProducts, adminGetSales } from "../../lib/admin";
import { useLowStock } from "../../context/LowStockContext";
import { supabase } from "../../lib/supabase";
import { rp } from "../../lib/format";
import type { Product } from "../../models";
import { navy, surface, cardBg, chipBg, muted, ink, bronze, amber } from "../../theme";
import { catOf, toInt } from "../../lib/helpers";

// ===== TIPE DATA =====
type DraftItem = {
  product_id: string;
  product_name: string;
  code: string;
  stock: number;
  qty: string;
  price: string;
};

type Period = "today" | "7d" | "30d" | "all";
type StatusFilter = "all" | "paid" | "pending";
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id", { day: "numeric", month: "short", year: "numeric" });
const longDateTime = (iso: string) => {
  const d = new Date(iso);
  const jam = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${shortDate(iso)}, ${jam} WIB`;
};
const htmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const generateReceiptHTML = (sale: any) => {
  const items = (sale.items ?? []) as { name: string; qty: number; price: number }[];
  const rows = items
    .map(
      (it) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #eee;">${htmlEscape(String(it.name))}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;">${it.qty} x ${rp(it.price)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${rp(it.price * it.qty)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    body{font-family:system-ui,sans-serif;margin:24px;color:#131B2E;font-size:11pt;}
    .header{text-align:center;margin-bottom:16px;}
    .header h1{margin:0;font-size:16pt;color:#0B3D91;}
    .header p{margin:2px 0;color:#434652;font-size:10pt;}
    table{width:100%;border-collapse:collapse;margin-top:12px;}
    th{text-align:left;padding:6px;border-bottom:2px solid #0B3D91;font-size:10pt;color:#434652;}
    .grand{font-size:14pt;color:#0B3D91;font-weight:900;}
    .footer{margin-top:24px;text-align:center;color:#434652;font-size:9pt;}
  </style></head><body>
    <div class="header">
      <h1>SANJAYA</h1>
      <p>Santren Jaya Motor Workshop</p>
      <p>Jl. Santren No. 42, Sleman, DIY</p>
    </div>
    <table>
      <thead><tr><th>Barang</th><th style="text-align:center;">Qty x Harga</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>
        ${rows}
        <tr><td colspan="2" style="padding-top:10px;font-weight:bold;">Total</td><td class="grand" style="text-align:right;padding-top:10px;">${rp(sale.total)}</td></tr>
      </tbody>
    </table>
    <div class="footer">
      No. Transaksi: ${htmlEscape(String(sale.code))}<br/>
      Waktu: ${longDateTime(String(sale.createdAt))}<br/>
      Metode: ${htmlEscape(methodLabel(sale.paymentMethod))}<br/>
      Terima kasih telah berbelanja di Sanjaya Motor.
    </div>
  </body></html>`;
};
// label metode pembayaran
const methodLabel = (m?: string) => (m === "cod" ? "Tunai (COD)" : "Midtrans (Online)");
const statusLabel = (s: string, method?: string) =>
  s === "paid"
    ? "Lunas"
    : s === "pending"
      ? method === "cod"
        ? "COD • Belum bayar"
        : "Menunggu"
      : s;
const statusColors = (s: string) =>
  s === "pending"
    ? { bg: "#FFF8CC", fg: "#8A6D00" }
    : s === "paid"
      ? { bg: chipBg, fg: bronze }
      : { bg: "#FFEBEB", fg: "#BA1A1A" };

// rentang tanggal berdasarkan periode terpilih
const periodRange = (p: Period): { startDate?: string; endDate?: string } => {
  const now = new Date();
  if (p === "all") return {};
  if (p === "today") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }
  const days = p === "7d" ? 7 : 30;
  return { startDate: new Date(now.getTime() - days * 86400000).toISOString(), endDate: now.toISOString() };
};

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "all", label: "Semua" },
];
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "paid", label: "Lunas" },
  { key: "pending", label: "Menunggu" },
];

// ===== KOMPONEN UTAMA =====
export default function AdminSalesScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [period, setPeriod] = useState<Period>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // modal catat penjualan
  const [modalOpen, setModalOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshLowStock } = useLowStock();
  const [pickSearch, setPickSearch] = useState("");
  const [pickCat, setPickCat] = useState("Semua");

  // modal struk
  const [receipt, setReceipt] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);

  // ambil produk (untuk picker) & penjualan (sesuai periode)
  const load = useCallback(async () => {
    const [prod, data] = await Promise.all([adminGetProducts(), adminGetSales(periodRange(period))]);
    setProducts(prod);
    setSales(data);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // ganti periode (effect di atas otomatis memuat ulang lewat perubahan load)
  const changePeriod = (p: Period) => setPeriod(p);

  // ringkasan periode terpilih (sebelum filter status/pencarian)
  const summary = useMemo(
    () => ({ count: sales.length, total: sales.reduce((s, o) => s + (o.total ?? 0), 0) }),
    [sales],
  );

  // daftar penjualan setelah filter status + pencarian
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const okStatus = statusFilter === "all" || s.status === statusFilter;
      const okSearch =
        q === "" ||
        String(s.code ?? "").toLowerCase().includes(q) ||
        (s.items ?? []).some((it: any) => String(it.name ?? "").toLowerCase().includes(q));
      return okStatus && okSearch;
    });
  }, [sales, search, statusFilter]);

  // kategori untuk picker
  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map(catOf))).sort()],
    [products],
  );
  const filteredPick = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = pickCat === "Semua" || catOf(p) === pickCat;
      const okSearch = q === "" || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return okCat && okSearch;
    });
  }, [products, pickSearch, pickCat]);

  const total = useMemo(
    () => items.reduce((s, it) => s + toInt(it.qty) * toInt(it.price), 0),
    [items],
  );

  const canSave =
    items.length > 0 &&
    items.every((it) => toInt(it.qty) > 0 && toInt(it.qty) <= it.stock && toInt(it.price) >= 0) &&
    !saving;

  const openCreate = () => {
    setItems([]);
    setPicking(false);
    setPickSearch("");
    setPickCat("Semua");
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setPicking(false);
    setItems([]);
  };

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
  const updateItem = (idx: number, field: "qty" | "price", value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: clean } : it)));
  };
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // simpan penjualan (multi-item) -> status paid + stok keluar + aliran barang
  const save = async () => {
    if (items.length === 0) return;
    const bad = items.find((it) => toInt(it.qty) > it.stock || toInt(it.qty) <= 0);
    if (bad) {
      Alert.alert("Stok tidak cukup", `${bad.product_name} — sisa stok ${bad.stock}.`);
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const code = `SJ-${Date.now().toString().slice(-6)}`;
      const payload = items.map((it) => ({
        product_id: it.product_id,
        name: it.product_name,
        qty: toInt(it.qty),
        price: toInt(it.price),
      }));
      const orderTotal = payload.reduce((s, it) => s + it.qty * it.price, 0);

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
          code,
          status: "paid",
          payment_method: "cod",
          total: orderTotal,
        })
        .select()
        .single();
      if (oErr || !order) throw oErr ?? new Error("order fail");

      for (const it of payload) {
        const { error: rpcErr } = await supabase.rpc("apply_stock", {
          p_mov_type: "out",
          p_id: it.product_id,
          p_qty: it.qty,
        });
        if (rpcErr) throw rpcErr;
        await supabase
          .from("order_items")
          .insert({ order_id: order.id, product_id: it.product_id, name: it.name, qty: it.qty, price: it.price });
        await supabase
          .from("stock_movements")
          .insert({
            product_id: it.product_id,
            product_name: it.name,
            movement_type: "out",
            qty: it.qty,
            admin_name: "Admin (Penjualan)",
          });
      }

      closeModal();
      load();
      void refreshLowStock();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Tidak bisa catat penjualan");
    } finally {
      setSaving(false);
    }
  };

  // tandai lunas (order pending -> paid)
  const markPaid = async (id: string) => {
    try {
      const { error } = await supabase.rpc("update_order_status", { p_order_id: id, p_status: "paid" });
      if (error) throw error;
      load();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Gagal ubah status");
    }
  };

  // bagikan struk sebagai teks
  const handleShareText = async (sale: any) => {
    const items = (sale.items ?? []) as { name: string; qty: number; price: number }[];
    const txt =
      `STRUK PENJUALAN\nSANJAYA Motor\nNo: ${sale.code}\nWaktu: ${longDateTime(String(sale.createdAt))}\nMetode: ${methodLabel(sale.paymentMethod)}\n\n` +
      items.map((it) => `${it.name} x${it.qty} = ${rp(it.price * it.qty)}`).join("\n") +
      `\n\nTotal = ${rp(sale.total)}\nTerima kasih!`;
    try {
      await Share.share({ message: txt, title: "Struk Penjualan" });
    } catch {
      Alert.alert("Gagal", "Tidak bisa membagikan struk.");
    }
  };

  // cetak / simpan struk sebagai PDF
  const handlePrint = async (sale: any) => {
    setPrinting(true);
    try {
      const html = generateReceiptHTML(sale);
      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          w.print();
        }
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Simpan / Cetak Struk" });
    } catch (e) {
      console.error(e);
      Alert.alert("Gagal", "Tidak bisa membuat PDF struk.");
    } finally {
      setPrinting(false);
    }
  };

  if (loading)
    return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />;

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
            <Text style={styles.header}>Hasil Penjualan</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{sales.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Catat</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Input manual & daftar transaksi</Text>

        {/* Chip periode */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, period === p.key && styles.chipActive]}
              onPress={() => changePeriod(p.key)}
            >
              <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ringkasan periode */}
        <View style={styles.summaryRow}>
          <View style={styles.sumCard}>
            <Text style={styles.sumLabel}>Transaksi</Text>
            <Text style={styles.sumValue}>{summary.count} nota</Text>
          </View>
          <View style={styles.sumCard}>
            <Text style={styles.sumLabel}>Total</Text>
            <Text style={styles.sumValue}>{rp(summary.total)}</Text>
          </View>
        </View>

        {/* Pencarian */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari kode / nama produk..."
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Chip status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.chip, statusFilter === s.key && styles.chipActive]}
              onPress={() => setStatusFilter(s.key)}
            >
              <Text style={[styles.chipText, statusFilter === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.listTitle}>Daftar Penjualan ({filteredSales.length})</Text>

        {filteredSales.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={28} color={bronze} />
            </View>
            <Text style={styles.emptyTitle}>
              {sales.length === 0 ? "Belum ada penjualan" : "Tidak ditemukan"}
            </Text>
            <Text style={styles.emptyDesc}>
              {sales.length === 0
                ? "Catat penjualan pertama lewat tombol Catat."
                : "Coba ubah periode, status, atau kata kunci."}
            </Text>
          </View>
        ) : (
          filteredSales.map((s: any) => {
            const sc = statusColors(s.status);
            return (
              <View key={s.id} style={styles.saleCard}>
                <View style={styles.saleTop}>
                  <Text style={styles.saleCode}>{s.code}</Text>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.fg }]}>{statusLabel(s.status, s.paymentMethod)}</Text>
                  </View>
                </View>
                <Text style={styles.saleDate}>{shortDate(s.createdAt)} · {methodLabel(s.paymentMethod)}</Text>

                <View style={styles.dashed} />

                {(s.items ?? []).map((it: any, i: number) => (
                  <View key={i} style={styles.saleItemLine}>
                    <Text style={styles.saleItemName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.saleItemQty}>×{it.qty}</Text>
                    <Text style={styles.saleItemPrice}>{rp((it.price ?? 0) * (it.qty ?? 0))}</Text>
                  </View>
                ))}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{rp(s.total)}</Text>
                </View>

                <View style={styles.saleFoot}>
                  <TouchableOpacity style={styles.receiptBtn} onPress={() => setReceipt(s)}>
                    <Ionicons name="receipt-outline" size={14} color={navy} />
                    <Text style={styles.receiptBtnText}>Lihat struk</Text>
                  </TouchableOpacity>

                  {s.status === "pending" ? (
                    <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(s.id)}>
                      <Ionicons name="checkmark-done" size={14} color="#fff" />
                      <Text style={styles.paidText}>Lunas</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===== MODAL CATAT PENJUALAN ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />

          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{picking ? "Pilih Barang" : "Catat Penjualan"}</Text>
              <TouchableOpacity onPress={picking ? () => setPicking(false) : closeModal}>
                <Ionicons name={picking ? "arrow-back" : "close"} size={22} color={ink} />
              </TouchableOpacity>
            </View>

            {picking ? (
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

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
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
                          <Text style={styles.itemMeta}>{p.code} • {catOf(p)} • stok {p.stock}</Text>
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
              <>
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  <View style={styles.itemsHeader}>
                    <Text style={styles.fieldLabel}>Item terjual</Text>
                    <TouchableOpacity onPress={() => setPicking(true)}>
                      <Text style={styles.addItemText}>+ Tambah barang</Text>
                    </TouchableOpacity>
                  </View>

                  {items.length === 0 ? (
                    <Text style={styles.emptyItems}>Belum ada item. Tekan “Tambah barang”.</Text>
                  ) : (
                    items.map((it, idx) => {
                      const over = toInt(it.qty) > it.stock;
                      return (
                        <View key={it.product_id} style={styles.itemRow}>
                          <View style={styles.itemTop}>
                            <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                            <Text style={styles.itemSubtotal}>{rp(toInt(it.qty) * toInt(it.price))}</Text>
                          </View>
                          <Text style={[styles.itemMeta, over && styles.itemMetaWarn]}>
                            {it.code} • stok {it.stock}{over ? " — melebihi stok!" : ""}
                          </Text>

                          <View style={styles.itemBottom}>
                            <View style={{ width: 64 }}>
                              <Text style={styles.miniLabel}>Qty</Text>
                              <TextInput
                                style={[styles.miniInput, over && styles.miniInputWarn]}
                                keyboardType="number-pad"
                                value={it.qty}
                                onChangeText={(v) => updateItem(idx, "qty", v)}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.miniLabel}>Harga jual</Text>
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
                      );
                    })
                  )}

                  <View style={styles.dashed} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{rp(total)}</Text>
                  </View>
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
                    <Text style={styles.saveText}>{saving ? "Menyimpan..." : "Simpan"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL STRUK ===== */}
      <Modal visible={!!receipt} animationType="slide" transparent onRequestClose={() => setReceipt(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setReceipt(null)} />

          <View style={styles.receiptSheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Struk Penjualan</Text>
              <TouchableOpacity onPress={() => setReceipt(null)}>
                <Ionicons name="close" size={22} color={ink} />
              </TouchableOpacity>
            </View>

            {receipt ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.receiptCard}>
                  <View style={styles.receiptHead}>
                    <Text style={styles.receiptBrand}>SANJAYA</Text>
                    <Text style={styles.receiptSub}>Santren Jaya Motor Workshop</Text>
                    <Text style={styles.receiptSub}>Jl. Santren No. 42, Sleman, DIY</Text>
                  </View>

                  <View style={styles.receiptMetaRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>No. Transaksi</Text>
                      <Text style={styles.receiptCode}>{receipt.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Waktu</Text>
                      <Text style={styles.receiptMeta}>{longDateTime(String(receipt.createdAt))}</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.miniLabel}>Metode Pembayaran</Text>
                    <Text style={styles.receiptMeta}>{methodLabel(receipt.paymentMethod)}</Text>
                  </View>

                  <View style={styles.dashed} />

                  {(receipt.items ?? []).map((it: any, i: number) => (
                    <View key={i} style={styles.saleItemLine}>
                      <Text style={styles.saleItemName} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.saleItemQty}>{it.qty} × {rp(it.price)}</Text>
                      <Text style={styles.saleItemPrice}>{rp((it.price ?? 0) * (it.qty ?? 0))}</Text>
                    </View>
                  ))}

                  <View style={styles.dashed} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{rp(receipt.total)}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: statusColors(receipt.status).bg, alignSelf: "flex-start", marginTop: 12 },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColors(receipt.status).fg }]}>
                      {statusLabel(receipt.status, receipt.paymentMethod)}
                    </Text>
                  </View>
                </View>

                <View style={styles.footer}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleShareText(receipt)}>
                    <Text style={styles.cancelText}>Bagikan (Teks)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, printing && styles.saveDisabled]}
                    onPress={() => handlePrint(receipt)}
                    disabled={printing}
                  >
                    {printing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveText}>Cetak / Simpan PDF</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
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

  // chip horizontal (periode & status)
  chipRow: { flexGrow: 0, marginBottom: 12 },
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

  // ringkasan
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  sumCard: {
    flex: 1,
    backgroundColor: cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5DFD1",
    padding: 14,
  },
  sumLabel: { fontSize: 11, color: muted, marginBottom: 4 },
  sumValue: { fontSize: 16, fontFamily: "Inter_800ExtraBold", color: ink },

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
    marginBottom: 12,
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

  // kartu penjualan (struk)
  saleCard: {
    backgroundColor: cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5DFD1",
  },
  saleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saleCode: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: navy, letterSpacing: 0.5 },
  statusChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  saleDate: { fontSize: 10, color: muted, marginTop: 2 },
  dashed: { borderTopWidth: 1, borderColor: "#E0D9C9", borderStyle: "dashed", marginVertical: 10 },
  saleItemLine: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  saleItemName: { flex: 1, fontSize: 12, color: ink },
  saleItemQty: { fontSize: 11, color: muted, marginHorizontal: 8 },
  saleItemPrice: { fontSize: 12, color: ink, fontFamily: "Inter_700Bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  totalLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: muted },
  totalValue: { fontSize: 15, fontFamily: "Inter_800ExtraBold", color: ink },
  paidBtn: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  paidText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  saleFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  receiptBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: navy },

  // modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    height: "90%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: ink },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: ink },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
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
  itemMetaWarn: { color: "#BA1A1A" },
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
  miniInputWarn: { borderColor: "#BA1A1A" },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F3C9C4",
    alignItems: "center",
    justifyContent: "center",
  },

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

  // modal struk
  receiptSheet: {
    maxHeight: "85%",
    backgroundColor: surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  receiptCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5DFD1",
    padding: 16,
  },
  receiptHead: { alignItems: "center", marginBottom: 12 },
  receiptBrand: { fontSize: 18, fontFamily: "Inter_800ExtraBold", color: navy, letterSpacing: 0.5 },
  receiptSub: { fontSize: 11, color: muted, marginTop: 2 },
  receiptMetaRow: { flexDirection: "row", gap: 12 },
  receiptCode: { fontSize: 12, fontFamily: "Inter_800ExtraBold", color: ink },
  receiptMeta: { fontSize: 12, fontFamily: "Inter_700Bold", color: ink },
});
