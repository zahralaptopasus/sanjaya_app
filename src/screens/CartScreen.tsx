import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../store/cart";
import { useGuest } from "../store/guest";
import { type Palette } from "../theme";
import { useColors } from "../store/preferences";
import CartItemCard from "../components/cart/CartItemCard";
import CartSummary from "../components/cart/CartSummary";
import { makeCommonStyles } from "../styles/commonStyles";
import { getRootNav } from "../lib/navigationHelpers";

export default function CartScreen({ navigation }: any) {
  const cart = useCart();
  const { isGuest, exit } = useGuest();
  const c = useColors();
  const common = useMemo(() => makeCommonStyles(c), [c]);
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const bottomClearance = Math.max(12, insets.bottom + 8) + 68 + 8;

  const handleCheckout = () => {
    if (isGuest) {
      Alert.alert("Login Dulu", "Kamu perlu login dulu untuk melakukan pembelian.", [
        { text: "Nanti", style: "cancel" },
        { text: "Login", onPress: () => { cart.clear(); exit(); } },
      ]);
      return;
    }
    getRootNav(navigation).navigate("Checkout");
  };

  const confirmRemoveSelected = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Hapus item yang dipilih dari keranjang?")) cart.removeSelected();
      return;
    }
    Alert.alert("Hapus terpilih", "Hapus item yang dipilih dari keranjang?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => cart.removeSelected() },
    ]);
  };

  const toggleAll = () => {
    if (cart.allSelected) cart.clearSelection();
    else cart.selectAll();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={common.screenHeader}>
          <Text style={common.headerTitle}>Keranjang Saya</Text>
          <Text style={common.headerSubtitle}>{cart.items.length} item di keranjang</Text>
          <View style={common.accentLine} />
        </View>

        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {cart.items.length > 0 && (
            <View style={styles.selectBar}>
              <TouchableOpacity style={styles.selectAllBtn} onPress={toggleAll}>
                <Ionicons name={cart.allSelected ? "checkbox" : "square-outline"} size={20} color={c.primary} />
                <Text style={styles.selectAllText}>Pilih Semua</Text>
              </TouchableOpacity>
              {cart.selectedCount > 0 && (
                <TouchableOpacity onPress={confirmRemoveSelected}>
                  <Text style={styles.removeSelText}>Hapus terpilih</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={cart.items}
            keyExtractor={(i) => i.product.id}
            renderItem={({ item, index }) => (
              <CartItemCard
                item={item}
                index={index}
                isSelected={cart.selectedIds.includes(item.product.id)}
                onToggleSelect={() => cart.toggleSelect(item.product.id)}
                onInc={() => cart.inc(index)}
                onDec={() => cart.dec(index)}
                onSetQty={(n) => cart.setQty(index, n)}
                onRemove={() => cart.remove(index)}
              />
            )}
            style={{ backgroundColor: c.bg, flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 48 }}>
                <Ionicons name="cart-outline" size={40} color={c.textFaint} />
                <Text style={{ textAlign: "center", marginTop: 12, fontFamily: "Inter_700Bold", fontSize: 15, color: c.text }}>
                  Keranjang kosong
                </Text>
                <Text style={{ textAlign: "center", marginTop: 4, color: c.textMuted, fontSize: 13 }}>
                  Tambah sparepart dari toko
                </Text>
              </View>
            }
          />

          <CartSummary
            subtotal={cart.selectedSubtotal}
            discount={cart.selectedDiscount}
            total={cart.selectedTotal}
            selectedCount={cart.selectedCount}
            onCheckout={handleCheckout}
            onApplyCoupon={(code) => cart.applyCoupon(code)}
            bottomClearance={bottomClearance}
            isGuest={isGuest}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.primary },
    selectBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    selectAllBtn: { flexDirection: "row", alignItems: "center" },
    selectAllText: { marginLeft: 6, fontSize: 13, fontFamily: "Inter_700Bold", color: c.primary },
    removeSelText: { fontSize: 13, fontFamily: "Inter_700Bold", color: c.danger },
  });