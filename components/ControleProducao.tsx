import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { EXTENDED_IMPEDIMENTO_CODES } from '../types';
import { 
  TrendingUp, PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Building2, Home, Trees, Ban, Percent,
  BarChart3, Users, DollarSign, Layers, ListFilter, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

const EXTENDED_CODES_SET = new Set(EXTENDED_IMPEDIMENTO_CODES);
const PAGE_SIZE = 20;
const SPECIAL_MATRICULAS = new Set(['5JL', '5IL', '4NI']);

export const ControleProducao: React.FC = () => {
  const { records, loading, opcoesAnos, opcoesMatriculas, opcoesCiclos } = useData();

  // Filtros
  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroCiclo, setFiltroCiclo] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'quantidade' | 'pagamentos'>('quantidade');
  const [pageQtd, setPageQtd] = useState<number>(1);
  const [pagePag, setPagePag] = useState<number>(1);

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPageQtd(1);
    setPagePag(1);
    setHasGenerated(true);
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroCiclo('');
    setFiltroMatr('');
    setHasGenerated(true);
    setPageQtd(1);
    setPagePag(1);
  };

  // Base filtrada bruta
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filtroAno && String(r.Ano) !== filtroAno) return false;
      if (filtroCiclo && String(r.ciclo || '').trim() !== filtroCiclo.trim()) return false;
      if (filtroMatr && String(r.matr || '').trim() !== filtroMatr.trim()) return false;
      return true;
    });
  }, [records, filtroAno, filtroCiclo, filtroMatr]);

  // Agrupamento e somatório por MATR (RAZÃO removida)
  const groupedData = useMemo(() => {
    const map = new Map<string, {
      ano: number;
      mes: string;
      ciclo: string;
      matr: string;
      leit_urb: number;
      leit_povoado: number;
      leit_rural: number;
      impedimentos: number;
    }>();

    filteredRecords.forEach((r) => {
      const ano = r.Ano || 2026;
      const mes = r.Mes || '';
      const ciclo = r.ciclo || 'PADRAO';
      const matr = String(r.matr || 'SEM_MATR').trim();
      const key = `${ano}_${mes}_${ciclo}_${matr}`;

      if (!map.has(key)) {
        map.set(key, {
          ano,
          mes,
          ciclo,
          matr,
          leit_urb: 0,
          leit_povoado: 0,
          leit_rural: 0,
          impedimentos: 0,
        });
      }

      const item = map.get(key)!;
      const tipo = (r.tipo || '').toUpperCase();
      if (tipo.includes('URB')) {
        item.leit_urb += 1;
      } else if (tipo.includes('POV')) {
        item.leit_povoado += 1;
      } else if (tipo.includes('RUR')) {
        item.leit_rural += 1;
      } else {
        item.leit_urb += 1;
      }

      if (EXTENDED_CODES_SET.has(String(r.nl || '').trim())) {
        item.impedimentos += 1;
      }
    });

    return Array.from(map.values()).map((item) => {
      const leit_total = item.leit_urb + item.leit_povoado + item.leit_rural;
      const indicador = leit_total > 0 ? (item.impedimentos / leit_total) * 100 : 0;

      // Regras de Pagamento:
      // LEITURAS A PAGAR: Deve ser o somatório de LEIT. URB acima de 8000, subtraindo o valor que está em IMPEDIMENTO.
      // (Exemplo: se tiver 9000 leituras em LEIT. URB, aqui deve constar 1000, mas descontando os impedimentos).
      // Além disso, para as matrículas 5JL, 5IL e 4NI, traga esse somatório e adicione também o que tiver em Leit. Rural.
      const excessoUrb = Math.max(0, item.leit_urb - 8000);
      const isSpecialMatr = SPECIAL_MATRICULAS.has(item.matr.toUpperCase());
      const baseProducao = isSpecialMatr ? (excessoUrb + item.leit_rural) : excessoUrb;
      const leiturasAPagar = Math.max(0, baseProducao - item.impedimentos);

      // PREMIAÇÃO: Deve trazer o valor de R$ 100,00 apenas para os que tiverem o INDICADOR abaixo de 0,50%.
      // (Exemplo: se o INDICADOR for 0,51% ou mais, escreva "N-OK"; se for igual ou inferior a 0,50%, escreva "R$ 100,00").
      const isPremiado = indicador <= 0.50;
      const premiacao = isPremiado ? 'R$ 100,00' : 'N-OK';
      const valorTotal = isPremiado ? 'R$ 100,00' : 'R$ 0,00';

      return {
        ...item,
        leit_total,
        indicador,
        leiturasAPagar,
        premiacao,
        valorTotal,
      };
    }).sort((a, b) => b.impedimentos - a.impedimentos); // Ordenação pela coluna IMPEDIMENTOS de forma decrescente
  }, [filteredRecords]);

  // Cards de resumo
  const cardsResumo = useMemo(() => {
    let urb = 0;
    let pov = 0;
    let rur = 0;
    let imp = 0;

    groupedData.forEach((row) => {
      urb += row.leit_urb;
      pov += row.leit_povoado;
      rur += row.leit_rural;
      imp += row.impedimentos;
    });

    const total = urb + pov + rur;
    const indicador = total > 0 ? (imp / total) * 100 : 0;

    return { urb, pov, rur, imp, total, indicador };
  }, [groupedData]);

  // Gráfico: Quantidade de impedimentos por Matrícula
  // Tooltip: Leit. Urbano, Leit. Povoado, Leit. Rural, Impedimentos, INDICADOR
  const chartDataMatricula = useMemo(() => {
    const matrMap = new Map<string, {
      matr: string;
      leit_urb: number;
      leit_povoado: number;
      leit_rural: number;
      impedimentos: number;
      total: number;
    }>();

    groupedData.forEach((row) => {
      if (!matrMap.has(row.matr)) {
        matrMap.set(row.matr, {
          matr: row.matr,
          leit_urb: 0,
          leit_povoado: 0,
          leit_rural: 0,
          impedimentos: 0,
          total: 0,
        });
      }
      const item = matrMap.get(row.matr)!;
      item.leit_urb += row.leit_urb;
      item.leit_povoado += row.leit_povoado;
      item.leit_rural += row.leit_rural;
      item.impedimentos += row.impedimentos;
      item.total += row.leit_total;
    });

    return Array.from(matrMap.values())
      .map((item) => {
        const indicador = item.total > 0 ? (item.impedimentos / item.total) * 100 : 0;
        return {
          ...item,
          name: item.matr,
          indicador,
        };
      })
      .sort((a, b) => b.impedimentos - a.impedimentos)
      .slice(0, 25);
  }, [groupedData]);

  // Paginação Tabela 1: Quantidade de Leitura
  const paginatedQtd = useMemo(() => {
    const start = (pageQtd - 1) * PAGE_SIZE;
    return groupedData.slice(start, start + PAGE_SIZE);
  }, [groupedData, pageQtd]);

  const totalPagesQtd = Math.ceil(groupedData.length / PAGE_SIZE) || 1;

  // Paginação Tabela 2: Relação de Pagamentos
  const paginatedPag = useMemo(() => {
    const start = (pagePag - 1) * PAGE_SIZE;
    return groupedData.slice(start, start + PAGE_SIZE);
  }, [groupedData, pagePag]);

  const totalPagesPag = Math.ceil(groupedData.length / PAGE_SIZE) || 1;

  // Exportar Excel
  const exportToExcel = () => {
    if (groupedData.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['SAL – Sistema de Análise de Leitura'],
      ['Relatório: 3.3. Controle de Produção'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtros: Ano ${filtroAno || 'Todos'} | Ciclo ${filtroCiclo || 'Todos'} | Matrícula ${filtroMatr || 'Todas'}`],
      [],
    ];

    // Sheet 1: Quantidade de Leitura
    const headersQtd = [
      'ANO', 'MÊS', 'CICLO', 'MATR',
      'LEIT. URB', 'LEIT. POVOADO', 'LEIT. RURAL', 'LEIT. TOTAL',
      'IMPEDIMENTOS', 'INDICADOR (%)'
    ];
    const dataQtd = groupedData.map((r) => [
      r.ano, r.mes, r.ciclo, r.matr,
      r.leit_urb, r.leit_povoado, r.leit_rural, r.leit_total,
      r.impedimentos, `${r.indicador.toFixed(2).replace('.', ',')}%`
    ]);
    const wsQtd = XLSX.utils.aoa_to_sheet([...titleRows, headersQtd, ...dataQtd]);

    // Sheet 2: Relação de Pagamentos
    const headersPag = [
      'ANO', 'MÊS', 'CICLO', 'MATR', 'IMPEDIMENTO',
      'LEITURAS A PAGAR', 'PREMIAÇÃO', 'VALOR TOTAL'
    ];
    const dataPag = groupedData.map((r) => [
      r.ano, r.mes, r.ciclo, r.matr, r.impedimentos,
      r.leiturasAPagar, r.premiacao, r.valorTotal
    ]);
    const wsPag = XLSX.utils.aoa_to_sheet([...titleRows, headersPag, ...dataPag]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsQtd, 'Quantidade_de_Leitura');
    XLSX.utils.book_append_sheet(wb, wsPag, 'Relacao_de_Pagamentos');
    XLSX.writeFile(wb, `SAL_Controle_Producao_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF
  const exportToPDF = () => {
    if (groupedData.length === 0) return;

    exportPdfReport({
      title: 'Controle de Produção e Remuneração',
      subtitle: `Ano: ${filtroAno || 'Todos'} | Ciclo: ${filtroCiclo || 'Todos'} | Matrícula: ${filtroMatr || 'Todas'}`,
      filters: `Total de registros consolidados: ${groupedData.length}`,
      filename: `SAL_Controle_Producao_${new Date().toISOString().slice(0, 10)}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'Relação de Quantidade de Leitura',
          headers: ['ANO', 'MÊS', 'CICLO', 'MATR', 'URB', 'POV', 'RUR', 'TOTAL', 'IMP', 'INDICADOR'],
          data: groupedData.slice(0, 150).map((r) => [
            r.ano, r.mes, r.ciclo, r.matr,
            r.leit_urb, r.leit_povoado, r.leit_rural, r.leit_total,
            r.impedimentos, `${r.indicador.toFixed(2).replace('.', ',')}%`
          ]),
        },
        {
          title: 'Relação de Pagamentos',
          headers: ['ANO', 'MÊS', 'CICLO', 'MATR', 'IMPEDIMENTO', 'LEITURAS A PAGAR', 'PREMIAÇÃO', 'VALOR TOTAL'],
          data: groupedData.slice(0, 150).map((r) => [
            r.ano, r.mes, r.ciclo, r.matr, r.impedimentos,
            r.leiturasAPagar, r.premiacao, r.valorTotal
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* Título do menu no topo */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              3.3. Controle de Produção
            </h1>
            <p className="text-xs text-slate-400">
              Desempenho de leitura por ciclo, apuração de metas e controle de pagamentos
            </p>
          </div>
        </div>
      </div>

      {/* FILTROS NO TOPO: Ano, Ciclo, Matrícula */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Selecione Filtros:</span>
        </div>

        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Ano */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ano
              </label>
              <select
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
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

            {/* Ciclo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ciclo
              </label>
              <select
                value={filtroCiclo}
                onChange={(e) => setFiltroCiclo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos os Ciclos ({opcoesCiclos.length})</option>
                {opcoesCiclos.map((ciclo) => (
                  <option key={ciclo} value={ciclo}>
                    {ciclo}
                  </option>
                ))}
              </select>
            </div>

            {/* Matrícula */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Matrícula
              </label>
              <select
                value={filtroMatr}
                onChange={(e) => setFiltroMatr(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todas as Matrículas ({opcoesMatriculas.length})</option>
                {opcoesMatriculas.map((matr) => (
                  <option key={matr} value={matr}>
                    {matr}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

      {hasGenerated && (
        <div className="space-y-8 animate-fade-in">
          {/* CARDS DE RESUMO: Leit. Urbano, Leit. Povoado, Leit. Rural, Impedimentos, INDICADOR (%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Urbano</span>
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-cyan-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {cardsResumo.urb.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Perímetro urbano</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Povoado</span>
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Home className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {cardsResumo.pov.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Povoados/distritos</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Rural</span>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Trees className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {cardsResumo.rur.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Setor rural</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Impedimentos</span>
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <Ban className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-red-400 font-mono tabular-nums">
                {cardsResumo.imp.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Total não-realizadas</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">INDICADOR</span>
                <div className={`p-2 rounded-xl border ${
                  cardsResumo.indicador > 0.50
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-2xl font-black font-mono tabular-nums ${
                cardsResumo.indicador > 0.50 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {cardsResumo.indicador.toFixed(2).replace('.', ',')}%
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Taxa percentual</p>
            </div>
          </div>

          {/* GRÁFICO: Quantidade de impedimentos por Matrícula */}
          {/* Tooltip: Leit. Urbano, Leit. Povoado, Leit. Rural, Impedimentos, INDICADOR */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Quantidade de Impedimentos por Matrícula
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Passe o cursor sobre cada barra para visualizar detalhamento completo dos tipos de leitura e indicador
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-cyan-400 rounded-lg font-mono font-semibold self-start sm:self-auto">
                {chartDataMatricula.length} matrículas exibidas
              </span>
            </div>

            <div className="h-80 w-full">
              {loading && records.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="text-xs text-slate-400 font-mono">Carregando dados da produção...</span>
                </div>
              ) : chartDataMatricula.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataMatricula}
                    margin={{ top: 25, right: 30, left: 10, bottom: 20 }}
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
                          return (
                            <div className="bg-[#0b0f19] border border-slate-700 p-4 rounded-xl shadow-2xl text-xs space-y-2.5 min-w-[260px]">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-bold text-white text-sm">Matrícula: {data.matr}</span>
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                  data.indicador > 0.50 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {data.indicador.toFixed(2).replace('.', ',')}%
                                </span>
                              </div>

                              <div className="space-y-1.5 font-mono text-[11px]">
                                <div className="flex justify-between text-slate-300">
                                  <span>Leit. Urbano:</span>
                                  <strong className="text-white">{data.leit_urb.toLocaleString('pt-BR')}</strong>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span>Leit. Povoado:</span>
                                  <strong className="text-white">{data.leit_povoado.toLocaleString('pt-BR')}</strong>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span>Leit. Rural:</span>
                                  <strong className="text-white">{data.leit_rural.toLocaleString('pt-BR')}</strong>
                                </div>
                                <div className="flex justify-between border-t border-slate-800/80 pt-1 text-red-400 font-bold">
                                  <span>Impedimentos:</span>
                                  <span>{data.impedimentos.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between text-cyan-400 font-bold">
                                  <span>Total Leituras:</span>
                                  <span>{data.total.toLocaleString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="impedimentos"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
                      barSize={36}
                    >
                      {chartDataMatricula.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.indicador > 0.50 ? '#ef4444' : '#0284c7'}
                        />
                      ))}
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

          {/* TABELAS: COM ABAS "Relação de quantidade de Leitura" e "Relação de Pagamentos" */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              {/* Abas */}
              <div className="flex items-center gap-2 bg-[#080c14] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('quantidade')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'quantidade'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Relação de quantidade de Leitura ({groupedData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pagamentos')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'pagamentos'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Relação de Pagamentos ({groupedData.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>

            {/* TABELA 1: Relação de quantidade de Leitura */}
            {activeTab === 'quantidade' && (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MÊS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">CICLO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MATR</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">LEIT. URB</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">LEIT. POVOADO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">LEIT. RURAL</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">LEIT. TOTAL</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">IMPEDIMENTOS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">INDICADOR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                      {paginatedQtd.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-300">{row.ano}</td>
                          <td className="py-2.5 px-3.5 text-slate-200 font-sans font-medium">{row.mes}</td>
                          <td className="py-2.5 px-3.5 text-cyan-300 font-bold">{row.ciclo}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{row.matr}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_urb.toLocaleString('pt-BR')}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_povoado.toLocaleString('pt-BR')}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_rural.toLocaleString('pt-BR')}</td>
                          <td className="py-2.5 px-3.5 text-right text-white font-bold">{row.leit_total.toLocaleString('pt-BR')}</td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-red-400">{row.impedimentos.toLocaleString('pt-BR')}</td>
                          <td
                            className={`py-2.5 px-3.5 text-right font-bold ${
                              row.indicador > 0.50 ? 'text-red-400 font-black' : 'text-emerald-400'
                            }`}
                          >
                            {row.indicador.toFixed(2).replace('.', ',')}%
                          </td>
                        </tr>
                      ))}
                      {paginatedQtd.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pageQtd}</strong> de <strong className="text-white">{totalPagesQtd}</strong> (Total: {groupedData.length} registros)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pageQtd <= 1}
                      onClick={() => setPageQtd((p) => p - 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={pageQtd >= totalPagesQtd}
                      onClick={() => setPageQtd((p) => p + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* TABELA 2: Relação de Pagamentos */}
            {activeTab === 'pagamentos' && (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MÊS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">CICLO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MATR</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">IMPEDIMENTO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">LEITURAS A PAGAR</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-center">PREMIAÇÃO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">VALOR TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                      {paginatedPag.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-300">{row.ano}</td>
                          <td className="py-2.5 px-3.5 text-slate-200 font-sans font-medium">{row.mes}</td>
                          <td className="py-2.5 px-3.5 text-cyan-300 font-bold">{row.ciclo}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{row.matr}</td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-red-400">{row.impedimentos}</td>
                          <td className="py-2.5 px-3.5 text-right text-cyan-400 font-bold">
                            {row.leiturasAPagar.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              row.premiacao === 'R$ 100,00'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {row.premiacao}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-black text-white text-sm">
                            {row.valorTotal}
                          </td>
                        </tr>
                      ))}
                      {paginatedPag.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pagePag}</strong> de <strong className="text-white">{totalPagesPag}</strong> (Total: {groupedData.length} registros)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pagePag <= 1}
                      onClick={() => setPagePag((p) => p - 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={pagePag >= totalPagesPag}
                      onClick={() => setPagePag((p) => p + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleProducao;
