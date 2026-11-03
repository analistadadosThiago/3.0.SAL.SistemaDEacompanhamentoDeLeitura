import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  GitCommit, PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Search, Compass, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';
import { parseDateParts, matchDate } from './ControleHorario';

const PAGE_SIZE = 25;

function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':').map(n => parseInt(n, 10) || 0);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

export const SequenciaLeitura: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroData, setFiltroData] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');
  const [filtroUlDe, setFiltroUlDe] = useState<string>('');
  const [filtroUlPara, setFiltroUlPara] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Busca local por instalação ou medidor
  const [buscaLocal, setBuscaLocal] = useState<string>('');

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setHasGenerated(true);
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroMes('');
    setFiltroData('');
    setFiltroMatr('');
    setFiltroUlDe('');
    setFiltroUlPara('');
    setBuscaLocal('');
    setHasGenerated(false);
    setPage(1);
  };

  // Dataset ordenado de forma CRESCENTE (do menor para o maior) por Data e Horário
  const sequenciaData = useMemo(() => {
    if (!hasGenerated) return [];

    const ulDeNum = filtroUlDe ? Number(filtroUlDe) : 0;
    const ulParaNum = filtroUlPara ? Number(filtroUlPara) : 99999999;

    const filtered = records.filter((r) => {
      if (filtroAno && String(r.Ano) !== filtroAno) return false;
      if (filtroMes && String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return false;
      if (filtroData && !matchDate(String(r.data_original || ''), filtroData)) return false;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return false;

      const rzUl = Number(r.rz_ul_lv) || 0;
      if (rzUl < ulDeNum || rzUl > ulParaNum) return false;

      return true;
    });

    // Ordenação estritamente CRESCENTE (do menor para o maior por Data e por Horário)
    return filtered.sort((a, b) => {
      // 1. Comparar Data
      const pA = parseDateParts(String(a.data_original || ''));
      const pB = parseDateParts(String(b.data_original || ''));
      if (pA && pB) {
        if (pA.year !== pB.year) return pA.year - pB.year;
        if (pA.month !== pB.month) return pA.month - pB.month;
        if (pA.day !== pB.day) return pA.day - pB.day;
      } else {
        const cmp = String(a.data_original || '').localeCompare(String(b.data_original || ''));
        if (cmp !== 0) return cmp;
      }

      // 2. Comparar Horário de forma crescente
      const tA = parseTimeToSeconds(a.hora_original);
      const tB = parseTimeToSeconds(b.hora_original);
      return tA - tB;
    });
  }, [records, hasGenerated, filtroAno, filtroMes, filtroData, filtroMatr, filtroUlDe, filtroUlPara]);

  // Busca local: localiza o índice exato do registro pesquisado na sequência ordenada
  const targetIndex = useMemo(() => {
    const term = buscaLocal.trim().toLowerCase();
    if (!term || sequenciaData.length === 0) return -1;
    const termDigits = term.replace(/\D/g, '');
    const termAlpha = term.replace(/[^a-z0-9]/g, '');

    return sequenciaData.findIndex((r) => {
      const inst = String(r.instalacao || '').toLowerCase();
      const instDigits = inst.replace(/\D/g, '');
      const instAlpha = inst.replace(/[^a-z0-9]/g, '');
      const med = String(r.medidor || '').toLowerCase();

      const matchInstExact = inst === term || (termDigits !== '' && instDigits === termDigits);
      const matchInstSub = inst.includes(term);
      const matchInstDigits = termDigits.length >= 2 && instDigits.includes(termDigits);
      const matchInstAlpha = termAlpha.length >= 2 && instAlpha.includes(termAlpha);
      const matchMed = med.includes(term);

      return matchInstExact || matchInstSub || matchInstDigits || matchInstAlpha || matchMed;
    });
  }, [sequenciaData, buscaLocal]);

  // Ao pesquisar instalação ou medidor, vai direto para a página correspondente na tabela completa
  useEffect(() => {
    if (targetIndex !== -1) {
      const targetPage = Math.floor(targetIndex / PAGE_SIZE) + 1;
      setPage(targetPage);
    }
  }, [targetIndex]);

  // Paginação: 25 registros por página
  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sequenciaData.slice(start, start + PAGE_SIZE);
  }, [sequenciaData, page]);

  const totalPages = Math.ceil(sequenciaData.length / PAGE_SIZE) || 1;

  // Resumo Textual
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = filtroAno ? `Ano: ${filtroAno}` : 'Ano: Todos';
    const mesTxt = filtroMes ? `Mês: ${filtroMes}` : 'Mês: Todos';
    const dataTxt = filtroData ? `Data: ${filtroData}` : 'Data: Todas';
    const matrTxt = filtroMatr ? `Matrícula: ${filtroMatr}` : 'Matrícula: Todas';
    const rangeUl = `Range UL: ${filtroUlDe || '0'} até ${filtroUlPara || '99999999'}`;
    return `Parâmetros: ${anoTxt} | ${mesTxt} | ${dataTxt} | ${matrTxt} | ${rangeUl} • Total em sequência: ${sequenciaData.length} registros`;
  }, [filtroAno, filtroMes, filtroData, filtroMatr, filtroUlDe, filtroUlPara, sequenciaData]);

  // Exportar Excel
  const exportToExcel = () => {
    if (sequenciaData.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['SAL – Sistema de Análise de Leitura'],
      ['Relatório: 4.2. Sequência de Leitura'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtros: ${resumoFiltrosTexto}`],
      [],
    ];

    const headers = [
      'MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REGISTRO', 'LEITURA', 'MATR', 'HORA', 'DATA'
    ];

    const dataRows = sequenciaData.map((r) => [
      r.Mes,
      r.Ano,
      r.rz,
      r.rz_ul_lv,
      r.instalacao,
      r.medidor,
      r.reg,
      r.l_atual,
      r.matr,
      r.hora_original,
      r.data_original
    ]);

    const aoa = [...titleRows, headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sequencia_Leitura');
    XLSX.writeFile(wb, `SAL_Sequencia_Leitura_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF oficial via jsPDF + autoTable
  const exportToPDF = () => {
    if (sequenciaData.length === 0) return;
    exportPdfReport({
      title: 'Relatório: 4.2. Sequência de Leitura',
      subtitle: resumoFiltrosTexto,
      headers: ['MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'LEITURA', 'MATR', 'HORA', 'DATA'],
      rows: sequenciaData.map((r) => [
        r.Mes,
        r.Ano,
        r.rz,
        r.rz_ul_lv || '',
        r.instalacao,
        r.medidor,
        r.reg || '',
        r.l_atual,
        r.matr,
        r.hora_original,
        r.data_original
      ]),
      filename: `SAL_Sequencia_Leitura_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* TÍTULO DO MENU NO TOPO */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <GitCommit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              4.2. Sequência de Leitura
            </h1>
            <p className="text-xs text-slate-400">
              Relatório de Sequenciamento de Leitura realizada em campo em ordem cronológica crescente
            </p>
          </div>
        </div>
      </div>

      {/* ÁREA DE FILTROS COM DATA ESPECÍFICA */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl print:hidden">
        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* Ano */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Ano</label>
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

            {/* Mês */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Mês</label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
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

            {/* DATA (Dia específico com filtragem exata) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Data</label>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Matrícula */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Matrícula</label>
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
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">UL DE</label>
              <input
                type="text"
                placeholder="0"
                value={filtroUlDe}
                onChange={(e) => setFiltroUlDe(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* UL PARA */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">UL PARA</label>
              <input
                type="text"
                placeholder="99999999"
                value={filtroUlPara}
                onChange={(e) => setFiltroUlPara(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

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
        <div className="space-y-6 animate-fade-in">
          {/* BUSCA NA SEQUÊNCIA (Sem cards de prévia; vai direto para a tabela completa com destaque em verde) */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Compass className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Auditoria de Sequência de Rota
                  </h3>
                  <p className="text-xs text-slate-400">
                    Digite a instalação ou medidor para localizar diretamente na tabela com destaque da rota e seus vizinhos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-96">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Instalação ou Medidor..."
                    value={buscaLocal}
                    onChange={(e) => setBuscaLocal(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {buscaLocal && (
                    <button
                      type="button"
                      onClick={() => setBuscaLocal('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {targetIndex !== -1 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold font-mono shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Pos #{targetIndex + 1}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TABELA: SEQUÊNCIA DE LEITURA (ORDEM CRESCENTE POR DATA E HORÁRIO) */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-blue-400" />
                Sequência de Leitura ({sequenciaData.length} registros em ordem cronológica crescente)
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

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5 whitespace-nowrap">ORDEM</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">RAZÃO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">UL</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">INSTALAÇÃO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">MEDIDOR</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">REGISTRO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-right">LEITURA</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">MATR</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">HORA</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">DATA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                  {paginatedData.map((row, idx) => {
                    const globalIdx = (page - 1) * PAGE_SIZE + idx;
                    const isTargetAlvo = targetIndex !== -1 && globalIdx === targetIndex;
                    const isNeighbor = targetIndex !== -1 && Math.abs(globalIdx - targetIndex) === 1;

                    let rowStyle = 'hover:bg-slate-800/40 text-slate-300 transition-colors';
                    if (isTargetAlvo) {
                      rowStyle = 'bg-emerald-950/80 border-l-4 border-l-emerald-400 text-white font-bold ring-2 ring-emerald-500/40 shadow-lg';
                    } else if (isNeighbor) {
                      rowStyle = 'bg-emerald-950/30 border-l-2 border-l-emerald-600/60 text-slate-200 transition-colors';
                    }

                    return (
                      <tr key={globalIdx} className={rowStyle}>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] whitespace-nowrap">
                          {isTargetAlvo ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500 text-black font-black uppercase text-[10px] tracking-wide">
                              ★ ALVO #{globalIdx + 1}
                            </span>
                          ) : isNeighbor ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 font-bold text-[10px]">
                              {globalIdx < targetIndex ? 'Vizinho -1' : 'Vizinho +1'} (#{globalIdx + 1})
                            </span>
                          ) : (
                            <span className="text-slate-500">#{globalIdx + 1}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-slate-200">{row.Mes}</td>
                        <td className="py-2.5 px-3.5 text-slate-300">{row.Ano}</td>
                        <td className="py-2.5 px-3.5 font-bold text-white">{String(row.rz).padStart(2, '0')}</td>
                        <td className="py-2.5 px-3.5 text-blue-400 font-bold">{row.rz_ul_lv}</td>
                        {/* Instalação em seu formato original, com pontos e traços rigorosamente mantidos */}
                        <td className="py-2.5 px-3.5 font-bold text-cyan-300">{row.instalacao || '—'}</td>
                        <td className="py-2.5 px-3.5 text-slate-200">{row.medidor}</td>
                        <td className="py-2.5 px-3.5 text-slate-400">{row.reg}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-400">
                          {Number(row.l_atual).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-300">{row.matr}</td>
                        {/* HORA e DATA no formato original da base de dados */}
                        <td className="py-2.5 px-3.5 text-amber-300 font-bold">
                          {row.hora_original || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-300 font-sans">
                          {row.data_original || '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {sequenciaData.length > PAGE_SIZE && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-[#0d1322] print:hidden">
                <div>
                  Página <span className="font-bold text-white">{page}</span> de{' '}
                  <span className="font-bold text-white">{totalPages}</span> ({sequenciaData.length} registros no total)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SequenciaLeitura;
