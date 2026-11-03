import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import Logo from './Logo';
import { Link, Play, AlertCircle, X, CheckCircle, Database } from 'lucide-react';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, canDismiss = true }) => {
  const { sheetUrl, connectSheet, loading, error, isConfigured, records } = useData();
  const [inputUrl, setInputUrl] = useState<string>(sheetUrl || '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!inputUrl.trim()) {
      setLocalError('Por favor, informe o link da sua planilha pública do Google Sheets.');
      return;
    }

    const success = await connectSheet(inputUrl.trim());
    if (success && onClose) {
      onClose();
    }
  };

  const formattedDateTime = () => {
    const d = String(time.getDate()).padStart(2, '0');
    const m = String(time.getMonth() + 1).padStart(2, '0');
    const y = time.getFullYear();
    const h = String(time.getHours()).padStart(2, '0');
    const min = String(time.getMinutes()).padStart(2, '0');
    const s = String(time.getSeconds()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col">
        {/* Header com Logo destacada ao lado de SAL */}
        <div className="p-6 sm:p-7 border-b border-slate-800 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-4">
            <Logo showText={false} imgClassName="h-14 w-auto object-contain" iconSize="w-14 h-14" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white tracking-tight">SAL</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-cyan-400 font-bold border border-blue-500/30">
                  Google Sheets GViz
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">Sistema de Análise de Leitura</p>
            </div>
          </div>
          {canDismiss && isConfigured && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Ativo */}
          {isConfigured && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">
                  Base Conectada com Sucesso
                </div>
                <div className="text-[11px] text-emerald-400/80">
                  {records.length.toLocaleString('pt-BR')} registros carregados na memória
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Link da Base de Dados (Google Sheets)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Link className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Insira o link público da planilha Google Sheets. Ao clicar em Gerar, o sistema sincronizará os dados instantaneamente.
              </p>
            </div>

            {(localError || error) && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-snug">{localError || error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Conectando e Carregando Planilha...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Gerar
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé Obrigatório no Modal */}
        <div className="p-4 bg-[#080c14] border-t border-slate-800 text-center select-none">
          <div className="text-[11px] text-slate-300 font-medium">
            Copyright SAL: Sistema de Análise de Leitura © 2026 | Criado por Thiago Marques Lopes
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider">
            {formattedDateTime()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseModal;
