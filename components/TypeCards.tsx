
import React from 'react';
import { DadosPorTipo } from '../types';
import { Layers, Target, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

interface TypeCardsProps {
  dados: DadosPorTipo[];
}

const TypeCards: React.FC<TypeCardsProps> = ({ dados }) => {
  const format = (n: number) => (n || 0).toLocaleString('pt-BR');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {dados.map((item, idx) => {
        // Regras de Cálculo solicitadas
        const totalLeituras = item.total_leituras || 0;
        const naoRealizadas = item.nao_realizadas || 0;
        const realizadas = totalLeituras - naoRealizadas;
        
        // Percentual de Impedimentos (%) = (Leituras Não Realizadas ÷ Leituras Realizadas) × 100
        const indicadorRecalculado = realizadas > 0 ? (naoRealizadas / realizadas) * 100 : (naoRealizadas > 0 ? 100 : 0);
        const isWarning = indicadorRecalculado > 5;

        return (
          <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-2xl hover:-translate-y-1.5 duration-300 group">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                  <Layers className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <h3 className="font-black text-slate-800 text-sm tracking-tight uppercase italic">{item.tipo || 'Geral'}</h3>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-3">
                     <Target className="w-4 h-4 text-slate-400" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Leituras</span>
                   </div>
                   <span className="text-sm font-black text-slate-800">{format(totalLeituras)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                     <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                       <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Realizadas</span>
                     </div>
                     <span className="text-lg font-black text-emerald-700 tracking-tighter">{format(realizadas)}</span>
                  </div>

                  <div className="flex flex-col gap-1 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                     <div className="flex items-center gap-2">
                       <XCircle className="w-3.5 h-3.5 text-red-500" />
                       <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Impedimentos</span>
                     </div>
                     <span className="text-lg font-black text-red-700 tracking-tighter">{format(naoRealizadas)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-4 h-4 ${isWarning ? 'text-red-500' : 'text-emerald-500'}`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Índice de Insucesso</span>
                  </div>
                  <span className={`text-xl font-black ${isWarning ? 'text-red-600' : 'text-emerald-600'} italic`}>
                    {indicadorRecalculado.toFixed(2).replace('.', ',')}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 shadow-sm ${isWarning ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(indicadorRecalculado, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              Relatório de Atividade por Tipo
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TypeCards;
