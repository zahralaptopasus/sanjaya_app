// ===== BUKU BESAR MUTASI STOK =====
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { exportExcel } from "../../lib/exportSheet";
import { navy, ink, muted, bronze } from "../../theme";

interface StockMovement {
  id: string;
  product_code: string;
  product_name: string;
  type: "masuk" | "keluar" | "opname";
  qty: number;
  balance_after: number;
  supplier_or_order?: string;
  note?: string;
  created_at: string;
}

export default function ReportsStockMovementScreen() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMovements = useCallback(async () => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setMovements(data as StockMovement[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadMovements();
    })();
  }, [loadMovements]);

  const exportToExcel = () => {
    const columns = [
      { header: "Tanggal", key: "created_at" },
      { header: "Jenis", key: "type" },
      { header: "Kode Produk", key: "product_code" },
      { header: "Nama Produk", key: "product_name" },
      { header: "Jumlah", key: "qty" },
      { header: "Stok Setelah", key: "balance_after" },
      { header: "Supplier / Order", key: "supplier_or_order" },
      { header: "Catatan", key: "note" },
    ];

    const rows = movements.map((m) => ({
      created_at: m.created_at,
      type: m.type,
      product_code: m.product_code,
      product_name: m.product_name,
      qty: m.qty,
      balance_after: m.balance_after,
      supplier_or_order: m.supplier_or_order ?? "-",
      note: m.note ?? "-",
    }));

    exportExcel("Laporan-Mutasi-Stok", "Buku Besar Mutasi Stok", columns, rows);
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk Mutasi Stok belum terimplementasi. Gunakan Excel.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Buku Besar Mutasi Stok</Text>
        <Text style={styles.sub}>
          Histori lengkap stok masuk dari supplier, keluar untuk pesanan, dan penyesuaian stock opname
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button title="Unduh Excel" onPress={exportToExcel} color={navy} />
        <Button title="Unduh PDF" onPress={exportToPDF} color={bronze} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />
        ) : (
          movements.map((m) => (
            <View key={m.id} style={styles.row}>
              <Text style={styles.date}>{m.created_at}</Text>
              <Text style={styles.type}>{m.type}</Text>
              <Text style={styles.code}>{m.product_code}</Text>
              <Text style={styles.name}>{m.product_name}</Text>
              <Text style={styles.qty}>+{m.qty} (jika masuk) / -{m.qty} (jika keluar)</Text>
              <Text style={styles.balance}>Stok: {m.balance_after}</Text>
              <Text style={styles.note}>{m.note ?? "-"}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5DFD1",
    backgroundColor: "#fff",
  },
  title: { fontSize: 20, fontFamily: "Poppins_700Bold", color: ink },
  sub: { fontSize: 12, color: muted, marginBottom: 12 },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5DFD1",
  },
  list: { flexGrow: 1 },
  listContent: { padding: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5DFD1",
  },
  date: { fontSize: 12, color: muted },
  type: { fontSize: 11, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  code: { fontFamily: "Poppins_600SemiBold", width: 100 },
  name: { flex: 1 },
  qty: { color: "#2E7D32", fontWeight: "bold" },
  balance: { color: muted, fontSize: 11 },
  note: { fontSize: 11, color: muted },
});