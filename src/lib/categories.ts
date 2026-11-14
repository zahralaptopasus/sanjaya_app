import { supabase } from './supabase';

export interface Category {
  id: string;
  label: string;
  icon: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all (admin)
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Fetch active only (shop/user)
export async function fetchActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Helpers
export const getCategoryLabel = (categories: Category[], id: string): string =>
  categories.find(c => c.id === id)?.label ?? id;

export const getActiveCategoryLabels = (categories: Category[]): string[] =>
  categories.filter(c => c.is_active).map(c => c.label);

export const getCategoryById = (categories: Category[], id: string): Category | undefined =>
  categories.find(c => c.id === id);

// Mutations (admin only)
export async function createCategory(input: Omit<Category, 'created_at' | 'updated_at'>): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data?.[0]) throw new Error('Kategori tidak ditemukan atau gagal diperbarui');
  return data[0];
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderCategories(updates: { id: string; order: number }[]): Promise<void> {
  for (const u of updates) {
    await supabase.from('categories').update({ order: u.order, updated_at: new Date().toISOString() }).eq('id', u.id);
  }
}

// List 20 Ionicons umum untuk icon picker
export const COMMON_ICONS = [
  'water', 'disc', 'flash', 'snow', 'cog', 'ellipse', 'battery-full',
  'construct', 'build', 'shield', 'car', 'bicycle', 'engine', 'wrench',
  'hammer', 'settings', 'cube', 'box', 'package', 'gift',
] as const;