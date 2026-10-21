import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, Image, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CarouselSlide } from '../../lib/carousel';
import { useColors } from '../../store/preferences';

type CarouselSliderProps = {
  slides: CarouselSlide[];
  onSlidePress?: (slide: CarouselSlide) => void;
};

export default function CarouselSlider({ slides, onSlidePress }: CarouselSliderProps) {
  const c = useColors();
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselW, setCarouselW] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const carouselWRef = useRef(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    carouselWRef.current = carouselW;
  }, [carouselW]);

  // stopAuto menghentikan timer autoplay; useCallback membuat fungsi ini stabil
  // sehingga efek di bawah tidak perlu me-restart timer tanpa alasan
  const stopAuto = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
  }, []);

  // startAuto memulai timer autoplay (ganti slide tiap 3 detik)
  const startAuto = useCallback(() => {
    stopAuto();
    if (slides.length === 0) return;
    autoRef.current = setInterval(() => {
      const w = carouselWRef.current;
      if (!w) return;
      setActiveSlide((prev) => {
        const next = (prev + 1) % slides.length;
        carouselRef.current?.scrollTo({ x: next * w, animated: true });
        return next;
      });
    }, 3000);
  }, [slides.length, stopAuto]);

  const onCarouselScroll = (e: any) => {
    const w = carouselWRef.current;
    if (w > 0) setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / w));
  };

  const handlePress = (s: CarouselSlide) => {
    if (s.action_type === 'coupon') {
      if (onSlidePress) onSlidePress(s);
    } else if (s.action_type === 'shop' || s.action_type === 'products') {
      if (onSlidePress) onSlidePress(s);
    } else if (s.action_type === 'url' && s.action_value) {
      Linking.openURL(s.action_value).catch(() => Alert.alert('Gagal', 'Tidak bisa membuka tautan.'));
    }
  };

  useEffect(() => {
    if (carouselW > 0) startAuto();
    return () => stopAuto();
  }, [carouselW, slides.length, startAuto, stopAuto]);

  if (slides.length === 0) return null;

  const styles = StyleSheet.create({
    wrap: { marginBottom: 10 },
    carousel: { flex: 0 },
    carouselContent: {},
    slide: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 22,
      paddingLeft: 16,
      paddingRight: 10,
      minHeight: 150,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: c.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    slideLeft: { flex: 0.95 },
    slideCode: { color: c.accent, fontSize: 10, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1.4 },
    slideTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_800ExtraBold', marginTop: 5, lineHeight: 20 },
    slideBtn: {
      backgroundColor: c.accent,
      borderRadius: 9,
      paddingVertical: 7,
      paddingHorizontal: 13,
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    slideBtnText: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: '#261A00' },
    slideRight: {
      flex: 1.15,
      backgroundColor: c.accent,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      marginLeft: 10,
      overflow: 'hidden',
      minHeight: 118,
    },
    slideIconSub: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#131B2E', marginTop: 4 },
    slideImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, resizeMode: 'cover' },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 12 },
    dot: { height: 7, borderRadius: 4 },
    dotActive: { width: 22, backgroundColor: c.primary },
    dotInactive: { width: 7, backgroundColor: c.textFaint },
  });

  return (
    <View style={styles.wrap}>
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== carouselW) setCarouselW(w);
        }}
      >
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onCarouselScroll}
          onMomentumScrollEnd={onCarouselScroll}
          contentContainerStyle={styles.carouselContent}
          style={styles.carousel}
          onTouchStart={stopAuto}
          onTouchEnd={startAuto}
        >
          {slides.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[{ width: carouselW }, styles.slide]}
              onPress={() => handlePress(s)}
            >
              <View style={styles.slideLeft}>
                {s.badge ? <Text style={styles.slideCode}>{s.badge}</Text> : null}
                <Text style={styles.slideTitle}>{s.title}</Text>
                <TouchableOpacity style={styles.slideBtn} onPress={() => handlePress(s)} activeOpacity={0.7}>
                  <Text style={styles.slideBtnText}>{s.button_label}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.slideRight}>
                {s.image_url ? (
                  <Image source={{ uri: s.image_url }} style={styles.slideImg} />
                ) : (
                  <>
                    <Ionicons name={(s.icon ?? 'pricetag') as any} size={48} color='#131B2E' />
                    {s.subtitle ? <Text style={styles.slideIconSub}>{s.subtitle}</Text> : null}
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeSlide ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}