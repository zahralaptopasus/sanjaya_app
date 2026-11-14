// ===== LAPORAN INVENTORY & NILAI PERSIDANAN =====
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Button, Alert } from "react-native";
import * as ExcelJS from "exceljs";
import * as FileSaver from "file-saver";
import { supabase } from "../../lib/supabase";
import { useCategories } from "../../context/CategoriesContext";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  purchasePrice: number;
  stock: number;
  initialStock: number;
  location: string;
  image?: string | null;
}

interface Category {
  id: string;
  label: string;
}

export default function ReportsInventoryScreen() {
  const { activeCategories } = useCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Ambil produk dari Supabase
  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw error;
    setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Ekspor ke Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory Report");

    // Header
    worksheet.columns = [
      { header: "Kode Produk", key: "code", width: 20 },
      { header: "Nama Produk", key: "name", width: 40 },
      { header: "Kategori", key: "category", width: 25 },
      { header: "Satuan", key: "unit", width: 12 },
      { header: "Stok Fisik", key: "stock", width: 15 },
      { header: "Harga Modal (Rp)", key: "purchasePrice", width: 20 },
      { header: "Harga Jual (Rp)", key: "price", width: 20 },
      { header: "Lokasi", key: "location", width: 25 },
      { header: "Nilai Persediaan (Rp)", key: "nilai", width: 25 },
    ];

    // Hitung total nilai
    let totalNilai = 0;
    let totalHargaJual = 0;

    products.forEach((p) => {
      const nilai = p.stock * p.purchasePrice;
      const hargaJual = p.stock * p.price;
      totalNilai += nilai;
      totalHargaJual += hargaJual;
      worksheet.addRow({
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stock: p.stock,
        purchasePrice: p.purchasePrice,
        price: p.price,
        location: p.location,
        nilai: nilai,
      });
    });

    // Total di baris terakhir
    worksheet.addRow({
      code: "",
      name: "TOTAL",
      category: "",
      unit: "",
      stock: products.reduce((s, p) => s + p.stock, 0),
      purchasePrice: "",
      price: "",
      location: "",
      nilai: totalNilai,
    });
    // Style baris total
    const totalRow = worksheet.getRow(worksheet.rowCount);
    totalRow.font = { bold: true };
    totalRow.fill = { fgColor: "DDDDDD" };

    // Format uang
    worksheet.getColumn("purchasePrice").numFormat = "#,##0";
    worksheet.getColumn("price").numFormat = "#,##0";
    worksheet.getColumn("nilai").numFormat = "#,##0";

    // Unduh
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    FileSaver.saveAs(blob, "Laporan-Inventory- dan-Nilai-Persediaan.xlsx");
  };

  // Ekspor ke PDF (sederhana: tampilkan tabel dalam PDF)
  const exportToPDF = async () => {
    // Untuk PDF sederhana, kita generate string tabel lalu pake library atau alert
    // Di sini kita pakai ekspor ke Excel lalu convert sederhana via alert link
    // atau bisa pakai library seperti react-native-pdf (butuh config native)
    // Untuk sekarang, kita arahkan ke Excel dan beri info PDF
    Alert.alert(
      "PDF",
      "Ekspor PDF belum terimplementasi (butuh library native). Gunakan format Excel yang sudah diunduh.",
      [{ text: "OK" }]
    );
  };

  if (loading)
    return <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Laporan Inventory & Nilai Persediaan</Text>
        <Text style={styles.sub}>
          Daftar seluruh SKU produk, lokasi rak, stok fisik, harga modal, harga jual, dan status minimum
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button title="Unduh Excel" onPress={exportToExcel} color="primary" />
        <Button title="Unduh PDF" onPress={exportToPDF} color="secondary" />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <ActivityIndicator size="large" color="navy" style={{ flex: 1, justifyContent: "center" }} />
        {products.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.code}>{p.code}</Text>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.category}>{activeCategories.find((c) => c.id === p.category)?.label ?? p.category}</Text>
            <Text style={styles.unit}>{p.unit}</Text>
            <Text style={styles.stock}>{p.stock} {p.unit}</Text>
            <Text style={styles.priceRp}>Rp {p.purchasePrice.toLocaleString()}</Text>
            <Text style={styles.priceRp2}>Rp {p.price.toLocaleString()}</Text>
            <Text style={styles.location}>{p.location}</Text>
            <Text style={styles.nilai}>Rp {(p.stock * p.purchasePrice).toLocaleString()}</Text>
          </View>
        ))}
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
  code: { fontFamily: "Poppins_600SemiBold", width: 120 },
  name: { flex: 1, marginHorizontal: 8 },
  category: { width: 100 },
  unit: { width: 50 },
  stock: { width: 60 },
  priceRp: { fontSize: 11, color: "muted" },
  priceRp2: { fontSize: 11, color: "ink", fontFamily: "Poppins_600SemiBold" },
  location: { width: 140 },
  nilai: { fontSize: 11, color: "muted", textAlign: "right" },
});