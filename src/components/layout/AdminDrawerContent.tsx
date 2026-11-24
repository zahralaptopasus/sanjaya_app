import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLowStock } from '../../context/LowStockContext';
import { useNewMovements } from '../../context/NewMovementsContext';
import { navy, ink, muted } from '../../theme';

type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MENU_ITEMS: MenuItem[] = [
  { route: 'Dashboard', label: 'Dashboard', icon: 'home' },
  { route: 'Inventory', label: 'Inventaris', icon: 'cube' },
  { route: 'Flow', label: 'Aliran Barang', icon: 'swap-vertical' },
  { route: 'Shop', label: 'Online Shop', icon: 'storefront' },
  { route: 'Docs', label: 'Dokumen', icon: 'document' },
  { route: 'PO', label: 'Purchase Order', icon: 'clipboard' },
  { route: 'Suppliers', label: 'Supplier', icon: 'business' },
  { route: 'Orders', label: 'Pesanan', icon: 'receipt' },
  { route: 'Sales', label: 'Penjualan', icon: 'cart' },
  { route: 'Couriers', label: 'Ekspedisi', icon: 'car' },
  { route: 'Print', label: 'Cetak Laporan', icon: 'print' },
  { route: 'Categories', label: 'Kategori', icon: 'folder' },
  { route: 'Carousel', label: 'Slide Banner', icon: 'images' },
];

type AdminDrawerContentProps = DrawerContentComponentProps & {
  onSignOut: () => void;
};

export default function AdminDrawerContent({
  navigation,
  state,
  onSignOut,
}: AdminDrawerContentProps) {
  const insets = useSafeAreaInsets();
  const { count } = useLowStock();
  const { count: newMovementsCount } = useNewMovements();

  // Route tab yang sedang fokus (nested di dalam Drawer.Screen "AdminMain")
  const nested = (state.routes[state.index] as any)?.state;
  const activeRoute: string | undefined =
    nested?.routes?.[nested?.index ?? 0]?.name;

  const go = (route: string) => {
    (navigation as any).navigate('AdminMain', { screen: route });
    navigation.closeDrawer();
  };

  const handleSignOut = () => {
    navigation.closeDrawer();
    if (Platform.OS === 'web') {
      if (window.confirm('Keluar dari akun admin?')) onSignOut();
    } else {
      Alert.alert('Keluar', 'Keluar dari akun admin?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: onSignOut },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header drawer */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../../../assets/images/logosanjaya.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={styles.headerTitle}>SANJAYA</Text>
          <Text style={styles.headerSub}>Admin Panel • Santren Jaya</Text>
        </View>
      </View>

      {/* Daftar menu */}
      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuList}
        showsVerticalScrollIndicator={false}
      >
        {MENU_ITEMS.map((item) => {
          const active = item.route === activeRoute;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => go(item.route)}
              accessibilityRole="button"
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? '#fff' : navy}
              />
              <Text
                style={[styles.menuLabel, active && styles.menuLabelActive]}
              >
                {item.label}
              </Text>
              {item.route === 'Inventory' && count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              )}
              {item.route === 'Flow' && newMovementsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{newMovementsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer: keluar */}
      <TouchableOpacity
        style={[styles.logout, { paddingBottom: insets.bottom + 12 }]}
        onPress={handleSignOut}
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={20} color="#BA1A1A" />
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5DFD1',
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 30, height: 30, borderRadius: 15 },
  headerTitle: {
    color: ink,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  headerSub: {
    color: muted,
    fontSize: 10,
    marginTop: 1,
    fontFamily: 'Inter_500Medium',
  },
  menuScroll: { flex: 1 },
  menuList: { paddingVertical: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginVertical: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  menuItemActive: { backgroundColor: navy },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: ink,
  },
  menuLabelActive: { color: '#fff' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#BA1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 26,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5DFD1',
  },
  logoutText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#BA1A1A',
  },
});