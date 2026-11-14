// ===== REKAPITULASI FAKTUR & PESANAN =====
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import * as ExcelJS from "exceljs";
import * as FileSaver from "file-saver";
import { supabase } from "../../lib/supabase";

interface InvoiceItem {
  id: string;
  date: string;
  invoice_number: string;
  customer: string;
  amount: number;
  status: "lunas" | "belum lunas" | "pending";
  payment_method?: string;
}

export default function ReportsInvoicesScreen() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, order_id, code, customer, amount, status, payment_method, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const transformed = (data || []).map((i: any) => ({
        id: i.id,
        date: i.created_at,
        invoice_number: i.code,
        customer: i.customer,
        amount: i.amount ?? 0,
        status: i.status,
        payment_method: i.payment_method,
      }));
      setInvoices(transformed);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      Alert.alert("Error", "Gagal load data invoices: " + (e?.message ?? ""));
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Invoices Report");

    ws.columns = [
      { header: "Tanggal", key: "date", width: 20 },
      { header: "No. Faktur", key: "invoice_number", width: 25 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Amount", key: "amount", width: 20 },
      { header: "Metode Pembayaran", key: "payment_method", width: 25 },
      { header: "Status", key: "status", width: 18 },
    ];

    invoices.forEach((inv) => {
      ws.addRow({
        date: inv.date,
        invoice_number: inv.invoice_number,
        customer: inv.customer,
        amount: inv.amount,
        payment_method: inv.payment_method ?? "-",
        status: inv.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    FileSaver.saveAs(blob, "Laporan-Faktur-dan-Pesanan.xlsx");
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk Faktur & Pesanan belum terimplementasi. Gunakan Excel.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Rekapitulasi Faktur & Pesanan</Text>
        <Text style={styles.sub}>
          Rincian detail pesanan pelanggan, nomor nota tagihan, dan status pembayaran lunas.
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
          invoices.map((inv) => (
            <View key={inv.id} style={styles.row}>
              <Text style={styles.date}>{inv.date}</Text>
              <Text style={styles.invoice_number}>{inv.invoice_number}</Text>
              <Text style={styles.customer}>{inv.customer}</Text>
              <Text style={styles.amount}>Rp {inv.amount?.toLocaleString() ?? "-"}</Text>
              <Text style={styles.payment}>{inv.payment_method ?? "-"}</Text>
              <Text style={styles.status}>
                {inv.status === "lunas" ? "Lunas" : "Belum Bayar"}
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
  date: { fontSize: 12, color: "muted" },
  invoice_number: { fontFamily: "Poppins_600SemiBold", width: 100 },
  customer: { flex: 1 },
  amount: { fontSize: 12, color: "muted" },
  payment: { fontSize: 11, color: "muted" },
  status: { fontSize: 11, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
});