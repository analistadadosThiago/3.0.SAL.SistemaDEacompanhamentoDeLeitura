import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  PlayCircle, RotateCcw, FileSpreadsheet, FileText, 
  ChevronLeft, ChevronRight, Camera, Target, CheckCircle2, 
  XCircle, TrendingUp, AlertTriangle, Layers, ListFilter, Users, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

const PAGE_SIZE = 20;

export const ControleEvidencias: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');
  const [filtroUlDe, setFiltroUlDe] = useState<string>('');
  const [filtroUlPara, setFiltroUlPara] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Abas: 'geral' (Relatório Geral) ou 'matricula' (Relação de dados por matrícula)
  const [activeTab, setActiveTab] = useState<'geral' | 'matricula'>('geral');
  const [pageGeral, setPageGeral] = useState<number>(1);
  const [pageMatr, setPageMatr] = useState<number>(1);

  // Controle de hover separado para as barras do gráfico (Foto OK vs Foto N-OK)
  const [hoveredBarType, setHoveredBarType] = useState<'realizadas' | 'nao_realizadas' | null>(null);

  // Modal de Alerta: Evidências inferiores ao esperado
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [alertCollaborators, setAlertCollaborators] = useState<Array<{
    mes: string;
    ano: number;
    razao: string;
    matr: string;
    solicitadas: number;
    realizadas: number;
    nao_realizadas: number;
    indicador: number;
  }>>([]);

  // Base filtrada
  const filteredBase = useMemo(() => {
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

  // Totais Gerais (Cards Superiores)
  const totaisGerais = useMemo(() => {
    let solicitadas = 0;
    let realizadas = 0;

    filteredBase.forEach((r) => {
      const isSolicitada = (Number(r.digitacao) || 1) >= 2;
      if (isSolicitada) {
        solicitadas += 1;
        if (String(r.foto || '').trim().toUpperCase() === 'OK') {
          realizadas += 1;
        }
      }
    });

    const nao_realizadas = Math.max(0, solicitadas - realizadas);
    const indicador = solicitadas > 0 ? (realizadas / solicitadas) * 100 : 0;

    return { solicitadas, realizadas, nao_realizadas, indicador };
  }, [filteredBase]);

  // RELATÓRIO GERAL (por Razão)
  const reportGeralPorRazao = useMemo(() => {
    const map = new Map<string, {
      mes: string;
      ano: number;
      razao: string;
      solicitadas: number;
      realizadas: number;
      urbano: number;
      povoado: number;
      rural: number;
    }>();

    filteredBase.forEach((r) => {
      const isSolicitada = (Number(r.digitacao) || 1) >= 2;
      if (!isSolicitada) return;

      const rz = String(r.rz || '01').padStart(2, '0');
      if (!map.has(rz)) {
        map.set(rz, {
          mes: r.Mes,
          ano: r.Ano,
          razao: rz,
          solicitadas: 0,
          realizadas: 0,
          urbano: 0,
          povoado: 0,
          rural: 0,
        });
      }

      const item = map.get(rz)!;
      item.solicitadas += 1;
      if (String(r.foto || '').trim().toUpperCase() === 'OK') {
        item.realizadas += 1;
      }

      const tipo = (r.tipo || '').toUpperCase();
      if (tipo.includes('URB')) item.urbano += 1;
      else if (tipo.includes('POV')) item.povoado += 1;
      else if (tipo.includes('RUR')) item.rural += 1;
      else item.urbano += 1;
    });

    return Array.from(map.values()).map((item) => {
      const nao_realizadas = Math.max(0, item.solicitadas - item.realizadas);
      const indicador = item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0;

      return {
        ...item,
        nao_realizadas,
        indicador,
      };
    }).sort((a, b) => b.indicador - a.indicador);
  }, [filteredBase]);

  // Somatório consolidado do Relatório Geral
  const consolidadoGeral = useMemo(() => {
    let solicitadas = 0;
    let realizadas = 0;
    let nao_realizadas = 0;
    let urbano = 0;
    let povoado = 0;
    let rural = 0;

    reportGeralPorRazao.forEach((row) => {
      solicitadas += row.solicitadas;
      realizadas += row.realizadas;
      nao_realizadas += row.nao_realizadas;
      urbano += row.urbano;
      povoado += row.povoado;
      rural += row.rural;
    });

    const indicador = solicitadas > 0 ? (realizadas / solicitadas) * 100 : 0;
    return { solicitadas, realizadas, nao_realizadas, urbano, povoado, rural, indicador };
  }, [reportGeralPorRazao]);

  // ABA "RELAÇÃO DE DADOS POR MATRÍCULA"
  // Colunas: MES, ANO, RAZAO, MATR, SOLICITADAS, REALIZADAS, NÃO-REALIZADAS, INDICADOR
  const relacaoPorMatricula = useMemo(() => {
    const map = new Map<string, {
      mes: string;
      ano: number;
      razao: string;
      matr: string;
      solicitadas: number;
      realizadas: number;
    }>();

    filteredBase.forEach((r) => {
      const isSolicitada = (Number(r.digitacao) || 1) >= 2;
      if (!isSolicitada) return;

      const matr = String(r.matr || 'SEM_MATR').trim();
      const rz = String(r.rz || '01').padStart(2, '0');
      const key = `${r.Ano}_${r.Mes}_${rz}_${matr}`;

      if (!map.has(key)) {
        map.set(key, {
          mes: r.Mes,
          ano: r.Ano,
          razao: rz,
          matr,
          solicitadas: 0,
          realizadas: 0,
        });
      }

      const item = map.get(key)!;
      item.solicitadas += 1;
      if (String(r.foto || '').trim().toUpperCase() === 'OK') {
        item.realizadas += 1;
      }
    });

    return Array.from(map.values())
      .map((item) => {
        const nao_realizadas = Math.max(0, item.solicitadas - item.realizadas);
        const indicador = item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0;
        return {
          ...item,
          nao_realizadas,
          indicador,
        };
      })
      .sort((a, b) => b.solicitadas - a.solicitadas);
  }, [filteredBase]);

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!filtroAno || !filtroMes) {
      setError('Ano e Mês são filtros obrigatórios para gerar o relatório.');
      return;
    }
    setError(null);
    setPageGeral(1);
    setPageMatr(1);
    setHasGenerated(true);

    // Calcular alerta de leituristas com evidência inferior ao esperado (< 100% ou nao_realizadas > 0)
    // Agrupados por matrícula e pré-ordenados CRESCENTE pelo INDICADOR
    const ulDeNum = filtroUlDe ? Number(filtroUlDe) : 0;
    const ulParaNum = filtroUlPara ? Number(filtroUlPara) : 99999999;
    const mapAlert = new Map<string, {
      mes: string;
      ano: number;
      razao: string;
      matr: string;
      solicitadas: number;
      realizadas: number;
    }>();

    records.forEach((r) => {
      if (String(r.Ano) !== filtroAno) return;
      if (String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return;

      const rzUl = Number(r.rz_ul_lv) || 0;
      if (rzUl < ulDeNum || rzUl > ulParaNum) return;

      const isSolicitada = (Number(r.digitacao) || 1) >= 2;
      if (!isSolicitada) return;

      const matr = String(r.matr || 'SEM_MATR').trim();
      const rz = String(r.rz || '01').padStart(2, '0');
      const key = `${r.Ano}_${r.Mes}_${rz}_${matr}`;

      if (!mapAlert.has(key)) {
        mapAlert.set(key, {
          mes: r.Mes,
          ano: r.Ano,
          razao: rz,
          matr,
          solicitadas: 0,
          realizadas: 0,
        });
      }

      const item = mapAlert.get(key)!;
      item.solicitadas += 1;
      if (String(r.foto || '').trim().toUpperCase() === 'OK') {
        item.realizadas += 1;
      }
    });

    const lowEvidenceAlert = Array.from(mapAlert.values())
      .map((item) => {
        const nao_realizadas = Math.max(0, item.solicitadas - item.realizadas);
        const indicador = item.solicitadas > 0 ? (item.realizadas / item.solicitadas) * 100 : 0;
        return {
          ...item,
          nao_realizadas,
          indicador,
        };
      })
      .filter((item) => item.nao_realizadas > 0 || item.indicador < 100)
      .sort((a, b) => a.indicador - b.indicador); // CRESCENTE pelo INDICADOR

    if (lowEvidenceAlert.length > 0) {
      setAlertCollaborators(lowEvidenceAlert);
      setShowAlertModal(true);
    }
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroMes('');
    setFiltroMatr('');
    setFiltroUlDe('');
    setFiltroUlPara('');
    setHasGenerated(false);
    setError(null);
    setPageGeral(1);
    setPageMatr(1);
  };

  // Paginação
  const paginatedReportGeral = useMemo(() => {
    const start = (pageGeral - 1) * PAGE_SIZE;
    return reportGeralPorRazao.slice(start, start + PAGE_SIZE);
  }, [reportGeralPorRazao, pageGeral]);

  const totalPagesGeral = Math.ceil(reportGeralPorRazao.length / PAGE_SIZE) || 1;

  const paginatedReportMatr = useMemo(() => {
    const start = (pageMatr - 1) * PAGE_SIZE;
    return relacaoPorMatricula.slice(start, start + PAGE_SIZE);
  }, [relacaoPorMatricula, pageMatr]);

  const totalPagesMatr = Math.ceil(relacaoPorMatricula.length / PAGE_SIZE) || 1;

  // GRÁFICO ANALÍTICO: "Relação de Evidencias apresentadas e não apresentadas"
  const chartDataAnalitico = useMemo(() => {
    const map = new Map<string, {
      name: string;
      razao: string;
      realizadas: number;
      nao_realizadas: number;
      matrRealizadasMap: Map<string, number>;
      matrNaoRealizadasMap: Map<string, number>;
    }>();

    filteredBase.forEach((r) => {
      const isSolicitada = (Number(r.digitacao) || 1) >= 2;
      if (!isSolicitada) return;

      const rz = String(r.rz || '01').padStart(2, '0');
      const matr = String(r.matr || 'SEM_MATR').trim();
      const isOk = String(r.foto || '').trim().toUpperCase() === 'OK';

      if (!map.has(rz)) {
        map.set(rz, {
          name: `Razão ${rz}`,
          razao: rz,
          realizadas: 0,
          nao_realizadas: 0,
          matrRealizadasMap: new Map(),
          matrNaoRealizadasMap: new Map(),
        });
      }

      const item = map.get(rz)!;
      if (isOk) {
        item.realizadas += 1;
        item.matrRealizadasMap.set(matr, (item.matrRealizadasMap.get(matr) || 0) + 1);
      } else {
        item.nao_realizadas += 1;
        item.matrNaoRealizadasMap.set(matr, (item.matrNaoRealizadasMap.get(matr) || 0) + 1);
      }
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        matrRealizadasList: Array.from(entry.matrRealizadasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        matrNaoRealizadasList: Array.from(entry.matrNaoRealizadasMap.entries())
          .map(([matr, qtd]) => ({ matr, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
      }))
      .sort((a, b) => (b.realizadas + b.nao_realizadas) - (a.realizadas + a.nao_realizadas))
      .slice(0, 15);
  }, [filteredBase]);

  // Resumo Textual
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = filtroAno ? `Ano: ${filtroAno}` : 'Ano: Não Selecionado';
    const mesTxt = filtroMes ? `Mês: ${filtroMes}` : 'Mês: Não Selecionado';
    const matrTxt = filtroMatr ? `Matrícula: ${filtroMatr}` : 'Matrícula: Todas';
    const rangeUl = `Range UL: ${filtroUlDe || '0'} até ${filtroUlPara || '99999999'}`;
    return `Parâmetros Ativos: ${anoTxt} | ${mesTxt} | ${matrTxt} | ${rangeUl} • Total de Razões: ${reportGeralPorRazao.length}`;
  }, [filtroAno, filtroMes, filtroMatr, filtroUlDe, filtroUlPara, reportGeralPorRazao]);

  // Exportar Alerta para PDF
  const exportAlertToPDF = () => {
    if (alertCollaborators.length === 0) return;
    exportPdfReport({
      title: 'Alerta: Evidências Inferiores ao Esperado',
      subtitle: `Ano: ${filtroAno} | Mês: ${filtroMes}`,
      filters: `Total de Colaboradores em Alerta: ${alertCollaborators.length}`,
      filename: `SAL_Alerta_Evidencias_${filtroMes}_${filtroAno}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'CUIDADO: estes leituristas estão apresentando quantidade de evidência inferior ao esperado.',
          headers: ['MES', 'ANO', 'RAZAO', 'MATR', 'SOLICITADAS', 'REALIZADAS', 'NÃO-REALIZADAS', 'INDICADOR'],
          data: alertCollaborators.map((r) => [
            r.mes,
            r.ano,
            r.razao,
            r.matr,
            r.solicitadas,
            r.realizadas,
            r.nao_realizadas,
            `${r.indicador.toFixed(2).replace('.', ',')}%`,
          ]),
        },
      ],
    });
  };

  // Exportar Excel
  const exportToExcel = () => {
    if (reportGeralPorRazao.length === 0 && relacaoPorMatricula.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['Sistema de Análise de Leitura'],
      ['Relatório: Controle de Evidência'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtro: Ano ${filtroAno} - Mês ${filtroMes} ${filtroMatr ? `(Matrícula ${filtroMatr})` : ''}`],
      [],
    ];

    // Sheet 1: Relatório Geral
    const headersGeral = [
      'MES', 'ANO', 'RAZAO', 'SOLICITADAS', 'REALIZADAS', 'NÃO-REALIZADAS', 'URBANO', 'POVOADO', 'RURAL', 'INDICADOR (%)'
    ];
    const dataRowsGeral = reportGeralPorRazao.map((r) => [
      r.mes, r.ano, r.razao, r.solicitadas, r.realizadas, r.nao_realizadas,
      r.urbano, r.povoado, r.rural, `${r.indicador.toFixed(2)}%`
    ]);
    const wsGeral = XLSX.utils.aoa_to_sheet([...titleRows, headersGeral, ...dataRowsGeral]);

    // Sheet 2: Relação de dados por matrícula
    const headersMatr = ['MES', 'ANO', 'RAZAO', 'MATR', 'SOLICITADAS', 'REALIZADAS', 'NÃO-REALIZADAS', 'INDICADOR'];
    const dataRowsMatr = relacaoPorMatricula.map((r) => [
      r.mes, r.ano, r.razao, r.matr, r.solicitadas, r.realizadas, r.nao_realizadas, `${r.indicador.toFixed(2)}%`
    ]);
    const wsMatr = XLSX.utils.aoa_to_sheet([...titleRows, headersMatr, ...dataRowsMatr]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGeral, 'Relatorio_Geral');
    XLSX.utils.book_append_sheet(wb, wsMatr, 'Dados_por_Matricula');
    XLSX.writeFile(wb, `SAL_Controle_Evidencias_${filtroMes}_${filtroAno}_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF
  const exportToPDF = () => {
    if (reportGeralPorRazao.length === 0 && relacaoPorMatricula.length === 0) return;

    exportPdfReport({
      title: 'Controle de Evidência de Leitura',
      subtitle: `Ano: ${filtroAno} | Mês: ${filtroMes} ${filtroMatr ? `| Matrícula: ${filtroMatr}` : ''}`,
      filters: resumoFiltrosTexto,
      filename: `SAL_Controle_Evidencias_${filtroMes}_${filtroAno}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'Relatório Geral (Consolidado por Razão)',
          headers: ['MES', 'ANO', 'RAZAO', 'SOLIC.', 'REALIZ.', 'N-REALIZ.', 'URB.', 'POV.', 'RUR.', 'INDICADOR'],
          data: reportGeralPorRazao.map((r) => [
            r.mes, r.ano, r.razao, r.solicitadas, r.realizadas, r.nao_realizadas,
            r.urbano, r.povoado, r.rural, `${r.indicador.toFixed(2)}%`
          ]),
        },
        {
          title: 'Relação de Dados por Matrícula',
          headers: ['MES', 'ANO', 'RAZAO', 'MATR', 'SOLICITADAS', 'REALIZADAS', 'NÃO-REALIZADAS', 'INDICADOR'],
          data: relacaoPorMatricula.slice(0, 150).map((r) => [
            r.mes, r.ano, r.razao, r.matr, r.solicitadas, r.realizadas, r.nao_realizadas, `${r.indicador.toFixed(2)}%`
          ]),
        },
      ],
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* POP-UP DE ALERTA: EVIDÊNCIA INFERIOR AO ESPERADO - CENTRALIZADO NO TOPO */}
      {showAlertModal && (
        <div className="fixed inset-0 z-[160] flex items-start justify-center p-4 pt-6 sm:pt-10 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#111827] border-2 border-amber-500 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto sm:my-0">
            <div className="p-4 sm:p-5 bg-amber-950/80 border-b border-amber-800 flex items-center justify-between text-amber-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  CUIDADO: estes leituristas estão apresentando quantidade de evidência inferior ao esperado.
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAlertToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/30 text-amber-200 border border-amber-500/40 hover:bg-amber-600/50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Tabela de leituristas com evidências pendentes/não-realizadas, pré-ordenada de forma crescente pelo indicador:
              </p>

              <div className="border border-amber-900/40 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-[#0b0f19] text-slate-400 font-semibold border-b border-amber-900/40 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">MES</th>
                      <th className="py-2.5 px-3">ANO</th>
                      <th className="py-2.5 px-3">RAZAO</th>
                      <th className="py-2.5 px-3">MATR</th>
                      <th className="py-2.5 px-3 text-right">SOLICITADAS</th>
                      <th className="py-2.5 px-3 text-right">REALIZADAS</th>
                      <th className="py-2.5 px-3 text-right">NÃO-REALIZADAS</th>
                      <th className="py-2.5 px-3 text-right">INDICADOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {alertCollaborators.map((c, i) => (
                      <tr key={i} className="hover:bg-amber-950/30">
                        <td className="py-2 px-3 text-slate-300 font-sans">{c.mes}</td>
                        <td className="py-2 px-3 text-slate-400">{c.ano}</td>
                        <td className="py-2 px-3 text-white font-bold">{c.razao}</td>
                        <td className="py-2 px-3 text-cyan-300 font-bold">{c.matr}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{c.solicitadas}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">{c.realizadas}</td>
                        <td className="py-2 px-3 text-right text-red-400 font-bold">{c.nao_realizadas}</td>
                        <td className="py-2 px-3 text-right font-black text-amber-400">
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
                onClick={() => setShowAlertModal(false)}
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
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              3.2. Controle de Evidência
            </h1>
            <p className="text-xs text-slate-400">
              Acompanhamento de registro fotográfico por leiturista e conferência de evidências
            </p>
          </div>
        </div>
      </div>

      {/* FILTROS OBRIGATÓRIOS */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
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

          {/* Resumo Textual */}
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
          {/* CARDS SUPERIORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SOLICITADAS</span>
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-cyan-400">
                  <Target className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono tabular-nums">
                {totaisGerais.solicitadas.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Fotos requeridas</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">REALIZADAS</span>
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono tabular-nums">
                {totaisGerais.realizadas.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Fotos OK</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">NÃO-REALIZADAS</span>
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-red-400 font-mono tabular-nums">
                {totaisGerais.nao_realizadas.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Pendentes de foto</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">INDICADOR</span>
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-amber-400 font-mono tabular-nums">
                {totaisGerais.indicador.toFixed(2).replace('.', ',')}%
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Percentual</p>
            </div>
          </div>

          {/* 2º GRÁFICO ANALÍTICO: "Relação de Evidencias apresentadas e não apresentadas" */}
          {/* Sem texto descritivo longo acima; tooltips separados para Foto OK e Foto N-OK */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl print:hidden">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Relação de Evidencias apresentadas e não apresentadas
              </h3>
            </div>

            <div className="h-[460px] w-full">
              {chartDataAnalitico.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataAnalitico} margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                    <XAxis
                      dataKey="name"
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: '600' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const showRealizadas = hoveredBarType === 'realizadas' || (!hoveredBarType && payload[0].dataKey === 'realizadas');
                          const isReal = showRealizadas;
                          const matrs = isReal ? data.matrRealizadasList : data.matrNaoRealizadasList;
                          const titleLabel = isReal ? 'Foto OK' : 'Foto N-OK';
                          const titleColor = isReal ? 'text-emerald-400' : 'text-red-400';
                          const totalVal = isReal ? data.realizadas : data.nao_realizadas;

                          return (
                            <div className="bg-[#0b0f19] border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[240px] max-w-[300px]">
                              <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
                                <span className="font-bold text-white font-sans">{data.name}</span>
                                <span className={`font-bold font-mono ${titleColor}`}>
                                  {titleLabel}: {totalVal}
                                </span>
                              </div>

                              <div className="overflow-x-auto max-h-40 custom-scrollbar border border-slate-800 rounded-lg">
                                <table className="w-full text-left text-[11px] border-collapse font-mono">
                                  <thead className="bg-[#111827] text-slate-400 uppercase font-semibold border-b border-slate-800">
                                    <tr>
                                      <th className="py-1 px-2.5">Matr</th>
                                      <th className="py-1 px-2.5 text-right">Quantidade</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    {matrs && matrs.length > 0 ? (
                                      matrs.map((m: { matr: string; qtd: number }, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-800/30">
                                          <td className="py-1 px-2.5 text-slate-200 font-bold">{m.matr}</td>
                                          <td className={`py-1 px-2.5 text-right font-bold ${titleColor}`}>{m.qtd}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={2} className="py-2 text-center text-slate-500 font-sans italic">
                                          Nenhum registro.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: '10px' }}
                    />
                    <Bar
                      dataKey="realizadas"
                      name="Foto OK"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                      onMouseEnter={() => setHoveredBarType('realizadas')}
                      onMouseLeave={() => setHoveredBarType(null)}
                    />
                    <Bar
                      dataKey="nao_realizadas"
                      name="Foto N-OK"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                      onMouseEnter={() => setHoveredBarType('nao_realizadas')}
                      onMouseLeave={() => setHoveredBarType(null)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Sem dados para os filtros selecionados.
                </div>
              )}
            </div>
          </div>

          {/* TABELAS: RELATÓRIO GERAL E RELAÇÃO DE DADOS POR MATRÍCULA */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              {/* Abas */}
              <div className="flex items-center gap-2 bg-[#080c14] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('geral')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'geral' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Relatório Geral ({reportGeralPorRazao.length} razões)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matricula')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'matricula' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Relação de dados por matrícula ({relacaoPorMatricula.length})
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

            {/* ABA 1: RELATÓRIO GERAL */}
            {activeTab === 'geral' && (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">RAZÃO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">SOLICITADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">REALIZADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">NÃO-REALIZADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">URBANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">POVOADO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">RURAL</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">INDICADOR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                      {paginatedReportGeral.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-300 font-sans font-medium">{row.mes}</td>
                          <td className="py-2.5 px-3.5 text-slate-400">{row.ano}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{row.razao}</td>
                          <td className="py-2.5 px-3.5 text-right text-cyan-400 font-bold">{row.solicitadas}</td>
                          <td className="py-2.5 px-3.5 text-right text-emerald-400 font-bold">{row.realizadas}</td>
                          <td className="py-2.5 px-3.5 text-right text-red-400 font-bold">{row.nao_realizadas}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.urbano}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.povoado}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.rural}</td>
                          <td className="py-2.5 px-3.5 text-right font-black text-amber-400">
                            {row.indicador.toFixed(2).replace('.', ',')}%
                          </td>
                        </tr>
                      ))}

                      {/* LINHA DE SOMATÓRIO CONSOLIDADO ABAIXO */}
                      {reportGeralPorRazao.length > 0 && (
                        <tr className="bg-[#080d1a] border-t-2 border-blue-500/40 font-bold text-white">
                          <td colSpan={3} className="py-3 px-3.5 uppercase tracking-wider font-sans font-black text-cyan-400">
                            TOTAL CONSOLIDADO:
                          </td>
                          <td className="py-3 px-3.5 text-right text-cyan-300 font-black">
                            {consolidadoGeral.solicitadas.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right text-emerald-400 font-black">
                            {consolidadoGeral.realizadas.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right text-red-400 font-black">
                            {consolidadoGeral.nao_realizadas.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right text-slate-300">
                            {consolidadoGeral.urbano.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right text-slate-300">
                            {consolidadoGeral.povoado.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right text-slate-300">
                            {consolidadoGeral.rural.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3.5 text-right font-black text-amber-400">
                            {consolidadoGeral.indicador.toFixed(2).replace('.', ',')}%
                          </td>
                        </tr>
                      )}

                      {paginatedReportGeral.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro encontrado para os parâmetros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pageGeral}</strong> de <strong className="text-white">{totalPagesGeral}</strong> (Total: {reportGeralPorRazao.length} razões)
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

            {/* ABA 2: RELAÇÃO DE DADOS POR MATRÍCULA */}
            {/* Colunas: MES, ANO, RAZAO, MATR, SOLICITADAS, REALIZADAS, NÃO-REALIZADAS, INDICADOR */}
            {activeTab === 'matricula' && (
              <>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">RAZAO</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">MATR</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">SOLICITADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">REALIZADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">NÃO-REALIZADAS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap text-right">INDICADOR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                      {paginatedReportMatr.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-200 font-sans font-medium">{row.mes}</td>
                          <td className="py-2.5 px-3.5 text-slate-400">{row.ano}</td>
                          <td className="py-2.5 px-3.5 text-white font-bold">{row.razao}</td>
                          <td className="py-2.5 px-3.5 text-cyan-400 font-bold">{row.matr}</td>
                          <td className="py-2.5 px-3.5 text-right text-slate-300">{row.solicitadas}</td>
                          <td className="py-2.5 px-3.5 text-right text-emerald-400 font-bold">{row.realizadas}</td>
                          <td className="py-2.5 px-3.5 text-right text-red-400 font-bold">{row.nao_realizadas}</td>
                          <td className={`py-2.5 px-3.5 text-right font-black ${
                            row.indicador < 100 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {row.indicador.toFixed(2).replace('.', ',')}%
                          </td>
                        </tr>
                      ))}
                      {paginatedReportMatr.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                            Nenhum registro encontrado para os parâmetros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação da aba Matrícula */}
                <div className="p-4 bg-[#0b0f19] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
                  <span>
                    Página <strong className="text-white">{pageMatr}</strong> de <strong className="text-white">{totalPagesMatr}</strong> (Total: {relacaoPorMatricula.length} matrículas)
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleEvidencias;
