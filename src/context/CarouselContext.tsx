import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  fetchCarouselSlides, 
  fetchActiveCarouselSlides, 
  CarouselSlide, 
  createCarouselSlide, 
  updateCarouselSlide, 
  deleteCarouselSlide, 
  reorderCarouselSlides 
} from '../lib/carousel';

interface CarouselContextType {
  slides: CarouselSlide[];
  activeSlides: CarouselSlide[];
  loading: boolean;
  refresh: (admin?: boolean) => Promise<void>;
  create: (input: Omit<CarouselSlide, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  update: (id: string, patch: Partial<CarouselSlide>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (updates: { id: string; order: number }[]) => Promise<void>;
}

const CarouselContext = createContext<CarouselContextType | null>(null);

export function CarouselProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);

  // useCallback membuat "load" stabil (tidak dibuat ulang tiap render) sehingga
  // efek pemanggilnya hanya berjalan saat dependensinya berubah
  const load = useCallback(async (admin = false) => {
    setLoading(true);
    try {
      const data = admin ? await fetchCarouselSlides() : await fetchActiveCarouselSlides();
      setSlides(data);
    } catch (err) {
      console.error('Error loading carousel slides:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchActiveCarouselSlides();
        if (active) setSlides(data);
      } catch (err) {
        console.error('Error initial load carousel:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const create = async (input: Omit<CarouselSlide, 'id' | 'created_at' | 'updated_at'>) => {
    const n = await createCarouselSlide(input);
    setSlides(prev => [...prev, n].sort((a, b) => a.order - b.order));
  };

  const update = async (id: string, patch: Partial<CarouselSlide>) => {
    const n = await updateCarouselSlide(id, patch);
    setSlides(prev => prev.map(c => c.id === id ? n : c).sort((a, b) => a.order - b.order));
  };

  const remove = async (id: string) => {
    await deleteCarouselSlide(id);
    setSlides(prev => prev.filter(c => c.id !== id));
  };

  const reorder = async (updates: { id: string; order: number }[]) => {
    await reorderCarouselSlides(updates);
    await load(true);
  };

  // KUNCI PERBAIKAN: Jika flag is_active undefined, anggap true agar activeSlides tidak kosong
  const activeSlides = slides.filter(c => c.is_active !== false);

  return (
    <CarouselContext.Provider value={{
      slides,
      activeSlides,
      loading,
      refresh: load,
      create, update, remove, reorder
    }}>
      {children}
    </CarouselContext.Provider>
  );
}

export function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error('useCarousel must be used within CarouselProvider');
  return ctx;
}