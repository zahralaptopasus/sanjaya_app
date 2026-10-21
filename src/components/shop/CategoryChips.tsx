import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/preferences';

type CategoryItem = { id: string; label: string; icon: string };

type CategoryChipsProps = {
  categories: CategoryItem[];
  selected: string;
  onSelect: (id: string) => void;
};

export default function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  const c = useColors();
  const styles = StyleSheet.create({
    wrap: { marginTop: 17, marginBottom: 4 },
    chips: { paddingHorizontal: 16 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      paddingHorizontal: 13,
      paddingVertical: 7,
      marginRight: 8,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text },
    chipTextActive: { color: '#fff', fontFamily: 'Inter_700Bold' },
  });

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <TouchableOpacity onPress={() => onSelect('Semua')} style={[styles.chip, selected === 'Semua' && styles.chipActive]}>
          <Ionicons name='apps' size={13} color={selected === 'Semua' ? '#fff' : c.warn} />
          <Text style={[styles.chipText, selected === 'Semua' && styles.chipTextActive]}>Semua</Text>
        </TouchableOpacity>
        {categories.map((ct) => {
          const active = selected === ct.id;
          return (
            <TouchableOpacity key={ct.id} onPress={() => onSelect(ct.id)} style={[styles.chip, active && styles.chipActive]}>
              <Ionicons name={ct.icon as any} size={13} color={active ? '#fff' : c.warn} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{ct.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}