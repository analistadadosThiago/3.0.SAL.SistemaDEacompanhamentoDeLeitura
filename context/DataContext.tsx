import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { FieldRecord, MONTH_ORDER } from '../types';
import { fetchGoogleSheetsGViz, generateSampleRecords } from '../services/googleSheetsService';

interface DataContextType {
  records: FieldRecord[];
  loading: boolean;
  error: string | null;
  sheetUrl: string;
  isConfigured: boolean;
  isDemoData: boolean;
  connectSheet: (url: string) => Promise<boolean>;
  loadDemoData: () => void;
  disconnectSheet: () => void;
  opcoesAnos: number[];
  opcoesMeses: string[];
  opcoesRazoes: string[];
  opcoesMatriculas: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEY_URL = 'sal_google_sheet_url';
const STORAGE_KEY_IS_DEMO = 'sal_is_demo_data';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<FieldRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isDemoData, setIsDemoData] = useState<boolean>(false);

  // Initialize from localStorage or show prompt
  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const wasDemo = localStorage.getItem(STORAGE_KEY_IS_DEMO) === 'true';

    if (savedUrl) {
      setSheetUrl(savedUrl);
      setLoading(true);
      fetchGoogleSheetsGViz(savedUrl)
        .then(data => {
          setRecords(data);
          setIsConfigured(true);
          setIsDemoData(false);
        })
        .catch(err => {
          console.warn("Erro ao carregar planilha salva, usando demonstrativo:", err);
          // Fallback to sample data so the app doesn't break
          const sample = generateSampleRecords();
          setRecords(sample);
          setIsConfigured(true);
          setIsDemoData(true);
          setError(`Não foi possível recarregar a planilha (${err.message}). Carregamos a base demonstrativa.`);
        })
        .finally(() => setLoading(false));
    } else if (wasDemo) {
      const sample = generateSampleRecords();
      setRecords(sample);
      setIsConfigured(true);
      setIsDemoData(true);
    }
  }, []);

  const connectSheet = async (url: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGoogleSheetsGViz(url);
      setRecords(data);
      setSheetUrl(url);
      setIsConfigured(true);
      setIsDemoData(false);
      localStorage.setItem(STORAGE_KEY_URL, url);
      localStorage.removeItem(STORAGE_KEY_IS_DEMO);
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar à planilha Google Sheets.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      const sample = generateSampleRecords();
      setRecords(sample);
      setSheetUrl('https://docs.google.com/spreadsheets/d/demo-sal-leituristas-energia/edit');
      setIsConfigured(true);
      setIsDemoData(true);
      localStorage.setItem(STORAGE_KEY_IS_DEMO, 'true');
      localStorage.removeItem(STORAGE_KEY_URL);
      setLoading(false);
    }, 400);
  };

  const disconnectSheet = () => {
    setRecords([]);
    setSheetUrl('');
    setIsConfigured(false);
    setIsDemoData(false);
    setError(null);
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_IS_DEMO);
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
        error,
        sheetUrl,
        isConfigured,
        isDemoData,
        connectSheet,
        loadDemoData,
        disconnectSheet,
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
