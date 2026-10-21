// ===== IMPORT =====
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
  Modal, FlatList, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSuppliers } from '../../context/SuppliersContext';
import type { Supplier } from '../../lib/admin';
import { navy, surface, cardBg, chipBg, muted, ink, bronze, amber } from '../../theme';

// ===== KOMPONEN UTAMA =====
export default function AdminSuppliersScreen() {
  const { allSuppliers, loading, refresh, create, update, remove } = useSuppliers();
  const [refreshing, setRefreshing] = useState(false);
  // kata kunci pencarian supplier
  const [search, setSearch] = useState('');

  // supplier hasil pencarian (nama, kode, CP, WA/telepon, email, alamat)
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSuppliers;
    return allSuppliers.filter((s) => {
      const hay = [
        s.name,
        s.code,
        s.contactPerson,
        s.phone,
        s.email,
        s.address,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [allSuppliers, search]);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // load suppliers on mount
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
    setCode('');
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsActive(true);
    setModalMode('add');
    setEditSupplier(null);
    setModalOpen(true);
  };

  // open modal for edit
  const openEdit = (sup: Supplier) => {
    setCode(sup.code);
    setName(sup.name);
    setContactPerson(sup.contactPerson);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setIsActive(sup.isActive);
    setModalMode('edit');
    setEditSupplier(sup);
    setModalOpen(true);
  };

  // close modal & reset form
  const closeModal = () => {
    setModalOpen(false);
    setCode('');
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsActive(true);
    setEditSupplier(null);
  };

  // handle save (create or update)
  const handleSave = async () => {
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n) {
      Alert.alert('Nama wajib diisi');
      return;
    }
    if (!c) {
      Alert.alert('Kode supplier wajib diisi');
      return;
    }
    // cek duplikat kode (abaikan yang sedang diedit)
    const duplicate = allSuppliers.some(
      s => s.id !== editSupplier?.id && s.code.toUpperCase() === c
    );
    if (duplicate) {
      Alert.alert('Kode sudah digunakan', `Kode "${c}" sudah terdaftar pada supplier lain.`);
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await create({ 
          code: c, 
          name: n, 
          contactPerson: contactPerson.trim(), 
          phone: phone.trim(), 
          email: email.trim(), 
          address: address.trim(), 
          isActive 
        });
      } else if (editSupplier) {
        await update(editSupplier.id, { 
          code: c, 
          name: n, 
          contactPerson: contactPerson.trim(), 
          phone: phone.trim(), 
          email: email.trim(), 
          address: address.trim(), 
          isActive 
        });
      }
      closeModal();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa simpan supplier');
    } finally {
      setSaving(false);
    }
  };

  // handle delete (soft delete: set is_active = false)
  const doDelete = async (sup: Supplier) => {
    try {
      await remove(sup.id);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak bisa hapus supplier');
    }
  };

  const handleDelete = (sup: Supplier) => {
    const msg = `Yakin nonaktifkan "${sup.name}" (${sup.code})? Data akan disembunyikan tapi tidak dihapus permanen.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete(sup);
      return;
    }
    Alert.alert('Nonaktifkan Supplier', msg, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Nonaktifkan', style: 'destructive', onPress: () => doDelete(sup) },
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
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Kelola Supplier</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#261A00" />
            <Text style={styles.addBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sub}>Atur master supplier untuk PO. Tarik ke bawah untuk refresh.</Text>

        {/* Kotak pencarian supplier */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / kode / WA / email / alamat..."
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* List supplier */}
        {allSuppliers.length === 0 ? (
          <Text style={styles.empty}>Belum ada supplier. Tambah di atas.</Text>
        ) : filteredSuppliers.length === 0 ? (
          <Text style={styles.empty}>Supplier tidak ditemukan.</Text>
        ) : (
          <FlatList
            data={filteredSuppliers}
            keyExtractor={s => s.id}
            ListEmptyComponent={<Text style={styles.empty}>Belum ada supplier.</Text>}
            renderItem={({ item: sup, index }) => (
              <View style={styles.row}>
                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                  <Text style={styles.avatarText}>{sup.code.charAt(0)}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.rowLabel, !sup.isActive && styles.rowLabelInactive]}>{sup.name}</Text>
                    {!sup.isActive && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Nonaktif</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    Kode: {sup.code} • {sup.contactPerson ? `CP: ${sup.contactPerson}` : ''} 
                    {sup.phone ? ` • ${sup.phone}` : ''}
                    {sup.email ? ` • ${sup.email}` : ''}
                  </Text>
                  <Text style={styles.rowAddress}>
                    {sup.address || '-'}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  {/* Active toggle */}
                  <Switch
                    value={sup.isActive}
                    onValueChange={() => { void update(sup.id, { isActive: !sup.isActive }); }}
                    thumbColor={sup.isActive ? '#261A00' : '#fff'}
                    trackColor={{ false: '#FFEBEB', true: amber }}
                  />

                  {/* Edit */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(sup)}>
                    <Ionicons name="create" size={20} color={navy} />
                  </TouchableOpacity>

                  {/* Delete / Nonaktifkan */}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(sup)}>
                    <Ionicons name={sup.isActive ? 'trash' : 'refresh'} size={20} color={sup.isActive ? "#BA1A1A" : bronze} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </ScrollView>

      {/* ===== MODAL TAMBAH/EDIT SUPPLIER ===== */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'edit' ? 'Edit Supplier' : 'Tambah Supplier'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={ink} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.modalForm}>
              {/* Kode Supplier */}
              <TextInput
                style={styles.modalInput}
                placeholder="Kode supplier (contoh: SUP-001)"
                placeholderTextColor={muted}
                value={code}
                onChangeText={t => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                editable={modalMode === 'add'}
              />

              {/* Nama Supplier */}
              <TextInput
                style={styles.modalInput}
                placeholder="Nama supplier"
                placeholderTextColor={muted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              {/* Contact Person */}
              <TextInput
                style={styles.modalInput}
                placeholder="Contact person (opsional)"
                placeholderTextColor={muted}
                value={contactPerson}
                onChangeText={setContactPerson}
                autoCapitalize="words"
              />

              {/* Phone */}
              <TextInput
                style={styles.modalInput}
                placeholder="Telepon (opsional)"
                placeholderTextColor={muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              {/* Email */}
              <TextInput
                style={styles.modalInput}
                placeholder="Email (opsional)"
                placeholderTextColor={muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {/* Address */}
              <TextInput
                style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Alamat (opsional)"
                placeholderTextColor={muted}
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
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
  // kotak pencarian supplier: baris horizontal dengan ikon + input + tombol clear
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D8D2C4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: ink, padding: 0 },
  empty: { textAlign: 'center', color: muted, marginTop: 40, fontSize: 13 },
  addBtn: { backgroundColor: amber, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardBg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5DFD1' },
  avatarWrapper: { width: 44, height: 44, borderRadius: 10, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: navy },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: ink },
  rowLabelInactive: { textDecorationLine: 'line-through', color: muted },
  inactiveBadge: { backgroundColor: '#FFEBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inactiveBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#BA1A1A' },
  rowMeta: { fontSize: 11, color: muted, marginTop: 2 },
  rowAddress: { fontSize: 10, color: muted, marginTop: 2, lineHeight: 14 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { height: '85%', backgroundColor: surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: ink },

  modalForm: { flex: 1, marginBottom: 16 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8D2C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: ink, marginBottom: 12 },

  modalSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSwitchLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: ink },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5DFD1' },
  modalCancelBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: navy, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: navy },
  modalSaveBtn: { flex: 1, backgroundColor: amber, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
});