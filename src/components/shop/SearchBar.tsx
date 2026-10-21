import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/preferences';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ref?: React.RefObject<View> | null;
};

export const SearchBar = ({ value, onChangeText, onClear, placeholder = 'Cari kode / nama part...', ref }: SearchBarProps) => {
  const c = useColors();
  const styles = StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      marginTop: 2,
    },
    icon: { marginRight: 8 },
    input: { flex: 1, paddingVertical: 11, fontSize: 14, color: c.text },
    clearBtn: { padding: 4 },
  });

  return (
    <View style={styles.wrap} ref={ref}>
      <Ionicons name='search' size={16} color={c.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType='search'
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
          <Ionicons name='close-circle' size={18} color={c.textMuted} />
        </TouchableOpacity>
      ) : (
        <Ionicons name='options' size={18} color={c.textMuted} />
      )}
    </View>
  );
};

SearchBar.displayName = 'SearchBar';