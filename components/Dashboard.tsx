import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { EXACT_IMPEDIMENTO_CODES, MONTH_ORDER } from '../types';
import { 
  Target, XCircle, CheckCircle2, TrendingUp, BarChart3,
  Layers, PlayCircle, RotateCcw, Users, LayoutDashboard, Loader2,
  Calendar, CalendarDays, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';

const EXACT_CODES_SET = new Set(EXACT_IMPEDIMENTO_CODES);

export const Dashboard: React.FC = () => {
  const { records, loading, opcoesAnos, opcoesMeses, opcoesRazoes } = useData();

  // Selected filter states in dropdowns
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState<string>('');
  const [selectedRz, setSelectedRz] = useState<string>('');

  // Applied filter states (updated on "Gerar Relatório")
  const [appliedAno, setAppliedAno] = useState<string>('');
  const [appliedMes, setAppliedMes] = useState<string>('');
  const [appliedRz, setAppliedRz] = useState<string>('');
  const [hasGenerated, setHasGenerated] = useState<boolean>(true);

  // Chart Tab: 'razao' | 'mes' | 'ano'
  const [chartTab, setChartTab] = useState<'razao' | 'mes' | 'ano'>('razao');
  // Dynamic selection from chart for Análise por Tipo
  const [selectedChartKey, setSelectedChartKey] = useState<string | null>(null);

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedAno(selectedAno);
    setAppliedMes(selectedMes);
    setAppliedRz(selectedRz);
    setHasGenerated(true);
    setSelectedChartKey(null);
  };

  const handleNovaPesquisa = () => {
    setSelectedAno('');
    setSelectedMes('');
    setSelectedRz('');
    setAppliedAno('');
    setAppliedMes('');
    setAppliedRz('');
    setHasGenerated(true);
    setSelectedChartKey(null);
  };

  // Filtered dataset according to applied filters
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (appliedAno && String(r.Ano) !== appliedAno) return false;
      if (appliedMes && String(r.Mes).trim().toUpperCase() !== appliedMes.trim().toUpperCase()) return false;
      if (appliedRz && String(r.rz).padStart(2, '0') !== appliedRz.padStart(2, '0')) return false;
      return true;
    });
  }, [records, appliedAno, appliedMes, appliedRz]);

  // Main Metrics Calculation
  const metricas = useMemo(() => {
    const totalLeituras = filteredRecords.filter(r => r.instalacao && String(r.instalacao).trim() !== '').length;

    const naoRealizadas = filteredRecords.filter(r => {
      const code = String(r.nl || '').trim();
      return EXACT_CODES_SET.has(code);
    }).length;

    const realizadas = Math.max(0, totalLeituras - naoRealizadas);

    const percImpedimentos = realizadas > 0
      ? (naoRealizadas / realizadas) * 100
      : (naoRealizadas > 0 ? 100 : 0);

    return {
      totalLeituras,
      naoRealizadas,
      realizadas,
      percImpedimentos,
    };
  }, [filteredRecords]);

  // 1. GRÁFICO: POR RAZÃO
  const chartDataImpedimentosPorRazao = useMemo(() => {
    const rzMap = new Map<string, {
      razao: string;
      impedimentos: number;
      total: number;
      matriculasMap: Map<string, number>;
    }>();

    filteredRecords.forEach((r) => {
      const rz = String(r.rz || '01').padStart(2, '0');
      if (!rzMap.has(rz)) {
        rzMap.set(rz, {
          razao: rz,
          impedimentos: 0,
          total: 0,
          matriculasMap: new Map(),
        });
      }

      const item = rzMap.get(rz)!;
      item.total += 1;

      const isImp = EXACT_CODES_SET.has(String(r.nl || '').trim());
      if (isImp) {
        item.impedimentos += 1;
        const matr = String(r.matr || 'SEM_MATR').trim();
        item.matriculasMap.set(matr, (item.matriculasMap.get(matr) || 0) + 1);
      }
    });

    return Array.from(rzMap.values())
      .map((item) => {
        const matriculasDetalhadas = Array.from(item.matriculasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd);

        return {
          name: `Razão ${item.razao}`,
          key: item.razao,
          razao: item.razao,
          impedimentos: item.impedimentos,
          total: item.total,
          matriculasDetalhadas,
        };
      })
      .sort((a, b) => b.impedimentos - a.impedimentos);
  }, [filteredRecords]);

  // 2. GRÁFICO: POR MÊS
  const chartDataImpedimentosPorMes = useMemo(() => {
    const mesMap = new Map<string, {
      mes: string;
      impedimentos: number;
      total: number;
      matriculasMap: Map<string, number>;
    }>();

    filteredRecords.forEach((r) => {
      const mes = String(r.Mes || 'Sem Mês').trim();
      if (!mesMap.has(mes)) {
        mesMap.set(mes, {
          mes,
          impedimentos: 0,
          total: 0,
          matriculasMap: new Map(),
        });
      }

      const item = mesMap.get(mes)!;
      item.total += 1;

      const isImp = EXACT_CODES_SET.has(String(r.nl || '').trim());
      if (isImp) {
        item.impedimentos += 1;
        const matr = String(r.matr || 'SEM_MATR').trim();
        item.matriculasMap.set(matr, (item.matriculasMap.get(matr) || 0) + 1);
      }
    });

    return Array.from(mesMap.values())
      .map((item) => {
        const matriculasDetalhadas = Array.from(item.matriculasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd);

        return {
          name: item.mes,
          key: item.mes,
          impedimentos: item.impedimentos,
          total: item.total,
          matriculasDetalhadas,
        };
      })
      .sort((a, b) => {
        const orderA = MONTH_ORDER[a.name.toUpperCase()] || 99;
        const orderB = MONTH_ORDER[b.name.toUpperCase()] || 99;
        return orderA - orderB;
      });
  }, [filteredRecords]);

  // 3. GRÁFICO: POR ANO
  const chartDataImpedimentosPorAno = useMemo(() => {
    const anoMap = new Map<string, {
      ano: string;
      impedimentos: number;
      total: number;
      matriculasMap: Map<string, number>;
    }>();

    filteredRecords.forEach((r) => {
      const ano = String(r.Ano || 2026);
      if (!anoMap.has(ano)) {
        anoMap.set(ano, {
          ano,
          impedimentos: 0,
          total: 0,
          matriculasMap: new Map(),
        });
      }

      const item = anoMap.get(ano)!;
      item.total += 1;

      const isImp = EXACT_CODES_SET.has(String(r.nl || '').trim());
      if (isImp) {
        item.impedimentos += 1;
        const matr = String(r.matr || 'SEM_MATR').trim();
        item.matriculasMap.set(matr, (item.matriculasMap.get(matr) || 0) + 1);
      }
    });

    return Array.from(anoMap.values())
      .map((item) => {
        const matriculasDetalhadas = Array.from(item.matriculasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd);

        return {
          name: item.ano,
          key: item.ano,
          ano: item.ano,
          impedimentos: item.impedimentos,
          total: item.total,
          matriculasDetalhadas,
        };
      })
      .sort((a, b) => Number(a.key) - Number(b.key));
  }, [filteredRecords]);

  // Active chart data based on selected tab
  const activeChartData = useMemo(() => {
    if (chartTab === 'mes') return chartDataImpedimentosPorMes;
    if (chartTab === 'ano') return chartDataImpedimentosPorAno;
    return chartDataImpedimentosPorRazao;
  }, [chartTab, chartDataImpedimentosPorRazao, chartDataImpedimentosPorMes, chartDataImpedimentosPorAno]);

  // Análise por tipo de Leitura: acompanha dinamicamente o que for selecionado em cada uma dessas abas
  const dadosPorTipo = useMemo(() => {
    // Registros base para a análise por tipo
    let sourceRecords = filteredRecords;

    if (selectedChartKey) {
      if (chartTab === 'razao') {
        sourceRecords = sourceRecords.filter(r => String(r.rz).padStart(2, '0') === selectedChartKey.padStart(2, '0'));
      } else if (chartTab === 'mes') {
        sourceRecords = sourceRecords.filter(r => String(r.Mes).trim().toUpperCase() === selectedChartKey.trim().toUpperCase());
      } else if (chartTab === 'ano') {
        sourceRecords = sourceRecords.filter(r => String(r.Ano) === selectedChartKey);
      }
    }

    const tiposMap = new Map<string, { total: number; naoRealizadas: number }>();
    ['URBANO', 'POVOADO', 'RURAL'].forEach(t => {
      tiposMap.set(t, { total: 0, naoRealizadas: 0 });
    });

    sourceRecords.forEach((r) => {
      const tipo = (r.tipo || 'URBANO').trim().toUpperCase();
      if (!tiposMap.has(tipo)) {
        tiposMap.set(tipo, { total: 0, naoRealizadas: 0 });
      }
      const item = tiposMap.get(tipo)!;
      item.total += 1;
      const code = String(r.nl || '').trim();
      if (EXACT_CODES_SET.has(code)) {
        item.naoRealizadas += 1;
      }
    });

    return Array.from(tiposMap.entries())
      .filter(([tipo, d]) => d.total > 0 || ['URBANO', 'POVOADO', 'RURAL'].includes(tipo))
      .map(([tipo, d]) => {
        const realizadas = Math.max(0, d.total - d.naoRealizadas);
        const perc = realizadas > 0
          ? (d.naoRealizadas / realizadas) * 100
          : (d.naoRealizadas > 0 ? 100 : 0);
        return {
          tipo,
          total: d.total,
          naoRealizadas: d.naoRealizadas,
          realizadas,
          perc,
        };
      });
  }, [filteredRecords, chartTab, selectedChartKey]);

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatPercent = (val: number) => `${val.toFixed(2).replace('.', ',')}%`;

  // Resumo textual dinâmico
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = appliedAno ? `Ano: ${appliedAno}` : 'Ano: Todos';
    const mesTxt = appliedMes ? `Mês: ${appliedMes}` : 'Mês: Todos';
    const rzTxt = appliedRz ? `Razão: ${appliedRz}` : 'Razão: Todas';
    const totalRegistros = filteredRecords.length;
    return `Parâmetros Ativos: ${anoTxt} | ${mesTxt} | ${rzTxt} • Total de registros carregados: ${formatNumber(totalRegistros)}`;
  }, [appliedAno, appliedMes, appliedRz, filteredRecords]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 pb-12">
      {/* Título do menu no topo */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              1. Dashboard
            </h1>
            <p className="text-xs text-slate-400">
              Esboço gerar dos resultados selecionados
            </p>
          </div>
        </div>
      </div>

      {/* SELECIONE FILTROS - Estrutura idêntica aos demais menus */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Selecione Filtros:</span>
        </div>

        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Ano */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Ano
              </label>
              <select
                value={selectedAno}
                onChange={(e) => setSelectedAno(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos os Anos</option>
                {opcoesAnos.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Mês
              </label>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos os Meses</option>
                {opcoesMeses.map((mes) => (
                  <option key={mes} value={mes}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            {/* Razão */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Razão (rz)
              </label>
              <select
                value={selectedRz}
                onChange={(e) => setSelectedRz(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todas as Razões</option>
                {opcoesRazoes.map((rz) => (
                  <option key={rz} value={rz}>
                    {rz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumo Textual Dinâmico */}
          {hasGenerated && (
            <div className="pt-2 text-xs text-slate-300 font-mono bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
              <span>{resumoFiltrosTexto}</span>
            </div>
          )}

          {/* Botões Nova Pesquisa e Gerar Relatório */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleNovaPesquisa}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Nova Pesquisa
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center gap-2 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" /> Gerar Relatório
            </button>
          </div>
        </form>
      </div>

      {/* 4 CARDS DE MÉTRICAS PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Leituras a Realizar */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leituras a Realizar</span>
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight">
            {formatNumber(metricas.totalLeituras)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Contagem geral de registros com instalação</p>
        </div>

        {/* Leituras Não Realizadas */}
        <div 
          className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group cursor-help transition-all hover:border-red-500/40"
          title="Códigos de Não-Leitura considerados: 3201,3205,3245,3301,3312,3313,3369,3370,3374,3379,3901,3902,3903,3904,3905,3906,3907,3908,5101,5102,5103,5104,5105,5106,5107,5108,5109,5127,5260,5558,5800,5802,3376"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leituras Não Realizadas</span>
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-red-400 font-mono tabular-nums tracking-tight">
            {formatNumber(metricas.naoRealizadas)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Impedimentos apurados em campo</p>
        </div>

        {/* Leituras Realizadas */}
        <div 
          className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group cursor-help transition-all hover:border-emerald-500/40"
          title="Leituras realizadas em campo"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leituras Realizadas</span>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono tabular-nums tracking-tight">
            {formatNumber(metricas.realizadas)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Leituras realizadas em campo</p>
        </div>

        {/* Impedimento apurado (antigo % de Impedimentos) */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Impedimento apurado</span>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tabular-nums tracking-tight">
            {formatPercent(metricas.percImpedimentos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Indicador consolidado</p>
        </div>
      </div>

      {/* GRÁFICO DE BARRAS VERTICAL COM ABAS: POR RAZÃO, POR MÊS E POR ANO */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Relação Gráfico de Resultados
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {chartTab === 'razao' && 'Impedimentos consolidados por Razão (rz). Clique em uma barra para focar a análise inferior.'}
              {chartTab === 'mes' && 'Barras comparativas mensais de impedimento. Clique em um mês para focar a análise.'}
              {chartTab === 'ano' && 'Evolução anual de impedimentos apurados em campo.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Indicador de carregamento assíncrono (progressivo) */}
            {loading && (
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/40 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando base ({records.length.toLocaleString('pt-BR')} lidos...)</span>
              </span>
            )}

            {/* Abas do Gráfico */}
            <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setChartTab('razao');
                  setSelectedChartKey(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartTab === 'razao'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Por Razão
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTab('mes');
                  setSelectedChartKey(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartTab === 'mes'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Por Mês
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTab('ano');
                  setSelectedChartKey(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartTab === 'ano'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Por Ano
              </button>
            </div>
          </div>
        </div>

        {/* Badge se houver seleção de barra específica */}
        {selectedChartKey && (
          <div className="mb-4 flex items-center justify-between bg-blue-950/40 border border-blue-800/50 px-3.5 py-2 rounded-xl text-xs text-blue-200">
            <span className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Filtro ativo no gráfico: <strong>{selectedChartKey}</strong> (Análise por tipo recalculada para esta seleção)
              </span>
            </span>
            <button
              onClick={() => setSelectedChartKey(null)}
              className="text-cyan-400 hover:text-white font-bold underline cursor-pointer text-[11px]"
            >
              Limpar foco
            </button>
          </div>
        )}

        <div className="h-80 w-full">
          {loading && records.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400 font-mono">Conectando à base Supabase e montando relatórios...</span>
            </div>
          ) : activeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeChartData}
                margin={{ top: 25, right: 30, left: 10, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const item = e.activePayload[0].payload;
                    setSelectedChartKey(item.key === selectedChartKey ? null : item.key);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: '600' }}
                  dy={10}
                />
                <YAxis
                  stroke="#6b7280"
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const matrs = data.matriculasDetalhadas || [];
                      return (
                        <div className="bg-[#0b0f19] border border-slate-700 p-4 rounded-xl shadow-2xl text-xs space-y-2 min-w-[260px] max-w-[320px]">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-white text-sm">{data.name}</span>
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold font-mono">
                              {data.impedimentos} impedimentos
                            </span>
                          </div>

                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            Detalhamento por Matrícula:
                          </div>

                          {matrs.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                              {matrs.map((m: { matr: string; qtd: number }, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-800/50">
                                  <span className="font-mono text-slate-400">Matr: <strong className="text-white">{m.matr}</strong></span>
                                  <span className="font-mono text-red-400 font-bold">{m.qtd} imp.</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic">Nenhum impedimento registrado.</div>
                          )}

                          <div className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/60">
                            Clique na barra para focar a análise de tipos abaixo
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="impedimentos"
                  fill="#0284c7"
                  radius={[6, 6, 0, 0]}
                  barSize={38}
                  cursor="pointer"
                >
                  {activeChartData.map((entry, index) => {
                    const isSelected = selectedChartKey && (entry.key === selectedChartKey || entry.name === selectedChartKey);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          isSelected
                            ? '#38bdf8'
                            : index === 0
                            ? '#ef4444'
                            : index < 3
                            ? '#f97316'
                            : '#0284c7'
                        }
                      />
                    );
                  })}
                  <LabelList
                    dataKey="impedimentos"
                    position="top"
                    style={{ fill: '#9ca3af', fontSize: 10, fontWeight: '700' }}
                    offset={8}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Nenhum dado encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </div>

      {/* ANÁLISE POR TIPO DE LEITURA (3 CARDS INFERIORES POR TIPO) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Análise por tipo de Leitura
            </h3>
          </div>
          {selectedChartKey && (
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
              Foco: {selectedChartKey}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dadosPorTipo.map((item) => (
            <div
              key={item.tipo}
              className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    {item.tipo}
                  </span>
                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      item.perc > 0.50
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {formatPercent(item.perc)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase">Total</div>
                    <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                      {formatNumber(item.total)}
                    </div>
                  </div>
                  <div className="p-3 bg-red-950/20 rounded-xl border border-red-900/30">
                    <div className="text-[10px] text-red-400 uppercase">Não Realiz.</div>
                    <div className="text-base font-bold text-red-400 font-mono tabular-nums mt-0.5">
                      {formatNumber(item.naoRealizadas)}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-950/20 rounded-xl border border-emerald-900/30">
                    <div className="text-[10px] text-emerald-400 uppercase">Realizadas</div>
                    <div className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
                      {formatNumber(item.realizadas)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
                  <span>Taxa de Impedimento</span>
                  <span className={item.perc > 0.50 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {formatPercent(item.perc)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.perc > 0.50 ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(item.perc, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
