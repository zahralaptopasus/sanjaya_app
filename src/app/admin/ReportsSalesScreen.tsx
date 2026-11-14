// ===== LAPORAN REKAPITULASI PENJUALAN =====
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import * as ExcelJS from "exceljs";
import * as FileSaver from "file-saver";
import { supabase } from "../../lib/supabase";

interface SalesItem {
  id: string;
  date: string;
  invoice?: string;
  customer?: string;
  subtotal: number;
  payment_method?: string;
  status: "lunas" | "belum lunas" | "pending";
}

export default function ReportsSalesScreen() {
  const [sales, setSales] = useState<SalesItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Coba ambil dari purchase_orders sebagai placeholder, atau table orders jika ada
  const loadSales = async () => {
    try {
      // Coba ambil dari purchase_orders (ini memang pembelian, bukan jual)
      // Tapi kita tampilkan pesan bahwa data penjualan belum tersedia
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, total, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Transform jadi format sales (tapi ini memang data pembelian)
      const transformed = (data || []).map((po: any) => ({
        id: po.id,
        date: po.created_at,
        invoice: po.code,
        customer: "Supplier", // bukan pelanggan
        subtotal: po.total ?? 0,
        payment_method: "Transfer",
        status: po.status === "diterima" ? "lunas" : "pending",
      }));
      setSales(transformed);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      Alert.alert("Data Tidak Tersedia", "Table `orders` untuk laporan penjualan belum dibuat. Struktur laporan siap, butuh table `orders` di Supabase.");
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Sales Report");

    ws.columns = [
      { header: "Tanggal", key: "date", width: 20 },
      { header: "Invoice", key: "invoice", width: 25 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Subtotal", key: "subtotal", width: 20 },
      { header: "Metode Pembayaran", key: "payment_method", width: 25 },
      { header: "Status", key: "status", width: 18 },
    ];

    sales.forEach((s) => {
      ws.addRow({
        date: s.date,
        invoice: s.invoice,
        customer: s.customer,
        subtotal: s.subtotal,
        payment_method: s.payment_method,
        status: s.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    FileSaver.saveAs(blob, "Laporan-Penjualan.xlsx");
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk Penjualan belum terimplementasi. Gunakan Excel yang sudah diunduh.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Rekapitulasi Penjualan</Text>
        <Text style={styles.sub}>
          Rekap seluruh transaksi pesanan per periode tanggal beserta subtotal dan pendapatan bersih.
          <br />
          <small style={{ color: "muted" }>": catatan: Table `orders` belum dibuat, menampilkan data purchase_orders sebagai referensi."</small>
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
          sales.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.date}>{s.date}</Text>
              <Text style={styles.invoice}>{s.invoice}</Text>
              <Text style={styles.customer}>{s.customer}</Text>
              <Text style={styles.subtotal}>Rp {s.subtotal?.toLocaleString() ?? "-"}</Text>
              <Text style={styles.payment}>{s.payment_method ?? "-"}</Text>
              <Text style={styles.status}>
                {s.status === "lunas" ? "Lunas" : "Belum Bayar"}
              </Text>
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
  sub: {
    fontSize: 12,
    color: "muted",
    marginBottom: 12,
    // Include the note inline
  },
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
  date: { fontSize: 12, color: "muted" },
  invoice: { fontFamily: "Poppins_600SemiBold", width: 100 },
  customer: { flex: 1 },
  subtotal: { fontSize: 12, color: "muted" },
  payment: { fontSize: 11, color: "muted" },
  status: { fontSize: 11, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
});