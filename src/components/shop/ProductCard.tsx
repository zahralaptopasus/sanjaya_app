import React from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../../models';
import { useColors } from '../../store/preferences';

type ProductCardProps = {
  product: Product;
  onPress: () => void;
  onAddCart: () => void;
  onToggleFav: () => void;
  isFavorite: boolean;
  width?: number;
};

export default function ProductCard({ product, onPress, onAddCart, onToggleFav, isFavorite, width }: ProductCardProps) {
  const c = useColors();
  const styles = StyleSheet.create({
    card: {
      width: width ?? undefined,
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    thumb: {
      height: 104,
      backgroundColor: c.chip,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 9,
      overflow: 'hidden',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      resizeMode: 'cover',
    },
    heart: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    price: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.primary },
    name: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text, marginTop: 3, minHeight: 32, lineHeight: 16 },
    stock: { fontSize: 10, color: c.textMuted, marginTop: 4, fontVariant: ['tabular-nums'] },
    stockLow: { color: c.warn, fontFamily: 'Inter_700Bold' },
    addBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
      marginTop: 9,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
    },
    addText: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
  });

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress}>
        <View style={styles.thumb}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.thumbImage} />
          ) : (
            <Ionicons name='cube' size={30} color={c.textFaint} />
          )}
          <TouchableOpacity style={styles.heart} onPress={onToggleFav}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={16}
              color={isFavorite ? c.danger : c.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>{rp(product.price)}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={[styles.stock, product.stock <= 8 && styles.stockLow]}>
          {product.stock <= 8 ? `Sisa ${product.stock}` : `Stok ${product.stock}`}{' '}
          \u2022 {product.code}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtn} onPress={onAddCart}>
        <Ionicons name='add' size={15} color='#261A00' />
        <Text style={styles.addText}>Keranjang</Text>
      </TouchableOpacity>
    </View>
  );
}

function rp(n: number): string {
  const s = Math.trunc(n).toString();
  let out = '';
  let count = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    out = s[i] + out;
    if (++count % 3 === 0 && i !== 0) out = '.' + out;
  }
  return `Rp ${out}`;
}