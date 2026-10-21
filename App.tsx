// ===== IMPORT (mengambil library / file yang dibutuhkan) =====

// React + hooks: useEffect (efek samping), useState (state lokal)
import React, { useEffect, useState } from 'react';
// Komponen bawaan React Native: StyleSheet (pembuat style), View (kotak), Text (teks),
// ActivityIndicator (animasi loading), Image (gambar), TouchableOpacity (tombol),
// Alert (kotak dialog), Platform (deteksi OS), useColorScheme (mode terang/gelap sistem)
import {
  StyleSheet,
  View,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
// Hook useFonts (memuat font kustom) + varian font Inter dari Expo Google Fonts
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
// Varian font Poppins untuk heading
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
// Hook untuk inset area aman (poni/home indicator)
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// SplashScreen native (tahan splash sampai font siap)
import * as SplashScreen from 'expo-splash-screen';
// NavigationContainer (wadah navigasi) + tema bawaan
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
// StatusBar (warna ikon status bar)
import { StatusBar } from 'expo-status-bar';
// Navigator tab bawah (bottom tabs)
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Navigator drawer (hamburger menu admin)
import { createDrawerNavigator } from '@react-navigation/drawer';
// GestureHandlerRootView (wajib untuk gesture drawer)
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Navigator tumpukan (stack)
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Kumpulan ikon Ionicons
import { Ionicons } from '@expo/vector-icons';
// Klien Supabase (autentikasi & database)
import { supabase } from './src/lib/supabase';

// ===== STATE STORES =====
// CartProvider & useCart: data keranjang (item, qty, diskon, total, itemCount)
import { CartProvider } from './src/store/cart';
// GuestProvider & useGuest: status mode tamu (tanpa login)
import { GuestProvider, useGuest } from './src/store/guest';
// FavoritesProvider: daftar favorit per user
import { FavoritesProvider } from './src/store/favorites';
// PreferencesProvider + useColors/usePreferences: tema & preferensi
import {
  PreferencesProvider,
  useColors,
  usePreferences,
} from './src/store/preferences';

// ===== CONTEXTS =====
// CategoriesProvider: data master kategori (admin & aktif)
import { CategoriesProvider } from './src/context/CategoriesContext';
// CarouselProvider: data slide carousel
import { CarouselProvider } from './src/context/CarouselContext';
// LowStockProvider: badge jumlah barang dengan stok rendah (badge muncul di drawer)
import { LowStockProvider } from './src/context/LowStockContext';
// NewMovementsProvider: badge movements 24 jam terakhir di tab Flow
import { NewMovementsProvider } from './src/context/NewMovementsContext';
// SuppliersProvider (BARU): master supplier global
import { SuppliersProvider } from './src/context/SuppliersContext';

// ===== LAYAR PELANGGAN (Customer Screens) =====
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ShopScreen from './src/screens/ShopScreen';
import DetailScreen from './src/screens/DetailScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import ReceiptScreen from './src/screens/ReceiptScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import AddressScreen from './src/screens/AddressScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ThemeScreen from './src/screens/ThemeScreen';
import AboutScreen from './src/screens/AboutScreen';
import HelpScreen from './src/screens/HelpScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';

// ===== LAYAR ADMIN (Admin Screens) =====
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminInventoryScreen from './src/screens/admin/AdminInventoryScreen';
import AdminFlowScreen from './src/screens/admin/AdminFlowScreen';
import AdminShopScreen from './src/screens/admin/AdminShopScreen';
import AdminDocsScreen from './src/screens/admin/AdminDocsScreen';
import AdminPOScreen from './src/screens/admin/AdminPOScreen';
import AdminSalesScreen from './src/screens/admin/AdminSalesScreen';
import AdminPrintScreen from './src/screens/admin/AdminPrintScreen';
import AdminCategoriesScreen from './src/screens/admin/AdminCategoriesScreen';
import AdminCarouselScreen from './src/screens/admin/AdminCarouselScreen';
// LAYAR BARU: Kelola Supplier
import AdminSuppliersScreen from './src/screens/admin/AdminSuppliersScreen';

// Palet warna (diperlukan untuk fallback loading screen)
import { navy, lightPalette, darkPalette } from './src/theme';
// Komponen header reusable
import AppHeader from './src/components/layout/AppHeader';
import AdminLogoutButton from './src/components/layout/AdminLogoutButton';
import DrawerMenuButton from './src/components/layout/DrawerMenuButton';
import AdminDrawerContent from './src/components/layout/AdminDrawerContent';

// ===== KONSTANTA NAVIGATOR =====
// Navigator tab bawah (untuk customer & admin)
const Tab = createBottomTabNavigator();
// Navigator tumpukan root (induk semua layar)
const RootStack = createNativeStackNavigator();
// Navigator tumpukan khusus area toko (Shop)
const ShopStackNav = createNativeStackNavigator();
// Navigator drawer admin (hamburger menu)
const AdminDrawerNav = createDrawerNavigator();

// ===== SPLASH SCREEN =====
// Tahan splash native sampai font siap (rekomendasi Expo)
SplashScreen.preventAutoHideAsync().catch(() => {});
// Aktifkan animasi fade saat splash disembunyikan
SplashScreen.setOptions({ fade: true, duration: 400 });

// ===== SHOP STACK (tumpukan layar toko) =====
function ShopStack() {
  return (
    <ShopStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_800ExtraBold' },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
      }}
    >
      <ShopStackNav.Screen
        name="ShopList"
        component={ShopScreen}
        options={{ headerShown: false }}
      />
      <ShopStackNav.Screen
        name="Detail"
        component={DetailScreen}
        options={{ 
          title: 'Detail Produk',
          headerShown: true,
          headerBackVisible: true,
        }}
      />
    </ShopStackNav.Navigator>
  );
}

