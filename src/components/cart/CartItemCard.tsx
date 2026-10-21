import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { CartItem } from '../../models';
import { useColors } from '../../store/preferences';
import { rp } from '../../lib/format';

function QtyField({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const c = useColors();
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(String(value));
  }
  const styles = StyleSheet.create({
    qty: {
      width: 44,
      height: 28,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontFamily: 'Inter_700Bold',
      color: c.text,
      padding: 0,
      fontSize: 13,
    },
  });
  return (
    <TextInput
      style={styles.qty}
      value={text}
      keyboardType='number-pad'
      maxLength={6}
      textAlign='center'
      selectTextOnFocus
      onChangeText={(t) => {
        const clean = t.replace(/[^0-9]/g, '');
        setText(clean);
        const n = parseInt(clean, 10);
        if (n >= 1 && n <= max) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

type CartItemCardProps = {
  item: CartItem;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onInc: () => void;
  onDec: () => void;
  onSetQty: (qty: number) => void;
  onRemove: () => void;
};

export default function CartItemCard({
  item,
  index,
  isSelected,
  onToggleSelect,
  onInc,
  onDec,
  onSetQty,
  onRemove,
}: CartItemCardProps) {
  const c = useColors();
  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    check: { justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    photo: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
    category: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    rowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    price: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.primary },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    btnMinus: {
      width: 26,
      height: 26,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { borderColor: c.borderSoft },
    btnPlus: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBox: {
      width: 68,
      marginBottom: 12,
      marginLeft: 8,
      borderRadius: 16,
      backgroundColor: c.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const renderDelete = () => (
    <TouchableOpacity style={styles.deleteBox} onPress={onRemove}>
      <Ionicons name='trash-outline' size={22} color={c.danger} />
    </TouchableOpacity>
  );

  return (
    <Swipeable renderRightActions={renderDelete} overshootRight={false}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.check} onPress={onToggleSelect}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? c.primary : c.textFaint}
          />
        </TouchableOpacity>
        <View style={styles.photo}>
          <Ionicons name='cube-outline' size={26} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
          <Text style={styles.category}>{item.product.category}</Text>
          <View style={styles.rowBottom}>
            <Text style={styles.price}>{rp(item.product.price)}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.btnMinus, item.qty <= 1 && styles.btnDisabled]}
                onPress={onDec}
                disabled={item.qty <= 1}
              >
                <Ionicons name='remove' size={15} color={item.qty <= 1 ? c.textFaint : c.text} />
              </TouchableOpacity>
              <QtyField
                value={item.qty}
                max={Math.max(1, item.product.stock)}
                onChange={onSetQty}
              />
              <TouchableOpacity
                style={[styles.btnPlus, item.qty >= Math.max(1, item.product.stock) && { opacity: 0.5 }]}
                onPress={onInc}
                disabled={item.qty >= Math.max(1, item.product.stock)}
              >
                <Ionicons name='add' size={15} color={c.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}