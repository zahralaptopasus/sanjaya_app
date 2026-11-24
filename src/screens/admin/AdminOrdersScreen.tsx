// ===== IMPORT =====
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminGetOrders, adminUpdateOrderStatus, type AdminOrderRow } from '../../lib/admin';
import { rp } from '../../lib/format';
import { navy, surface, cardBg, chipBg, muted, ink, amber } from '../../theme';

// label + warna badge per status
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Menunggu', bg: '#FFF4D6', color: '#7A5A00' },
  paid: { label: 'Lunas', bg: '#DFF5E1', color: '#1B7A2E' },
  dikirim: { label: 'Dikirim', bg: '#DCE9FF', color: '#0B3D91' },
  selesai: { label: 'Selesai', bg: '#E6E1F7', color: '#4527A0' },
  failed: { label: 'Gagal', bg: '#FFEBEB', color: '#BA1A1A' },
  cancelled: { label: 'Dibatalkan', bg: '#FFEBEB', color: '#BA1A1A' },
};

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // modal kirim: pesanan + input resi
  const [shipOrder, setShipOrder] = useState<AdminOrderRow | null>(null);
  const [resi, setResi] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const rows = await adminGetOrders();
    setOrders(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ubah status sederhana (paid / selesai)
  const setStatus = async (o: AdminOrderRow, status: 'paid' | 'selesai') => {
    if (status === 'selesai' && !o.shippingAddress) {
      // tanpa alamat tidak ada pengiriman, jadi Kirim dilewati
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Selesaikan pesanan?', 'Pesanan ini tanpa alamat pengiriman.', [
          { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Selesai', onPress: () => resolve(true) },
        ]),
      );
      if (!ok) return;
    }
    const res = await adminUpdateOrderStatus(o.id, status);
    if (res.error) { Alert.alert('Gagal', res.error); return; }
    await load();
  };

  // buka modal kirim (butuh resi)
  const openShip = (o: AdminOrderRow) => {
    setShipOrder(o);
    setResi(o.trackingNumber ?? '');
  };

  const closeShip = () => {
    setShipOrder(null);
    setResi('');
  };

  const submitShip = async () => {
    if (!shipOrder) return;
    // resi opsional: boleh kosong, status tetap dikirim
    const t = resi.trim();
    setSaving(true);
    try {
      const res = await adminUpdateOrderStatus(shipOrder.id, 'dikirim', t || null);
      if (res.error) throw new Error(res.error);
      closeShip();
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa ubah status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: 'center' }} />;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: surface }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={navy} />}
      >
        <Text style={styles.header}>Kelola Pesanan</Text>
        <Text style={styles.sub}>Ubah status: Lunas → Dikirim (isi resi) → Selesai. COD langsung lunas saat pesanan dibuat. Tarik ke bawah untuk refresh.</Text>

        {orders.length === 0 ? (
          <Text style={styles.empty}>Belum ada pesanan.</Text>
        ) : (
          orders.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, bg: chipBg, color: muted };
            return (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{o.code}</Text>
                    <Text style={styles.meta}>{o.itemCount} item • {o.paymentMethod === 'cod' ? 'COD' : 'Midtrans'}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                <Text style={styles.total}>{rp(o.total)}</Text>

                {o.shippingAddress ? (
                  <Text style={styles.addr}>
                    Kirim ke: {o.shippingName ?? '-'} {o.shippingPhone ? `(${o.shippingPhone})` : ''}
                    {'\n'}{o.shippingAddress}
                    {o.courierName ? `\n${o.courierName} • Ongkir ${rp(o.shippingCost)}` : ''}
                    {o.trackingNumber ? `\nResi: ${o.trackingNumber}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.addr}>Tanpa alamat pengiriman</Text>
                )}

                <View style={styles.actions}>
                  {o.status === 'pending' && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#DFF5E1' }]} onPress={() => setStatus(o, 'paid')}>
                      <Text style={[styles.btnText, { color: '#1B7A2E' }]}>Tandai Lunas</Text>
                    </TouchableOpacity>
                  )}
                  {(o.status === 'paid' || o.status === 'pending') && !!o.shippingAddress && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#DCE9FF' }]} onPress={() => openShip(o)}>
                      <Text style={[styles.btnText, { color: navy }]}>Kirim</Text>
                    </TouchableOpacity>
                  )}
                  {o.status === 'dikirim' && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#E6E1F7' }]} onPress={() => setStatus(o, 'selesai')}>
                      <Text style={[styles.btnText, { color: '#4527A0' }]}>Tandai Selesai</Text>
                    </TouchableOpacity>
                  )}
                  {o.status === 'paid' && !o.shippingAddress && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#E6E1F7' }]} onPress={() => setStatus(o, 'selesai')}>
                      <Text style={[styles.btnText, { color: '#4527A0' }]}>Tandai Selesai</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===== MODAL KIRIM (ISI RESI) ===== */}
      <Modal visible={!!shipOrder} animationType="slide" transparent onRequestClose={closeShip}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeShip} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kirim Pesanan</Text>
              <TouchableOpacity onPress={closeShip}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{shipOrder?.code}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nomor resi pengiriman (opsional)"
              placeholderTextColor={muted}
              value={resi}
              onChangeText={setResi}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeShip}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={submitShip} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Menyimpan...' : 'Kirim'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 20, fontFamily: 'Poppins_800ExtraBold', color: ink },
  sub: { fontSize: 12, color: muted, marginTop: 2, marginBottom: 16 },
  empty: { textAlign: 'center', color: muted, marginTop: 40, fontSize: 13 },

  card: { backgroundColor: cardBg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5DFD1' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  code: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: ink },
  meta: { fontSize: 11, color: muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_800ExtraBold' },
  total: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: navy, marginTop: 8 },
  addr: { fontSize: 11, color: muted, marginTop: 6, lineHeight: 16 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontSize: 12, fontFamily: 'Inter_800ExtraBold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },
  modalSub: { fontSize: 12, color: muted, marginBottom: 14 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5DFD1' },
  modalCancelBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: amber, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
});
