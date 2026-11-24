// ===== IMPORT =====
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminGetAllCouriers, adminAddCourier, adminUpdateCourier, adminDeleteCourier, type AdminCourier } from '../../lib/admin';
import { rp } from '../../lib/format';
import { navy, surface, cardBg, chipBg, muted, ink, amber } from '../../theme';

// ===== KOMPONEN UTAMA =====
export default function AdminCouriersScreen() {
  const [couriers, setCouriers] = useState<AdminCourier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourier, setEditCourier] = useState<AdminCourier | null>(null);

  // form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // muat daftar ekspedisi
  const load = useCallback(async () => {
    const rows = await adminGetAllCouriers();
    setCouriers(rows);
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

  const openAdd = () => {
    setName('');
    setPrice('');
    setDescription('');
    setIsActive(true);
    setEditCourier(null);
    setModalOpen(true);
  };

  const openEdit = (r: AdminCourier) => {
    setName(r.name);
    setPrice(String(r.price));
    setDescription(r.description ?? '');
    setIsActive(r.isActive);
    setEditCourier(r);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setName('');
    setPrice('');
    setDescription('');
    setIsActive(true);
    setEditCourier(null);
  };

  const handleSave = async () => {
    const n = name.trim();
    const p = parseInt(price.replace(/[^0-9]/g, ''), 10);
    if (!n) { Alert.alert('Nama ekspedisi wajib diisi'); return; }
    if (!Number.isFinite(p) || p < 0) { Alert.alert('Harga ekspedisi tidak valid'); return; }
    setSaving(true);
    try {
      if (editCourier) {
        const res = await adminUpdateCourier(editCourier.id, { name: n, price: p, description: description.trim() || null, isActive });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await adminAddCourier({ name: n, price: p, description: description.trim() || null, isActive });
        if ('error' in res) throw new Error(res.error);
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa simpan ekspedisi');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (r: AdminCourier) => {
    const res = await adminDeleteCourier(r.id);
    if (res.error) { Alert.alert('Gagal', res.error); return; }
    await load();
  };

  const handleDelete = (r: AdminCourier) => {
    const msg = `Hapus ekspedisi "${r.name}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete(r);
      return;
    }
    Alert.alert('Hapus Ekspedisi', msg, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => doDelete(r) },
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={navy} style={{ flex: 1, justifyContent: 'center' }} />;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: surface }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={navy} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.header}>Kelola Ekspedisi</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Atur nama & ongkir ekspedisi. Tarik ke bawah untuk refresh.</Text>

        {couriers.length === 0 ? (
          <Text style={styles.empty}>Belum ada ekspedisi. Tambah di atas.</Text>
        ) : (
          couriers.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.avatarWrapper}>
                <Ionicons name="car" size={20} color={navy} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.rowLabel, !r.isActive && styles.rowLabelInactive]}>{r.name}</Text>
                  {!r.isActive && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Nonaktif</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowMeta}>Ongkir: {rp(r.price)}</Text>
                {r.description ? <Text style={styles.rowDesc}>{r.description}</Text> : null}
              </View>
              <View style={styles.actions}>
                <Switch
                  value={r.isActive}
                  onValueChange={() => { void adminUpdateCourier(r.id, { isActive: !r.isActive }).then(load); }}
                  thumbColor={r.isActive ? '#261A00' : '#fff'}
                  trackColor={{ false: '#FFEBEB', true: amber }}
                />
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(r)}>
                  <Ionicons name="create" size={20} color={navy} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(r)}>
                  <Ionicons name="trash" size={20} color="#BA1A1A" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT EKSPEDISI ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editCourier ? 'Edit Ekspedisi' : 'Tambah Ekspedisi'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama ekspedisi (contoh: JNE, J&T)"
                placeholderTextColor={muted}
                value={name}
                onChangeText={setName}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Harga ongkir (Rp)"
                placeholderTextColor={muted}
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Deskripsi (opsional, contoh: estimasi 2-3 hari)"
                placeholderTextColor={muted}
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.modalSwitchRow}>
                <Text style={styles.modalSwitchLabel}>Aktif</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  thumbColor="#261A00"
                  trackColor={{ false: '#FFEBEB', true: amber }}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Menyimpan...' : editCourier ? 'Update' : 'Tambah'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  header: { fontSize: 20, fontFamily: 'Poppins_800ExtraBold', color: ink },
  sub: { fontSize: 12, color: muted, marginBottom: 16 },
  empty: { textAlign: 'center', color: muted, marginTop: 40, fontSize: 13 },
  addBtn: { backgroundColor: amber, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5DFD1' },
  avatarWrapper: { width: 44, height: 44, borderRadius: 10, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: ink },
  rowLabelInactive: { textDecorationLine: 'line-through', color: muted },
  inactiveBadge: { backgroundColor: '#FFEBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inactiveBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#BA1A1A' },
  rowMeta: { fontSize: 12, color: navy, marginTop: 2, fontFamily: 'Inter_700Bold' },
  rowDesc: { fontSize: 10, color: muted, marginTop: 2 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },
  modalForm: { marginBottom: 16 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 12 },
  modalSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSwitchLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: ink },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5DFD1' },
  modalCancelBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: amber, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
});
