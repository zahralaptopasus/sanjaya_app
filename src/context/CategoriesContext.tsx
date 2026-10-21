import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchCategories, fetchActiveCategories, Category, createCategory, updateCategory, deleteCategory, reorderCategories } from '../lib/categories';

interface CategoriesContextType {
  categories: Category[];
  activeCategories: Category[];
  loading: boolean;
  refresh: (admin?: boolean) => Promise<void>;
  // admin mutations
  create: (input: Omit<Category, 'created_at' | 'updated_at'>) => Promise<void>;
  update: (id: string, patch: Partial<Category>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (updates: { id: string; order: number }[]) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // useCallback membuat "load" stabil (tidak dibuat ulang tiap render) agar efek di bawah
  // hanya berjalan sekali, bukan setiap kali layar dirender ulang
  const load = useCallback(async (admin = false) => {
    setLoading(true);
    try {
      const data = admin ? await fetchCategories() : await fetchActiveCategories();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // muat kategori sekali saat provider pertama kali dibuka;
  // dibungkus async IIFE agar setState tidak terjadi sinkron di dalam efek
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const create = async (input: Omit<Category, 'created_at' | 'updated_at'>) => {
    const n = await createCategory(input);
    setCategories(prev => [...prev, n].sort((a, b) => a.order - b.order));
  };

  const update = async (id: string, patch: Partial<Category>) => {
    const n = await updateCategory(id, patch);
    setCategories(prev => prev.map(c => c.id === id ? n : c).sort((a, b) => a.order - b.order));
  };

  const remove = async (id: string) => {
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const reorder = async (updates: { id: string; order: number }[]) => {
    await reorderCategories(updates);
    await load(true);
  };

  return (
    <CategoriesContext.Provider value={{
      categories,
      activeCategories: categories.filter(c => c.is_active),
      loading,
      refresh: load,
      create, update, remove, reorder
    }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}