// ===== CUSTOMER TABS (tab bawah untuk pelanggan) =====
function MainTabs() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarStyle: {
          position: 'absolute',
          left: 1,
          right: 1,
          bottom: Math.max(8, insets.bottom + 8),
          height: 68,
          marginHorizontal: 16,
          borderRadius: 34,
          backgroundColor: c.card,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 8,
          elevation: 12,
          shadowColor: c.shadow,
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        },
      }}
    >
      <Tab.Screen
        name="ShopTab"
        component={ShopStack}
        options={{
          title: 'Belanja',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Keranjang',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Pesanan',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorit"
        component={FavoritesScreen}
        options={{
          title: 'Favorit',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Akun',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ===== AUTHED STACK (pelanggan setelah login) =====
function AuthedStack() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          title: 'Pembayaran',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Receipt"
        component={ReceiptScreen}
        options={{
          title: 'Struk',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="EditProfil"
        component={EditProfileScreen}
        options={{
          title: 'Edit Profil',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Alamat"
        component={AddressScreen}
        options={{
          title: 'Alamat / Kendaraan',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Notifikasi"
        component={NotificationsScreen}
        options={{
          title: 'Notifikasi',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Tema"
        component={ThemeScreen}
        options={{
          title: 'Tema',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Tentang"
        component={AboutScreen}
        options={{
          title: 'Tentang Santren Jaya Motor',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
      <RootStack.Screen
        name="Bantuan"
        component={HelpScreen}
        options={{
          title: 'Pusat Bantuan',
          headerStyle: { backgroundColor: navy } as any,
          headerTintColor: '#fff',
        }}
      />
    </RootStack.Navigator>
  );
}

// ===== ADMIN TABS (menu tab bawah untuk admin) =====
// CATATAN: SuppliersProvider dipasang di AdminStack (parent) sehingga
// context tersedia untuk semua tab admin (termasuk AdminPO yang membaca supplier)
function AdminTabs({ onSignOut }: { onSignOut: () => void }) {
  return (
    <SuppliersProvider>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            display: 'none',
          },
          headerStyle: { backgroundColor: navy },
          headerTintColor: '#fff',
          headerTitle: () => <AppHeader variant='admin' />,
          headerTitleAlign: 'left' as any,
          headerShadowVisible: false,
          headerLeft: () => <DrawerMenuButton />,
          headerRight: () => <AdminLogoutButton onSignOut={onSignOut} />,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={AdminDashboardScreen}
          options={{ title: 'Dashboard' }}
        />
        <Tab.Screen
          name="Inventory"
          component={AdminInventoryScreen}
          options={{ title: 'Inventaris' }}
        />
        <Tab.Screen
          name="Flow"
          component={AdminFlowScreen}
          options={{ title: 'Aliran' }}
        />
        <Tab.Screen
          name="Sales"
          component={AdminSalesScreen}
          options={{ title: 'Penjualan' }}
        />
        <Tab.Screen
          name="PO"
          component={AdminPOScreen}
          options={{ title: 'PO' }}
        />
        <Tab.Screen
          name="Shop"
          component={AdminShopScreen}
          options={{ title: 'Online Shop' }}
        />
        <Tab.Screen
          name="Docs"
          component={AdminDocsScreen}
          options={{ title: 'Dokumen' }}
        />
        <Tab.Screen
          name="Suppliers"
          component={AdminSuppliersScreen}
          options={{ title: 'Supplier' }}
        />
        <Tab.Screen
          name="Print"
          component={AdminPrintScreen}
          options={{ title: 'Cetak' }}
        />
        <Tab.Screen
          name="Categories"
          component={AdminCategoriesScreen}
          options={{ title: 'Kategori' }}
        />
        <Tab.Screen
          name="Carousel"
          component={AdminCarouselScreen}
          options={{ title: 'Slide' }}
        />
      </Tab.Navigator>
    </SuppliersProvider>
  );
}

// ===== ADMIN DRAWER (hamburger menu wrapper) =====
function AdminDrawer({ onSignOut }: { onSignOut: () => void }) {
  return (
    <AdminDrawerNav.Navigator
      drawerContent={(props) => (
        <AdminDrawerContent {...props} onSignOut={onSignOut} />
      )}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: 280, backgroundColor: '#fff' },
        drawerType: 'front',
        swipeEdgeWidth: 50,
      }}
    >
      <AdminDrawerNav.Screen name="AdminMain">
        {() => <AdminTabs onSignOut={onSignOut} />}
      </AdminDrawerNav.Screen>
    </AdminDrawerNav.Navigator>
  );
}

// ===== ADMIN STACK (tumpukan layar area admin) =====
function AdminStack({ onSignOut }: { onSignOut: () => void }) {
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="AdminTabs" options={{ headerShown: false }}>
        {() => <AdminDrawer onSignOut={onSignOut} />}
      </RootStack.Screen>
      <RootStack.Screen
        name="AdminDetail"
        component={AdminInventoryScreen}
        options={{ title: 'Detail Barang' }}
      />
      <RootStack.Screen
        name="AdminCategories"
        component={AdminCategoriesScreen}
        options={{ title: 'Kelola Kategori' }}
      />
      <RootStack.Screen
        name="AdminCarousel"
        component={AdminCarouselScreen}
        options={{ title: 'Kelola Slide' }}
      />
      <RootStack.Screen
        name="AdminSuppliers"
        component={AdminSuppliersScreen}
        options={{ title: 'Kelola Supplier' }}
      />
    </RootStack.Navigator>
  );
}

// ===== LOGIN STACK (tumpukan sebelum login) =====
function LoginStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Welcome" component={WelcomeScreen} />
      <RootStack.Screen name="Login" component={LoginScreen} />
    </RootStack.Navigator>
  );
}

// ===== APP ROOT (komponen utama) =====

export default function App() {
  // State sesi login (null = belum login)
  const [session, setSession] = useState<any>(null);
  // Penanda role admin
  const [isAdmin, setIsAdmin] = useState(false);
  // Mode gelap/terang sistem (untuk fallback loading screen)
  const scheme = useColorScheme();

  // Effect: inisialisasi sesi & listen perubahan auth
  useEffect(() => {
    // Cek role user dari tabel profiles
    const checkRole = async (email: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', email)
        .single();
      setIsAdmin(data?.role === 'admin');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) checkRole(session.user.email);
      else setIsAdmin(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user?.email) checkRole(s.user.email);
      else setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Logout
  const handleSignOut = () => {
    setIsAdmin(false);
    setSession(null);
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  };

  // Font loading
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // Sembunyikan splash saat font siap
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hide();
  }, [fontsLoaded, fontError]);

  // Loading screen saat font belum siap
  if (!fontsLoaded && !fontError) {
    const loadingBg = scheme === 'dark' ? darkPalette.bg : lightPalette.bg;
    return (
      <View style={[styles.center, { backgroundColor: loadingBg }]}>
        <ActivityIndicator size="large" color={navy} />
      </View>
    );
  }

  // ===== PROVIDER TREE =====
  // Urutan: Guest → Preferences → Cart → Favorites → LowStock → Categories → Carousel → Suppliers
  // SuppliersProvider GLOBAL (lingkari seluruh aplikasi) sehingga AdminPO, AdminSuppliers,
  // dan komponen lain di seluruh tree bisa mengakses useSuppliers()
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GuestProvider>
        <PreferencesProvider>
          <CartProvider>
            <FavoritesProvider>
              <LowStockProvider>
                <NewMovementsProvider>
                  <CategoriesProvider>
                    <CarouselProvider>
                      <SuppliersProvider>
                        <AppRoot
                          session={!!session}
                          isAdmin={isAdmin}
                          onSignOut={handleSignOut}
                        />
                      </SuppliersProvider>
                    </CarouselProvider>
                  </CategoriesProvider>
                </NewMovementsProvider>
              </LowStockProvider>
            </FavoritesProvider>
          </CartProvider>
        </PreferencesProvider>
      </GuestProvider>
    </GestureHandlerRootView>
  );
}

// AppRoot: pembungkus NavigationContainer (butuh usePreferences → di dalam PreferencesProvider)
function AppRoot({
  session,
  isAdmin,
  onSignOut,
}: {
  session: boolean;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const { isDark, colors } = usePreferences();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.accent,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppRoutes session={session} isAdmin={isAdmin} onSignOut={onSignOut} />
    </NavigationContainer>
  );
}

// AppRoutes: pilih stack berdasarkan status login & role
function AppRoutes({
  session,
  isAdmin,
  onSignOut,
}: {
  session: boolean;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const { isGuest } = useGuest();
  // Belum login & bukan tamu → tampilkan login
  if (!session && !isGuest) return <LoginStack />;
  // Admin → tampilkan stack admin
  if (isAdmin) return <AdminStack onSignOut={onSignOut} />;
  // Lainnya (pelanggan login / tamu) → tampilkan stack pelanggan
  return <AuthedStack />;
}

// ===== STYLES =====
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});