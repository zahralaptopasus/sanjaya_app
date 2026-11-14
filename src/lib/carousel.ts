import { supabase } from './supabase';

export interface CarouselSlide {
  id: string;
  badge: string | null;
  title: string;
  subtitle: string | null;
  icon: string | null;
  image_url: string | null;
  action_type: 'shop' | 'products' | 'coupon' | 'url';
  action_value: string | null;
  button_label: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all (admin)
export async function fetchCarouselSlides(): Promise<CarouselSlide[]> {
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Fetch active only (shop/user)
export async function fetchActiveCarouselSlides(): Promise<CarouselSlide[]> {
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .eq('is_active', true)
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Mutations (admin only)
export async function createCarouselSlide(input: Omit<CarouselSlide, 'id' | 'created_at' | 'updated_at'>): Promise<CarouselSlide> {
  const { data, error } = await supabase.from('carousel_slides').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCarouselSlide(id: string, patch: Partial<CarouselSlide>): Promise<CarouselSlide> {
  const { data, error } = await supabase
    .from('carousel_slides')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data?.[0]) throw new Error('Slide tidak ditemukan atau gagal diperbarui');
  return data[0];
}

export async function deleteCarouselSlide(id: string): Promise<void> {
  const { error } = await supabase.from('carousel_slides').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderCarouselSlides(updates: { id: string; order: number }[]): Promise<void> {
  for (const u of updates) {
    await supabase.from('carousel_slides').update({ order: u.order, updated_at: new Date().toISOString() }).eq('id', u.id);
  }
}