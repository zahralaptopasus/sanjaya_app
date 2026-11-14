// ===== LAPORAN PURCHASE ORDER (PO) =====
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { exportExcel } from "../../lib/exportSheet";
import { navy, ink, muted, bronze } from "../../theme";

interface PoItem {
  id: string;
  po_code: string;
  supplier_name: string;
  supplier_code: string;
  status: string;
  total: number;
  notes?: string;
  created_at: string;
  received_at?: string | null;
  total_ordered: number;
  total_received: number;
  total_returned: number;
  receive_progress_pct: number;
}

export default function ReportsPOScreen() {
  const [pos, setPos] = useState<PoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPos = useCallback(async () => {
    const { data, error } = await supabase
      .from("v_purchase_orders_progress") // view yang sudah ada
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setPos(data as PoItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadPos();
    })();
  }, [loadPos]);

  const exportToExcel = () => {
    const columns = [
      { header: "Kode PO", key: "po_code" },
      { header: "Supplier", key: "supplier_name" },
      { header: "Kode Supplier", key: "supplier_code" },
      { header: "Status", key: "status" },
      { header: "Total Tagihan", key: "total" },
      { header: "Total Order", key: "total_ordered" },
      { header: "Terima", key: "total_received" },
      { header: "Retur", key: "total_returned" },
      { header: "Progress %", key: "receive_progress_pct" },
      { header: "Tanggal Kirim", key: "created_at" },
      { header: "Tanggal Terima", key: "received_at" },
    ];

    const rows = pos.map((po) => ({
      po_code: po.po_code,
      supplier_name: po.supplier_name,
      supplier_code: po.supplier_code,
      status: po.status,
      total: po.total,
      total_ordered: po.total_ordered,
      total_received: po.total_received,
      total_returned: po.total_returned,
      receive_progress_pct: po.receive_progress_pct,
      created_at: po.created_at,
      received_at: po.received_at ?? "-",
    }));

    exportExcel("Laporan-Purchase-Order", "Laporan Purchase Order (PO)", columns, rows);
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk PO belum terimplementasi. Gunakan Excel yang sudah diunduh.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Purchase Order (PO)</Text>
        <Text style={styles.sub}>
          Status pemesanan ke supplier mitra, progres penerimaan unit, estimasi kedatangan, dan total tagihan
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
          pos.map((po) => (
            <View key={po.id} style={styles.row}>
              <Text style={styles.poCode}>{po.po_code}</Text>
              <Text style={styles.supplier}>{po.supplier_name} ({po.supplier_code})</Text>
              <Text style={[styles.status, { color: po.status === "diterima" ? "#2E7D32" : "#B26A00" }]}>
                {po.status}
              </Text>
              <Text style={styles.total}>Rp {po.total?.toLocaleString() ?? "-"}</Text>
              <Text style={styles.progress}>
                {po.receive_progress_pct}% diterima
              </Text>
              <Text style={styles.date}>{po.created_at}</Text>
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
  poCode: { fontFamily: "Poppins_600SemiBold", width: 120 },
  supplier: { flex: 1 },
  status: { fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  total: { fontSize: 12, color: muted },
  progress: { fontSize: 11, color: muted },
  date: { fontSize: 11, color: muted, width: 150 },
});