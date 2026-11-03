import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { ImpedimentoMatricula, ImpedimentoRazao } from '../types';
import { Users, Layers, AlertCircle } from 'lucide-react';

interface ChartsProps {
  dadosMatricula: ImpedimentoMatricula[];
  dadosRazao: ImpedimentoRazao[];
}

const COLORS = {
  primary: '#3b82f6', // Blue 500
  textRed: '#ef4444', // Red 500 para percentual
};

const CustomLabel = (props: any) => {
  const { x, y, width, index, data } = props;
  const item = data && data[index];
  
  if (!item) return null;
  
  // Regra OBRIGATÓRIA: Leituras NÃO realizadas = qtd_impedimentos
  const impedimentos = Number(item.qtd_impedimentos) || 0;
  // Regra OBRIGATÓRIA: Leituras realizadas = qtd_leituras − qtd_impedimentos (já calculado no useMemo)
  const realizadas = Number(item.realizadas) || 0;
  
  // % Impedimentos = (Leituras NÃO realizadas ÷ Leituras realizadas) × 100
  const perc = realizadas > 0 ? (impedimentos / realizadas) * 100 : (impedimentos > 0 ? 100 : 0);
  
  return (
    <text 
      x={x + width / 2} 
      y={y - 15} 
      fill={COLORS.textRed} 
      textAnchor="middle" 
      fontSize="11px" 
      fontWeight="900"
      className="italic"
    >
      {`${perc.toFixed(2).replace('.', ',')}%`}
    </text>
  );
};

const Charts: React.FC<ChartsProps> = ({ dadosMatricula, dadosRazao }) => {
  const [activeTab, setActiveTab] = useState<'leiturista' | 'razao'>('leiturista');

  const currentData = useMemo(() => {
    if (activeTab === 'leiturista') {
      return (dadosMatricula || []).map(item => ({
        label: String(item.matricula || 'N/A'),
        qtd_impedimentos: Number(item.qtd_impedimentos) || 0,
        realizadas: (Number(item.qtd_leituras) || 0) - (Number(item.qtd_impedimentos) || 0)
      }));
    } else {
      return (dadosRazao || []).map(item => ({
        label: String(item.razao || 'N/A'),
        qtd_impedimentos: Number(item.qtd_impedimentos) || 0,
        realizadas: (Number(item.qtd_leituras) || 0) - (Number(item.qtd_impedimentos) || 0)
      }));
    }
  }, [activeTab, dadosMatricula, dadosRazao]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const labelType = activeTab === 'leiturista' ? 'Matrícula' : 'Razão';
      
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-2xl rounded-2xl ring-1 ring-slate-900/5 min-w-[240px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {labelType}
              </span>
              <span className="text-xs font-black text-slate-900">{dataPoint.label}</span>
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-50">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                Quantidade de impedimentos
              </span>
              <span className="text-xs font-black text-red-500">
                {Number(dataPoint.qtd_impedimentos).toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                Quantidade de leituras realizadas
              </span>
              <span className="text-xs font-black text-emerald-600">
                {Number(dataPoint.realizadas).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasVisualData = currentData.length > 0;

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl h-[600px] flex flex-col group hover:shadow-2xl transition-all duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            Distribuição de Impedimentos
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Visualização por {activeTab === 'leiturista' ? 'Leiturista (Matrícula)' : 'Razão (Código)'}
          </p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl self-start">
          <button 
            onClick={() => setActiveTab('leiturista')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'leiturista' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="w-4 h-4" />
            Leiturista
          </button>
          <button 
            onClick={() => setActiveTab('razao')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'razao' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Layers className="w-4 h-4" />
            Razão
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {hasVisualData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={currentData}
              margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '800' }} 
                interval={0}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} 
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: 'rgba(241, 245, 249, 0.5)', radius: 8 }} 
              />
              
              <Bar 
                dataKey="qtd_impedimentos" 
                fill={COLORS.primary} 
                radius={[6, 6, 0, 0]} 
                barSize={48}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                <LabelList 
                  dataKey="qtd_impedimentos" 
                  content={<CustomLabel data={currentData} />}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-5 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
            <div className="p-4 bg-white rounded-full shadow-sm">
              <AlertCircle className="w-10 h-10 opacity-40 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Aguardando Parâmetros</p>
              <p className="text-[9px] font-bold text-slate-300 uppercase">Ajuste os filtros para carregar a matriz gráfica</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;