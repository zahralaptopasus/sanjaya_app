// ===== IMPORT =====
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  Modal, FlatList, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCategories } from '../../context/CategoriesContext';
import { COMMON_ICONS } from '../../lib/categories';
import { navy, surface, cardBg, chipBg, muted, ink, amber } from '../../theme';

// ===== TYPE =====
type Category = {
  id: string;
  label: string;
  icon: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ===== KOMPONEN UTAMA =====
export default function AdminCategoriesScreen() {
  const { categories, loading, refresh, create, update, remove, reorder } = useCategories();
  const [refreshing, setRefreshing] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // form state
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState<string>(COMMON_ICONS[0]);
  const [order, setOrder] = useState(99);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // load categories on mount
  useEffect(() => {
    void (async () => {
      await refresh(true);
    })();
  }, [refresh]);

  // pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };

  // open modal for add
  const openAdd = () => {
    setLabel('');
    setIcon(COMMON_ICONS[0]);
    setOrder(categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1);
    setIsActive(true);
    setModalMode('add');
    setEditCategory(null);
    setModalOpen(true);
  };

  // open modal for edit
  const openEdit = (cat: Category) => {
    setLabel(cat.label);
    setIcon(cat.icon);
    setOrder(cat.order);
    setIsActive(cat.is_active);
    setModalMode('edit');
    setEditCategory(cat);
    setModalOpen(true);
  };

  // close modal & reset form
  const closeModal = () => {
    setModalOpen(false);
    setLabel('');
    setIcon(COMMON_ICONS[0]);
    setOrder(99);
    setIsActive(true);
    setEditCategory(null);
  };

  // handle save (create or update)
  const handleSave = async () => {
    const name = label.trim();
    if (!name) {
      Alert.alert('Label wajib diisi');
      return;
    }
    // tolak kalau sudah ada kategori dengan label sama (abaikan besar/kecil huruf & spasi)
    const duplicate = categories.some(
      c => c.id !== editCategory?.id && c.label.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      Alert.alert('Kategori sudah ada', `Kategori "${name}" sudah terdaftar.`);
      return;
    }
    // untuk kategori baru, pastikan label menghasilkan id yang valid
    if (modalMode === 'add' && !name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) {
      Alert.alert('Nama tidak valid', 'Gunakan minimal satu huruf atau angka.');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'add') {
        // buat id (slug) dari label: ubah karakter selain huruf/angka jadi "-"
        const newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        await create({ id: newId, label: name, icon, order, is_active: isActive });
      } else if (editCategory) {
        await update(editCategory.id, { label: name, icon, order, is_active: isActive });
      }
      closeModal();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa simpan kategori');
    } finally {
      setSaving(false);
    }
  };

  // handle delete (hard delete)
  const doDelete = async (cat: Category) => {
    try {
      await remove(cat.id);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa hapus kategori');
    }
  };

  const handleDelete = (cat: Category) => {
    const msg = `Yakin hapus "${cat.label}"? Tindakan ini tidak bisa dibatalkan.`;
    // di web, Alert.alert tidak menampilkan tombol -> pakai confirm bawaan browser
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete(cat);
      return;
    }
    Alert.alert('Hapus Kategori', msg, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => doDelete(cat) },
    ]);
  };

  // move category up
  const moveUp = async (cat: Category, index: number) => {
    if (index === 0) return;
    const prev = categories[index - 1];
    try {
      await reorder([
        { id: cat.id, order: prev.order },
        { id: prev.id, order: cat.order },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa pindah urutan');
    }
  };

  // move category down
  const moveDown = async (cat: Category, index: number) => {
    if (index === categories.length - 1) return;
    const next = categories[index + 1];
    try {
      await reorder([
        { id: cat.id, order: next.order },
        { id: next.id, order: cat.order },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa pindah urutan');
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
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Kelola Kategori</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sub}>Atur kategori produk. Tarik ke bawah untuk refresh.</Text>

        {/* List kategori */}
        {categories.length === 0 ? (
          <Text style={styles.empty}>Belum ada kategori. Tambah di atas.</Text>
        ) : (
          <FlatList
            data={categories}
            keyExtractor={c => c.id}
            ListEmptyComponent={<Text style={styles.empty}>Belum ada kategori.</Text>}
            renderItem={({ item: cat, index }) => (
              <View style={styles.row}>
                {/* Icon */}
                <View style={styles.iconWrapper}>
                  <Ionicons name={cat.icon as any} size={24} color={cat.is_active ? navy : muted} />
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, !cat.is_active && styles.rowLabelInactive]}>{cat.label}</Text>
                  <Text style={styles.rowMeta}>
                    ID: {cat.id} • Urutan: {cat.order} • {cat.is_active ? 'Aktif' : 'Nonaktif'}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  {/* Active toggle */}
                  <Switch
                    value={cat.is_active}
                    onValueChange={() => update(cat.id, { is_active: !cat.is_active })}
                    thumbColor={cat.is_active ? '#261A00' : '#fff'}
                    trackColor={{ false: '#FFEBEB', true: amber }}
                  />

                  {/* Move up */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => moveUp(cat, index)} disabled={index === 0}>
                    <Ionicons name="chevron-up" size={20} color={index === 0 ? muted : navy} />
                  </TouchableOpacity>

                  {/* Move down */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => moveDown(cat, index)} disabled={index === categories.length - 1}>
                    <Ionicons name="chevron-down" size={20} color={index === categories.length - 1 ? muted : navy} />
                  </TouchableOpacity>

                  {/* Edit */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(cat)}>
                    <Ionicons name="create" size={20} color={navy} />
                  </TouchableOpacity>

                  {/* Delete */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(cat)}>
                    <Ionicons name="trash" size={20} color="#BA1A1A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT KATEGORI ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'edit' ? 'Edit Kategori' : 'Tambah Kategori'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.modalForm}>
              {/* Label */}
              <TextInput
                style={styles.modalInput}
                placeholder="Nama kategori (contoh: Oli & Pelumas)"
                placeholderTextColor={muted}
                value={label}
                onChangeText={setLabel}
                autoCapitalize="words"
              />

              {/* Icon picker - grid 2 kolom */}
              <Text style={styles.modalSectionLabel}>Ikon</Text>
              <View style={styles.iconGrid}>
                {(COMMON_ICONS as readonly string[]).map((ic: string) => (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconOption,
                      icon === ic && styles.iconOptionActive
                    ]}
                    onPress={() => setIcon(ic)}
                  >
                    <Ionicons name={ic as any} size={24} color={icon === ic ? '#fff' : navy} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order */}
              <TextInput
                style={styles.modalInput}
                placeholder="Urutan (angka)"
                placeholderTextColor={muted}
                value={String(order)}
                onChangeText={t => setOrder(Math.trunc(Number(t)) || 99)}
                keyboardType="number-pad"
              />

              {/* Active toggle */}
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

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Menyimpan...' : modalMode === 'edit' ? 'Update' : 'Tambah'}</Text>
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
  iconWrapper: { width: 44, height: 44, borderRadius: 10, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: ink },
  rowLabelInactive: { textDecorationLine: 'line-through', color: muted },
  rowMeta: { fontSize: 11, color: muted, marginTop: 2 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { height: '80%', backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },

  modalForm: { flex: 1, marginBottom: 16 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 12 },
  modalSectionLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: ink, marginBottom: 8 },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconOption: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', alignItems: 'center', justifyContent: 'center' },
  iconOptionActive: { backgroundColor: navy, borderColor: navy },

  modalSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSwitchLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: ink },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5DFD1' },
  modalCancelBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: amber, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
});