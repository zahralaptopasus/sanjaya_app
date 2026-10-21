import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/preferences';
import { rp } from '../../lib/format';

type CartSummaryProps = {
  subtotal: number;
  discount: number;
  total: number;
  selectedCount: number;
  onCheckout: () => void;
  onApplyCoupon: (code: string) => void;
  bottomClearance: number;
  isGuest: boolean;
};

export default function CartSummary({
  subtotal,
  discount,
  total,
  selectedCount,
  onCheckout,
  onApplyCoupon,
  bottomClearance,
  isGuest,
}: CartSummaryProps) {
  const c = useColors();
  const [promo, setPromo] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [detailHeight, setDetailHeight] = useState(140);
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [expanded, anim]);

  const detailAnimHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, detailHeight],
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -16) setExpanded(true);
          else if (g.dy > 16) setExpanded(false);
        },
      }),
    []
  );

  const styles = StyleSheet.create({
    summary: {
      backgroundColor: c.card,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: bottomClearance,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
      elevation: 10,
    },
    handleRow: { alignItems: 'center', paddingVertical: 6 },
    collapsedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 4,
    },
    collapsedLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.textMuted },
    collapsedRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    collapsedValue: { fontSize: 18, fontFamily: 'Inter_800ExtraBold', color: c.primary },
    promoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingLeft: 16,
      paddingRight: 6,
      height: 48,
      marginBottom: 14,
    },
    promoInput: { flex: 1, fontSize: 13, color: c.text },
    promoBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    promoBtnText: { color: '#261A00', fontFamily: 'Inter_800ExtraBold', fontSize: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: c.textMuted, fontSize: 13 },
    rowValue: { fontFamily: 'Inter_700Bold', fontSize: 13, color: c.text },
    divider: { borderTopWidth: 1, borderColor: c.border, borderStyle: 'dashed', marginVertical: 10 },
    checkout: {
      backgroundColor: c.accent,
      borderRadius: 16,
      height: 52,
      marginTop: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkoutText: { color: '#261A00', fontSize: 15, fontFamily: 'Inter_800ExtraBold' },
  });

  return (
    <View style={styles.summary}>
      <View style={styles.handleRow} accessible accessibilityRole='button' accessibilityLabel={expanded ? 'Tutup rincian pembayaran' : 'Buka rincian pembayaran'} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.collapsedRow} activeOpacity={0.8} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.collapsedLabel}>Total</Text>
          <View style={styles.collapsedRight}>
            <Text style={styles.collapsedValue}>{rp(total)}</Text>
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={16} color={c.textMuted} />
          </View>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ height: detailAnimHeight, overflow: 'hidden' }}>
        <View onLayout={(e) => { const height = e.nativeEvent.layout.height; if (height > 0) setDetailHeight(height); }}>
          <View style={styles.promoBox}>
            <TextInput
              style={styles.promoInput}
              placeholder='Kode Promo'
              placeholderTextColor={c.textMuted}
              value={promo}
              onChangeText={setPromo}
              autoCapitalize='characters'
            />
            <TouchableOpacity style={styles.promoBtn} onPress={() => onApplyCoupon(promo || 'SANJAYABERKAH')}>
              <Text style={styles.promoBtnText}>Pakai</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>{rp(subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Diskon</Text>
            <Text style={[styles.rowValue, discount > 0 && { color: c.success }]}>- {rp(discount)}</Text>
          </View>
          <View style={styles.divider} />
        </View>
      </Animated.View>

      <TouchableOpacity
        style={[styles.checkout, selectedCount === 0 && { opacity: 0.5 }]}
        disabled={selectedCount === 0}
        onPress={onCheckout}
      >
        <Text style={styles.checkoutText}>
          {isGuest ? 'Login untuk Checkout  →' : `Checkout (${selectedCount})  →`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}