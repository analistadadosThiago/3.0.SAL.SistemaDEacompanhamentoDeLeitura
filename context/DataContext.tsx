import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { FieldRecord, MONTH_ORDER } from '../types';
import { fetchSupabaseBaseLeitura } from '../services/supabaseService';

interface DataContextType {
  records: FieldRecord[];
  loading: boolean;
  loadingCount: number;
  error: string | null;
  isConfigured: boolean;
  reloadSupabaseData: () => Promise<void>;
  opcoesAnos: number[];
  opcoesMeses: string[];
  opcoesRazoes: string[];
  opcoesMatriculas: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingCount, setLoadingCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadingCount(0);
    setError(null);
    try {
      const data = await fetchSupabaseBaseLeitura((count) => {
        setLoadingCount(count);
      });
      setRecords(data);
      setIsConfigured(true);
    } catch (err: any) {
      console.error('Falha ao conectar com o Supabase:', err);
      setError(err.message || 'Erro ao carregar dados do Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega diretamente na inicialização do sistema
  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadSupabaseData = async () => {
    await loadData();
  };

  const opcoesAnos = useMemo(() => {
    const set = new Set<number>();
    records.forEach(r => {
      if (r.Ano) set.add(Number(r.Ano));
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  const opcoesMeses = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.Mes) set.add(String(r.Mes).trim());
    });
    return Array.from(set).sort((a, b) => {
      const orderA = MONTH_ORDER[a.toUpperCase()] || 99;
      const orderB = MONTH_ORDER[b.toUpperCase()] || 99;
      return orderA - orderB;
    });
  }, [records]);

  const opcoesRazoes = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.rz) set.add(String(r.rz).padStart(2, '0'));
    });
    return Array.from(set).sort();
  }, [records]);

  const opcoesMatriculas = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.matr) set.add(String(r.matr).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records]);

  return (
    <DataContext.Provider
      value={{
        records,
        loading,
        loadingCount,
        error,
        isConfigured,
        reloadSupabaseData,
        opcoesAnos,
        opcoesMeses,
        opcoesRazoes,
        opcoesMatriculas,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
