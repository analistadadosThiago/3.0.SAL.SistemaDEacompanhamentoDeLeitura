import React from 'react';
import { MetricasPrincipais } from '../types';
import { Target, XCircle, CheckCircle2, TrendingUp, Activity, BarChart2 } from 'lucide-react';

interface SummaryCardsProps {
  metricas: MetricasPrincipais;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ metricas }) => {
  const format = (n: any) => {
    const val = Number(n);
    if (isNaN(val)) return "0";
    return val.toLocaleString('pt-BR');
  };

  const getPercentColor = (p: any) => {
    const val = Number(p);
    if (val < 1) return 'text-emerald-500'; 
    if (val <= 5) return 'text-amber-500';
    return 'text-red-500';
  };

  const percValue = Number(metricas?.perc_impedimentos || 0);

  const cards = [
    {
      title: 'Target Load',
      value: format(metricas?.total_leituras),
      icon: <Target className="w-5 h-5 text-blue-500" />,
      sub: 'Carga Total Processada',
      accent: 'bg-blue-500'
    },
    {
      title: 'Failed Nodes',
      value: format(metricas?.nao_realizadas),
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      sub: 'Impedimentos Registrados',
      accent: 'bg-red-500'
    },
    {
      title: 'Successful Ops',
      value: format(metricas?.realizadas),
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      sub: 'Leituras Concluídas',
      accent: 'bg-emerald-500'
    },
    {
      title: 'Core KPI',
      value: `${percValue.toFixed(2).replace('.', ',')}%`,
      icon: <Activity className="w-5 h-5 text-slate-600" />,
      sub: 'Taxa de Insucesso',
      isPercent: true,
      accent: 'bg-slate-900'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div 
          key={idx} 
          className="bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-xl transition-all hover:-translate-y-2 hover:shadow-2xl duration-500 group relative overflow-hidden"
        >
          {/* Accent indicator */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${card.accent} opacity-10 group-hover:opacity-100 transition-opacity`}></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-white group-hover:shadow-md transition-all duration-500">
                  {card.icon}
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">{card.title}</h3>
              </div>
              <BarChart2 className="w-4 h-4 text-slate-200" />
            </div>

            <div className={`text-4xl font-extrabold tracking-tighter mb-2 ${card.isPercent ? getPercentColor(percValue) : 'text-slate-900'}`}>
              {card.value}
            </div>

            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-1">
              {card.sub}
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-blue-50 transition-colors duration-700 opacity-40"></div>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;