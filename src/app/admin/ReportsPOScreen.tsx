// ===== LAPORAN PURCHASE ORDER (PO) =====
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import * as ExcelJS from "exceljs";
import * as FileSaver from "file-saver";
import { supabase } from "../../lib/supabase";

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

  const loadPos = async () => {
    const { data, error } = await supabase
      .from("v_purchase_orders_progress") // view yang sudah ada
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setPos(data as PoItem[]);
    setLoading(false);
  };

  useEffect(() => {
    loadPos();
  }, []);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("PO Report");

    ws.columns = [
      { header: "Kode PO", key: "po_code", width: 20 },
      { header: "Supplier", key: "supplier_name", width: 30 },
      { header: "Kode Supplier", key: "supplier_code", width: 15 },
      { header: "Status", key: "status", width: 18 },
      { header: "Total Tagihan", key: "total", width: 20 },
      { header: "Total Order", key: "total_ordered", width: 15 },
      { header: "Terima", key: "total_received", width: 15 },
      { header: "Retur", key: "total_returned", width: 15 },
      { header: "Progress %", key: "receive_progress_pct", width: 15 },
      { header: "Tanggal Kirim", key: "created_at", width: 25 },
      { header: "Tanggal Terima", key: "received_at", width: 25 },
    ];

    pos.forEach((po) => {
      ws.addRow({
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
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    FileSaver.saveAs(blob, "Laporan-Purchase-Order.xlsx");
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk PO belum terimplementasi. Gunakan Excel yang sudah diunduh.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Purchase Order (PO)</Text>
        <Text style={styles.sub}>
          Status pemesanan ke supplier mitra, progres penerimaan unit, estimasi kedatangan, dan total tagihan
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button title="Unduh Excel" onPress={exportToExcel} color="primary" />
        <Button title="Unduh PDF" onPress={exportToPDF} color="secondary" />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />
        ) : (
          pos.map((po) => (
            <View key={po.id} style={styles.row}>
              <Text style={styles.poCode}>{po.po_code}</Text>
              <Text style={styles.supplier}>{po.supplier_name} ({po.supplier_code})</Text>
              <Text style={styles.status} color={po.status === "diterima" ? "green" : "orange"}>
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
  title: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "ink" },
  sub: { fontSize: 12, color: "muted", marginBottom: 12 },
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
  total: { fontSize: 12, color: "muted" },
  progress: { fontSize: 11, color: "muted" },
  date: { fontSize: 11, color: "muted", width: 150 },
});