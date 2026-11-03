import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { EXTENDED_IMPEDIMENTO_CODES, FieldRecord } from '../types';
import { 
  PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, AlertTriangle, X,
  Building2, Home, Trees, Ban, Users, BarChart3, Percent, Layers, ListFilter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

const EXTENDED_CODES_SET = new Set(EXTENDED_IMPEDIMENTO_CODES);
const PAGE_SIZE = 20;

export const ControleLeiturista: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');
  const [filtroUlDe, setFiltroUlDe] = useState<string>('');
  const [filtroUlPara, setFiltroUlPara] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Abas das tabelas: 'matricula' (Relação por Matrícula) ou 'geral' (Relação de impedimentos Geral)
  const [activeTableTab, setActiveTableTab] = useState<'matricula' | 'geral'>('matricula');
  const [pageMatr, setPageMatr] = useState<number>(1);
  const [pageGeral, setPageGeral] = useState<number>(1);
  const [filtroNlGeral, setFiltroNlGeral] = useState<string>('');

  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [warningCollaborators, setWarningCollaborators] = useState<Array<{
    matr: string;
    rz: string;
    total: number;
    imp: number;
    indicador: number;
  }>>([]);

  const exportWarningToPDF = () => {
    if (warningCollaborators.length === 0) return;
    exportPdfReport({
      title: 'Alerta de Leituristas com Indicador de Impedimento Acima da Meta',
      subtitle: `Ano: ${filtroAno} | Mês: ${filtroMes} • Limiar Operacional: > 0,50%`,
      filters: `Total de Colaboradores em Alerta: ${warningCollaborators.length}`,
      filename: `SAL_Alerta_Impedimentos_${filtroMes}_${filtroAno}`,
      orientation: 'portrait',
      tables: [
        {
          title: 'Colaboradores Acima da Meta (> 0,50%)',
          headers: ['MATRÍCULA', 'RAZÃO', 'TOTAL LEITURAS', 'IMPEDIMENTOS', 'INDICADOR (%)'],
          data: warningCollaborators.map(c => [
            c.matr,
            `Razão ${c.rz}`,
            c.total,
            c.imp,
            `${c.indicador.toFixed(2).replace('.', ',')}%`
          ])
        }
      ]
    });
  };

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!filtroAno || !filtroMes) {
      setError('Ano e Mês são filtros obrigatórios antes de gerar a tabela.');
      return;
    }
    setError(null);
    setPageMatr(1);
    setPageGeral(1);
    setHasGenerated(true);

    // Verificação de colaboradores acima da meta (> 0.50%)
    const leituristasMap = new Map<string, { total: number; imp: number; matr: string; rz: string }>();
    const ulDeNum = filtroUlDe ? Number(filtroUlDe) : 0;
    const ulParaNum = filtroUlPara ? Number(filtroUlPara) : 99999999;

    records.forEach((r) => {
      if (String(r.Ano) !== filtroAno) return;
      if (String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return;
      
      const rzUl = Number(r.rz_ul_lv) || 0;
      if (rzUl < ulDeNum || rzUl > ulParaNum) return;

      const matr = String(r.matr || 'SEM_MATR').trim();
      if (!leituristasMap.has(matr)) {
        leituristasMap.set(matr, { total: 0, imp: 0, matr, rz: String(r.rz || '01') });
      }
      const item = leituristasMap.get(matr)!;
      item.total += 1;
      if (EXTENDED_CODES_SET.has(String(r.nl || '').trim())) {
        item.imp += 1;
      }
    });

    const highAlert = Array.from(leituristasMap.values())
      .map((item) => {
        const ind = item.total > 0 ? (item.imp / item.total) * 100 : 0;
        return { ...item, indicador: ind };
      })
      .filter((item) => item.indicador > 0.50)
      .sort((a, b) => b.indicador - a.indicador);

    if (highAlert.length > 0) {
      setWarningCollaborators(highAlert);
      setShowWarningModal(true);
    }
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroMes('');
    setFiltroMatr('');
    setFiltroUlDe('');
    setFiltroUlPara('');
    setFiltroNlGeral('');
    setHasGenerated(false);
    setError(null);
    setPageMatr(1);
    setPageGeral(1);
  };

  // Base filtrada em nível de registro bruto
  const rawFilteredRecords = useMemo(() => {
    if (!hasGenerated) return [];
    const ulDeNum = filtroUlDe ? Number(filtroUlDe) : 0;
    const ulParaNum = filtroUlPara ? Number(filtroUlPara) : 99999999;

    return records.filter((r) => {
      if (filtroAno && String(r.Ano) !== filtroAno) return false;
      if (filtroMes && String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return false;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return false;

      const rzUl = Number(r.rz_ul_lv) || 0;
      if (rzUl < ulDeNum || rzUl > ulParaNum) return false;

      return true;
    });
  }, [records, hasGenerated, filtroAno, filtroMes, filtroMatr, filtroUlDe, filtroUlPara]);

  // Registros que configuram impedimento para a aba "Relação de impedimentos Geral"
  const impedimentosGeralRecords = useMemo(() => {
    return rawFilteredRecords.filter((r) => EXTENDED_CODES_SET.has(String(r.nl || '').trim()));
  }, [rawFilteredRecords]);

  // Opções dinâmicas de códigos NL para filtro
  const opcoesNlGeral = useMemo(() => {
    const set = new Set<string>();
    impedimentosGeralRecords.forEach((r) => {
      const nl = String(r.nl || '').trim();
      if (nl) set.add(nl);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [impedimentosGeralRecords]);

  // Registros filtrados pelo código NL selecionado
  const filteredImpedimentosGeral = useMemo(() => {
    if (!filtroNlGeral) return impedimentosGeralRecords;
    return impedimentosGeralRecords.filter((r) => String(r.nl || '').trim() === filtroNlGeral.trim());
  }, [impedimentosGeralRecords, filtroNlGeral]);

  // Agrupamento por Matrícula
  const groupedData = useMemo(() => {
    if (!hasGenerated) return [];

    const map = new Map<string, {
      ano: number;
      mes: string;
      razao: string;
      ul: string;
      matr: string;
      leit_urb: number;
      leit_povoado: number;
      leit_rural: number;
      impedimentos: number;
    }>();

    rawFilteredRecords.forEach((r) => {
      const key = `${r.Ano}-${r.Mes}-${r.rz}-${r.rz_ul_lv}-${r.matr}`;
      if (!map.has(key)) {
        map.set(key, {
          ano: r.Ano,
          mes: r.Mes,
          razao: String(r.rz).padStart(2, '0'),
          ul: String(r.rz_ul_lv),
          matr: String(r.matr || '').trim(),
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

    return Array.from(map.values())
      .map((item) => {
        const leit_total = item.leit_urb + item.leit_povoado + item.leit_rural;
        const indicador = leit_total > 0 ? (item.impedimentos / leit_total) * 100 : 0;
        return {
          ...item,
          leit_total,
          indicador,
        };
      })
      .sort((a, b) => b.impedimentos - a.impedimentos);
  }, [rawFilteredRecords, hasGenerated]);

  // Cards Superiores
  const topCardsData = useMemo(() => {
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

    const totalLeit = urb + pov + rur;
    const indicadorConsolidado = totalLeit > 0 ? (imp / totalLeit) * 100 : 0;

    return { urb, pov, rur, imp, totalLeit, indicadorConsolidado };
  }, [groupedData]);

  // Gráfico do Menu: "Relação de NL realizadas como impedimento"
  // No hover da barra, mostra a quantidade de NL atribuída por Matrícula
  const chartDataCodigosNl = useMemo(() => {
    if (!hasGenerated) return [];

    const countsMap = new Map<string, {
      codigoNum: string;
      quantidade: number;
      matriculasMap: Map<string, number>;
    }>();

    rawFilteredRecords.forEach((r) => {
      const cod = String(r.nl || '').trim();
      if (EXTENDED_CODES_SET.has(cod)) {
        if (!countsMap.has(cod)) {
          countsMap.set(cod, {
            codigoNum: cod,
            quantidade: 0,
            matriculasMap: new Map(),
          });
        }
        const item = countsMap.get(cod)!;
        item.quantidade += 1;
        const matr = String(r.matr || 'SEM_MATR').trim();
        item.matriculasMap.set(matr, (item.matriculasMap.get(matr) || 0) + 1);
      }
    });

    return Array.from(countsMap.values())
      .map((entry) => {
        const matrs = Array.from(entry.matriculasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd);

        return {
          codigo: `Cód. ${entry.codigoNum}`,
          codigoNum: entry.codigoNum,
          quantidade: entry.quantidade,
          matriculasDetalhadas: matrs,
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [rawFilteredRecords, hasGenerated]);

  // Paginações
  const paginatedMatrData = useMemo(() => {
    const start = (pageMatr - 1) * PAGE_SIZE;
    return groupedData.slice(start, start + PAGE_SIZE);
  }, [groupedData, pageMatr]);

  const totalPagesMatr = Math.ceil(groupedData.length / PAGE_SIZE) || 1;

  const paginatedGeralData = useMemo(() => {
    const start = (pageGeral - 1) * PAGE_SIZE;
    return filteredImpedimentosGeral.slice(start, start + PAGE_SIZE);
  }, [filteredImpedimentosGeral, pageGeral]);

  const totalPagesGeral = Math.ceil(filteredImpedimentosGeral.length / PAGE_SIZE) || 1;

  // Resumo textual
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = filtroAno ? `Ano: ${filtroAno}` : 'Ano: Não Selecionado';
    const mesTxt = filtroMes ? `Mês: ${filtroMes}` : 'Mês: Não Selecionado';
    const matrTxt = filtroMatr ? `Matrícula: ${filtroMatr}` : 'Matrícula: Todas';
    const rangeUl = `Range UL: ${filtroUlDe || '0'} até ${filtroUlPara || '99999999'}`;
    return `Parâmetros Ativos: ${anoTxt} | ${mesTxt} | ${matrTxt} | ${rangeUl} • Grupos por Matrícula: ${groupedData.length} | Total Impedimentos Geral: ${impedimentosGeralRecords.length}`;
  }, [filtroAno, filtroMes, filtroMatr, filtroUlDe, filtroUlPara, groupedData, impedimentosGeralRecords]);

  // Exportar Excel
  const exportToExcel = () => {
    if (groupedData.length === 0 && impedimentosGeralRecords.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['Sistema de Análise de Leitura'],
      ['Relatório: Controle de Leiturista'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtro: Ano ${filtroAno} - Mês ${filtroMes} ${filtroMatr ? `(Matrícula ${filtroMatr})` : ''}`],
      [],
    ];

    // Sheet 1: Relação por Matrícula
    const headersMatr = [
      'ANO', 'MES', 'RAZAO', 'UL', 'MATR', 'LEIT. URB', 'LEIT. POVOADO',
      'LEIT. RURAL', 'LEIT. TOTAL', 'IMPEDIMENTOS', 'INDICADOR (%)'
    ];
    const dataRowsMatr = groupedData.map((r) => [
      r.ano, r.mes, r.razao, r.ul, r.matr, r.leit_urb, r.leit_povoado,
      r.leit_rural, r.leit_total, r.impedimentos, `${r.indicador.toFixed(2)}%`
    ]);
    const wsMatr = XLSX.utils.aoa_to_sheet([...titleRows, headersMatr, ...dataRowsMatr]);

    // Sheet 2: Relação de impedimentos Geral (ANO, MES, RAZAO, UL, TIPO, NL, DATA, HORA, ENDERECO)
    const headersGeral = ['ANO', 'MES', 'RAZAO', 'UL', 'TIPO', 'NL', 'DATA', 'HORA', 'ENDERECO'];
    const dataRowsGeral = impedimentosGeralRecords.map((r) => [
      r.Ano, r.Mes, r.rz, r.rz_ul_lv, r.tipo, r.nl, r.data_original, r.hora_original, r.endereco
    ]);
    const wsGeral = XLSX.utils.aoa_to_sheet([...titleRows, headersGeral, ...dataRowsGeral]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMatr, 'Relacao_por_Matricula');
    XLSX.utils.book_append_sheet(wb, wsGeral, 'Impedimentos_Geral');
    XLSX.writeFile(wb, `SAL_Controle_Leiturista_${filtroMes}_${filtroAno}_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF via jsPDF & autoTable
  const exportToPDF = () => {
    if (groupedData.length === 0 && impedimentosGeralRecords.length === 0) return;

    exportPdfReport({
      title: 'Controle de Leiturista – Relação de Impedimentos',
      subtitle: `Ano: ${filtroAno} | Mês: ${filtroMes} ${filtroMatr ? `| Matrícula: ${filtroMatr}` : ''}`,
      filters: resumoFiltrosTexto,
      filename: `SAL_Controle_Leiturista_${filtroMes}_${filtroAno}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'Relação por Matrícula (Consolidado)',
          headers: [
            'ANO', 'MES', 'RAZAO', 'UL', 'MATR', 'URB', 'POV', 'RUR', 'TOTAL', 'IMP', 'INDICADOR'
          ],
          data: groupedData.map((r) => [
            r.ano, r.mes, r.razao, r.ul, r.matr, r.leit_urb, r.leit_povoado,
            r.leit_rural, r.leit_total, r.impedimentos, `${r.indicador.toFixed(2)}%`
          ]),
        },
        {
          title: 'Relação de Impedimentos Geral (Ocorrências em Campo)',
          headers: ['ANO', 'MES', 'RAZAO', 'UL', 'TIPO', 'NL', 'DATA', 'HORA', 'ENDEREÇO'],
          data: impedimentosGeralRecords.slice(0, 150).map((r) => [
            r.Ano, r.Mes, r.rz, r.rz_ul_lv, r.tipo, r.nl, r.data_original, r.hora_original, r.endereco || '—'
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* WARNING MODAL: INDICADOR > 0.50% - CENTRALIZADO NO TOPO */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[160] flex items-start justify-center p-4 pt-6 sm:pt-10 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#111827] border-2 border-red-600 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto sm:my-0">
            <div className="p-4 sm:p-5 bg-red-950/80 border-b border-red-800 flex items-center justify-between text-red-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  CUIDADO: Colaboradores Acima da Meta (&gt; 0,50%)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportWarningToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/30 text-red-200 border border-red-500/40 hover:bg-red-600/50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Os seguintes leituristas apresentam indicador de não-realização acima do limiar regulatório operacional de{' '}
                <strong className="text-red-400 font-bold">0,50%</strong>. É necessária auditoria e verificação imediata:
              </p>

              <div className="border border-red-900/40 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0b0f19] text-slate-400 font-semibold border-b border-red-900/40 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">MATRÍCULA</th>
                      <th className="py-2.5 px-3">RAZÃO</th>
                      <th className="py-2.5 px-3 text-right">TOTAL LEITURAS</th>
                      <th className="py-2.5 px-3 text-right">IMPEDIMENTOS</th>
                      <th className="py-2.5 px-3 text-right">INDICADOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {warningCollaborators.map((c, i) => (
                      <tr key={i} className="hover:bg-red-950/30">
                        <td className="py-2 px-3 text-white font-bold">{c.matr}</td>
                        <td className="py-2 px-3 text-slate-300">Razão {c.rz}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{c.total.toLocaleString('pt-BR')}</td>
                        <td className="py-2 px-3 text-right text-red-400 font-bold">{c.imp}</td>
                        <td className="py-2 px-3 text-right font-black text-red-400 text-sm">
                          {c.indicador.toFixed(2).replace('.', ',')}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-[#0d1322] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Fechar Alerta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TÍTULO DO MENU NO TOPO */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              3.1. Controle de Leiturista
            </h1>
            <p className="text-xs text-slate-400">
              Relação consolidada de impedimentos por rota e monitoramento de leituristas
            </p>
          </div>
        </div>
      </div>

      {/* CAIXA DE FILTROS OBRIGATÓRIOS */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Selecione Filtros:</span>
        </div>

        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Ano Obrigatório */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ano <span className="text-red-400 font-bold">*</span>
              </label>
              <select
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Selecione o Ano</option>
                {opcoesAnos.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            {/* Mês Obrigatório */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Mês <span className="text-red-400 font-bold">*</span>
              </label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Selecione o Mês</option>
                {opcoesMeses.map((mes) => (
                  <option key={mes} value={mes}>
                    {mes}
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
                <option value="">Todas</option>
                {opcoesMatriculas.map((matr) => (
                  <option key={matr} value={matr}>
                    {matr}
                  </option>
                ))}
              </select>
            </div>

            {/* UL DE */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                UL DE (até 8 dígitos)
              </label>
              <input
                type="text"
                maxLength={8}
                placeholder="0"
                value={filtroUlDe}
                onChange={(e) => setFiltroUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* UL PARA */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                UL PARA (até 8 dígitos)
              </label>
              <input
                type="text"
                maxLength={8}
                placeholder="99999999"
                value={filtroUlPara}
                onChange={(e) => setFiltroUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              {error}
            </div>
          )}

          {/* Resumo Textual do Filtro Ativo */}
          {hasGenerated && (
            <div className="pt-2 text-xs text-slate-300 font-mono bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
              <span>{resumoFiltrosTexto}</span>
            </div>
          )}

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
          {/* 5 CARDS NO TOPO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Leit. Urb */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Urbano</span>
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-cyan-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {topCardsData.urb.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Perímetro urbano</p>
            </div>

            {/* Leit. Povoado */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Povoado</span>
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Home className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {topCardsData.pov.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Povoados/distritos</p>
            </div>

            {/* Leit. Rural */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leit. Rural</span>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Trees className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {topCardsData.rur.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Setor rural</p>
            </div>

            {/* Total de Impedimentos */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Impedimentos</span>
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <Ban className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-red-400 font-mono tabular-nums">
                {topCardsData.imp.toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Códigos de não-leitura</p>
            </div>

            {/* CARD INDICADOR (INFM) */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">INDICADOR</span>
                <div className={`p-2 rounded-xl border ${
                  topCardsData.indicadorConsolidado > 0.50
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-2xl font-black font-mono tabular-nums ${
                topCardsData.indicadorConsolidado > 0.50 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {topCardsData.indicadorConsolidado.toFixed(2).replace('.', ',')}%
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Taxa INFM consolidada
              </p>
            </div>
          </div>

          {/* GRÁFICO VERTICAL: RELAÇÃO DE NL REALIZADAS COMO IMPEDIMENTO */}
          {/* No hover da barra, mostra a quantidade de NL atribuída por Matrícula */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Relação de NL realizadas como impedimento
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Passe o cursor sobre cada código de não-leitura para verificar as ocorrências discriminadas por Matrícula
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-cyan-400 rounded-lg font-mono font-semibold self-start sm:self-auto">
                {chartDataCodigosNl.length} códigos ativos
              </span>
            </div>

            <div className="h-72 w-full">
              {chartDataCodigosNl.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataCodigosNl}
                    margin={{ top: 25, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis
                      dataKey="codigo"
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
                            <div className="bg-[#0b0f19] border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-2 min-w-[260px] max-w-[320px]">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span className="font-bold text-white">Código NL: {data.codigoNum}</span>
                                <span className="font-bold text-red-400 font-mono">{data.quantidade} total</span>
                              </div>
                              <div className="overflow-x-auto max-h-40 custom-scrollbar border border-slate-800 rounded-lg">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead className="bg-[#111827] text-slate-400 font-semibold border-b border-slate-800 uppercase">
                                    <tr>
                                      <th className="py-1 px-2.5">Matr</th>
                                      <th className="py-1 px-2.5 text-right">Ocorrência</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 font-mono">
                                    {matrs.map((m: { matr: string; qtd: number }, idx: number) => (
                                      <tr key={idx} className="hover:bg-slate-800/30">
                                        <td className="py-1 px-2.5 text-slate-200 font-bold">{m.matr}</td>
                                        <td className="py-1 px-2.5 text-right text-red-400 font-bold">{m.qtd}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="quantidade"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
                      barSize={36}
                    >
                      {chartDataCodigosNl.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#ef4444' : index < 3 ? '#f97316' : '#0284c7'}
                        />
                      ))}
                      <LabelList
                        dataKey="quantidade"
                        position="top"
                        style={{ fill: '#9ca3af', fontSize: 10, fontWeight: '700' }}
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Nenhum código de impedimento encontrado para os filtros selecionados.
                </div>
              )}
            </div>
          </div>

          {/* TABELAS COM ABAS: RELAÇÃO POR MATRÍCULA E RELAÇÃO DE IMPEDIMENTOS GERAL */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              {/* Seletor de Abas */}
              <div className="flex items-center gap-2 bg-[#080c14] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTableTab('matricula')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTableTab === 'matricula'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Relação por Matrícula ({groupedData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTableTab('geral')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTableTab === 'geral'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  Relação de impedimentos Geral ({impedimentosGeralRecords.length})
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

            {/* ABA 1: RELAÇÃO POR MATRÍCULA */}
            {activeTableTab === 'matricula' && (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">RAZAO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">UL</th>
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
                      {paginatedMatrData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-300">{row.ano}</td>
                          <td className="py-2.5 px-3.5 text-slate-200 font-sans font-medium">{row.mes}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{row.razao}</td>
                          <td className="py-2.5 px-3.5 text-cyan-400 font-bold">{row.ul}</td>
                          <td className="py-2.5 px-3.5 text-slate-300 font-bold">{row.matr}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_urb}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_povoado}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.leit_rural}</td>
                          <td className="py-2.5 px-3.5 text-right text-white font-bold">{row.leit_total}</td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-red-400">{row.impedimentos}</td>
                          <td
                            className={`py-2.5 px-3.5 text-right font-bold ${
                              row.indicador > 0.50 ? 'text-red-400 font-black' : 'text-emerald-400'
                            }`}
                          >
                            {row.indicador.toFixed(2).replace('.', ',')}%
                          </td>
                        </tr>
                      ))}
                      {paginatedMatrData.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação de 20 registros */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pageMatr}</strong> de <strong className="text-white">{totalPagesMatr}</strong> (Total: {groupedData.length} registros)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pageMatr <= 1}
                      onClick={() => setPageMatr((p) => p - 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={pageMatr >= totalPagesMatr}
                      onClick={() => setPageMatr((p) => p + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTableTab === 'geral' && (
              <>
                {/* FILTRO DINÂMICO DE NL ACIMA DA TABELA */}
                <div className="p-3 bg-[#0d1322] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <div className="flex items-center gap-2.5">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Filtrar Código NL:
                    </label>
                    <select
                      value={filtroNlGeral}
                      onChange={(e) => {
                        setFiltroNlGeral(e.target.value);
                        setPageGeral(1);
                      }}
                      className="px-3 py-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                    >
                      <option value="">Todos os Códigos NL ({opcoesNlGeral.length})</option>
                      {opcoesNlGeral.map((nl) => (
                        <option key={nl} value={nl}>
                          Cód. {nl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Mostrando <strong className="text-white">{filteredImpedimentosGeral.length}</strong> de {impedimentosGeralRecords.length} impedimentos
                  </span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">RAZAO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">UL</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">TIPO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-center">NL</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">DATA</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">HORA</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">ENDEREÇO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                      {paginatedGeralData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-300">{row.Ano}</td>
                          <td className="py-2.5 px-3.5 text-slate-200 font-sans font-medium">{row.Mes}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{String(row.rz).padStart(2, '0')}</td>
                          <td className="py-2.5 px-3.5 text-cyan-400 font-bold">{row.rz_ul_lv}</td>
                          <td className="py-2.5 px-3.5 text-slate-300 font-sans">{row.tipo || '—'}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              {row.nl}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-300">{row.data_original || '—'}</td>
                          <td className="py-2.5 px-3.5 text-slate-300">{row.hora_original || '—'}</td>
                          <td className="py-2.5 px-3.5 font-sans text-slate-300 max-w-[280px] truncate" title={row.endereco}>
                            {row.endereco || '—'}
                          </td>
                        </tr>
                      ))}
                      {paginatedGeralData.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro de impedimento encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação da aba geral */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pageGeral}</strong> de <strong className="text-white">{totalPagesGeral}</strong> (Total: {impedimentosGeralRecords.length} impedimentos)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pageGeral <= 1}
                      onClick={() => setPageGeral((p) => p - 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={pageGeral >= totalPagesGeral}
                      onClick={() => setPageGeral((p) => p + 1)}
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

export default ControleLeiturista;
