// ===== LAPORAN PENGIRIMAN & EKSPEDISI =====
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { exportExcel } from "../../lib/exportSheet";
import { navy, ink, muted, bronze } from "../../theme";

interface ShippingItem {
  id: string;
  date: string;
  customer: string;
  address: string;
  courier?: string;
  tracking_number?: string;
  status: "dikirim" | "dalam_perjalanan" | "tiba" | "batal";
}

export default function ReportsShippingScreen() {
  const [shipments, setShipments] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShipments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, order_id, customer, address, courier, tracking_number, status, shipped_at, delivered_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const transformed = (data || []).map((s: any) => ({
        id: s.id,
        date: s.created_at,
        customer: s.customer,
        address: s.address ?? "-",
        courier: s.courier ?? "-",
        tracking_number: s.tracking_number ?? "-",
        status: s.status,
      }));
      setShipments(transformed);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      Alert.alert("Error", "Gagal load data shipments: " + ((e as Error)?.message ?? ""));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadShipments();
    })();
  }, [loadShipments]);

  const exportToExcel = () => {
    const columns = [
      { header: "Tanggal", key: "date" },
      { header: "Customer", key: "customer" },
      { header: "Alamat", key: "address" },
      { header: "Kurir", key: "courier" },
      { header: "No. Resi", key: "tracking_number" },
      { header: "Status", key: "status" },
    ];

    const rows = shipments.map((s) => ({
      date: s.date,
      customer: s.customer,
      address: s.address,
      courier: s.courier,
      tracking_number: s.tracking_number,
      status: s.status,
    }));

    exportExcel("Laporan-Pengiriman-dan-Ekspedisi", "Laporan Pengiriman & Ekspedisi", columns, rows);
  };

  const exportToPDF = async () => {
    Alert.alert(
      "PDF",
      "Ekspor PDF untuk Pengiriman & Ekspedisi belum terimplementasi. Gunakan Excel.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Pengiriman & Ekspedisi</Text>
        <Text style={styles.sub}>
          Daftar pengiriman, alamat pelanggan, pilihan kurir, nomor resi pengiriman, dan status kiriman
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
          shipments.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.date}>{s.date}</Text>
              <Text style={styles.customer}>{s.customer}</Text>
              <Text style={styles.address}>{s.address}</Text>
              <Text style={styles.courier}>{s.courier}</Text>
              <Text style={styles.tracking}>{s.tracking_number}</Text>
              <Text style={styles.status}>{s.status}</Text>
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
  customer: { flex: 1 },
  address: { fontSize: 11, color: muted, flex: 1 },
  courier: { width: 80 },
  tracking: { width: 120 },
  status: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});