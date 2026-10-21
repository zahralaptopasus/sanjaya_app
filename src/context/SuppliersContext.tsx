import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { adminGetSuppliers, adminGetAllSuppliers, adminAddSupplier, adminUpdateSupplier, adminDeleteSupplier, type Supplier, type SupplierInput } from '../lib/admin';

interface SuppliersContextType {
  suppliers: Supplier[];
  allSuppliers: Supplier[];
  loading: boolean;
  refresh: (admin?: boolean) => Promise<void>;
  create: (input: SupplierInput) => Promise<{ error?: string }>;
  update: (id: string, patch: Partial<SupplierInput>) => Promise<{ error?: string }>;
  remove: (id: string) => Promise<{ error?: string }>;
}

const SuppliersContext = createContext<SuppliersContextType | null>(null);

export function SuppliersProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // useCallback membuat "load" stabil (tidak dibuat ulang tiap render) sehingga
  // efek pemanggilnya hanya berjalan saat dependensinya berubah
  const load = useCallback(async (admin = false) => {
    setLoading(true);
    try {
      const [active, all] = await Promise.all([
        adminGetSuppliers({ activeOnly: true }),
        admin ? adminGetAllSuppliers() : Promise.resolve(null),
      ]);
      setSuppliers(active);
      if (all) setAllSuppliers(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(true);
    })();
  }, [load]);

  const create = async (input: SupplierInput): Promise<{ error?: string }> => {
    const result = await adminAddSupplier(input);
    if ('id' in result) {
      await load(true);
      return {};
    }
    return { error: result.error };
  };

  const update = async (id: string, patch: Partial<SupplierInput>): Promise<{ error?: string }> => {
    const result = await adminUpdateSupplier(id, patch);
    if (!result.error) {
      await load(true);
    }
    return result;
  };

  const remove = async (id: string): Promise<{ error?: string }> => {
    const result = await adminDeleteSupplier(id);
    if (!result.error) {
      await load(true);
    }
    return result;
  };

  return (
    <SuppliersContext.Provider value={{
      suppliers,
      allSuppliers,
      loading,
      refresh: load,
      create,
      update,
      remove,
    }}>
      {children}
    </SuppliersContext.Provider>
  );
}

export function useSuppliers() {
  const ctx = useContext(SuppliersContext);
  if (!ctx) throw new Error('useSuppliers must be used within SuppliersProvider');
  return ctx;
}