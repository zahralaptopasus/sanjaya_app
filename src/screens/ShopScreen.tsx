import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Linking,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getProducts } from "../repo";
import type { Product } from "../models";
import { useCart } from "../store/cart";
import { shopSearchBus } from "../lib/searchBus";
import { useGuest } from "../store/guest";
import { useFavorites } from "../store/favorites";
import { useCategories } from "../context/CategoriesContext";
import { useCarousel } from "../context/CarouselContext";
import QtySheet from "../components/QtySheet";
import PageLoader from "../components/PageLoader";
import { useColors } from "../store/preferences";
import type { Palette } from "../theme";
import { SafeAreaView } from "react-native-safe-area-context";

import CarouselSlider from "../components/shop/CarouselSlider";
import ProductCard from "../components/shop/ProductCard";
import { SearchBar } from "../components/shop/SearchBar";
import CategoryChips from "../components/shop/CategoryChips";
import { makeCommonStyles } from "../styles/commonStyles";
import { getRootNav } from "../lib/navigationHelpers";

export default function ShopScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [qtyProduct, setQtyProduct] = useState<Product | null>(null);

  const fav = useFavorites();
  const { activeCategories } = useCategories();
  const { activeSlides } = useCarousel();
  const cart = useCart();
  const { isGuest, exit } = useGuest();
  const c = useColors();
  const { width } = useWindowDimensions();
  const cardW = (width - 16 * 2 - 14) / 2;

  const searchRef = useRef<any>(null);
  const listRef = useRef<FlatList>(null);
  const headerHRef = useRef(0);

  const common = useMemo(() => makeCommonStyles(c), [c]);
  const styles = useMemo(() => makeStyles(c), [c]);

  const promptLogin = () => {
    Alert.alert(
      "Login Dulu",
      "Kamu perlu login untuk menambah barang ke keranjang.",
      [
        { text: "Nanti", style: "cancel" },
        {
          text: "Login",
          onPress: () => {
            cart.clear();
            exit();
          },
        },
      ],
    );
  };

  useEffect(() => {
    getProducts().then((p) => {
      setProducts(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const off = shopSearchBus.subscribe(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      setTimeout(() => searchRef.current?.focus(), 250);
    });
    return () => off();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const p = await getProducts();
    setProducts(p);
    setRefreshing(false);
  };

  const onToggleFav = (id: string) => {
    if (isGuest) {
      promptLogin();
      return;
    }
    fav.toggle(id);
  };

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (!q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.code.toLowerCase().includes(q.toLowerCase())) &&
          (cat === "Semua" || p.category === cat),
      ),
    [products, q, cat],
  );

  if (loading) return <PageLoader />;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.primary, paddingTop: 12 }}
      edges={["top"]}
    >
      <View style={common.screenHeader}>
        <View style={common.headerRow}>
          <View style={common.headerBrand}>
            <View style={common.logoCircle}>
              <Image
                source={require("../../assets/images/logosanjaya.png")}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={common.headerTitle}>SANJAYA</Text>
              <Text style={common.headerSubtitle}>Santren Jaya Motor</Text>
            </View>
          </View>
          <View style={common.headerActions}>
            <TouchableOpacity
              style={common.headerButton}
              onPress={() => getRootNav(navigation).navigate("Cart")}
            >
              <Ionicons name="cart" size={18} color="#fff" />
              {cart.itemCount > 0 && (
                <View style={common.cartBadge}>
                  <Text style={common.cartBadgeText}>
                    {cart.itemCount > 99 ? "99+" : cart.itemCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={common.headerButton}
              onPress={() => searchRef.current?.focus()}
            >
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={common.headerButton}
              onPress={() => getRootNav(navigation).navigate("Profile")}
            >
              <Ionicons name="settings-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={common.accentLine} />
      </View>

      <FlatList
        ref={listRef}
        style={{ backgroundColor: c.bg, flex: 1 }}
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
        ListHeaderComponent={
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) headerHRef.current = h;
            }}
          >
            {/* Membungkus CarouselSlider dengan View bernilai marginTop */}
            <View style={{ marginTop: 12}}>
              <CarouselSlider
                slides={activeSlides}
                onSlidePress={(s) => {
                  if (s.action_type === "coupon") {
                    cart.applyCoupon(s.action_value ?? "SANJAYABERKAH");
                    Alert.alert(
                      "Kupon Terpasang",
                      "Diskon akan otomatis diterapkan di keranjang.",
                      [
                        {
                          text: "Lihat Keranjang",
                          onPress: () => navigation.navigate("Cart"),
                        },
                        { text: "Oke", style: "cancel" },
                      ],
                    );
                  } else if (
                    s.action_type === "shop" ||
                    s.action_type === "products"
                  ) {
                    setQ("");
                    
                    setCat("Semua");
                    const target =
                      headerHRef.current > 0 ? headerHRef.current : 0;
                    listRef.current?.scrollToOffset({
                      offset: target,
                      animated: true,
                    });
                  } else if (s.action_type === "url" && s.action_value) {
                    Linking.openURL(s.action_value).catch(() =>
                      Alert.alert("Gagal", "Tidak bisa membuka tautan."),
                    );
                  }
                }}
              />
            </View>
            <SearchBar
              ref={searchRef}
              value={q}
              onChangeText={setQ}
              onClear={() => setQ("")}
            />
            <CategoryChips
              categories={activeCategories}
              selected={cat}
              onSelect={setCat}
            />
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Produk Unggulan</Text>
              <TouchableOpacity
                onPress={() => {
                  setCat("Semua");
                  setQ("");
                }}
              >
                <Text style={styles.sectionLink}>Lihat Semua</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            width={cardW}
            onPress={() =>
              isGuest
                ? promptLogin()
                : navigation.navigate("Detail", { product: item })
            }
            onAddCart={() => (isGuest ? promptLogin() : setQtyProduct(item))}
            onToggleFav={() => onToggleFav(item.id)}
            isFavorite={fav.isFav(item.id)}
          />
        )}
        columnWrapperStyle={{ gap: 14 }}
        numColumns={2}
        ListEmptyComponent={
          <Text
            style={{ textAlign: "center", color: c.textMuted, marginTop: 40 }}
          >
            Part nggak ketemu.
          </Text>
        }
      />

      {qtyProduct ? (
        <QtySheet
          product={qtyProduct}
          onClose={() => setQtyProduct(null)}
          onConfirm={(n) => {
            cart.add(qtyProduct, n);
            setQtyProduct(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    list: { padding: 16, paddingBottom: 110 },
    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginTop: 10,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_800ExtraBold",
      color: c.text,
    },
    sectionLink: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: c.primary,
    },
  });
