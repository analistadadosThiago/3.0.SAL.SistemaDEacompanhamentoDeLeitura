import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  ShieldCheck, PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Layers, Search, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

const PAGE_SIZE = 20;

export const ControleConsistencia: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesRazoes, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroRz, setFiltroRz] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');
  const [filtroMotivo, setFiltroMotivo] = useState<string>('');

  // Busca local acima da tabela de dados selecionados: Instalação, Medidor e Consistência
  const [buscaInstalacao, setBuscaInstalacao] = useState<string>('');
  const [buscaMedidor, setBuscaMedidor] = useState<string>('');
  const [buscaConsistencia, setBuscaConsistencia] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Distinct motivos da coluna consistencia - EXCLUINDO "FATURADA"
  const opcoesMotivos = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const mot = String(r.consistencia || '').trim();
      if (mot && mot.toUpperCase() !== 'FATURADA') {
        set.add(mot);
      }
    });
    return Array.from(set).sort();
  }, [records]);

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setHasGenerated(true);
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroMes('');
    setFiltroRz('');
    setFiltroMatr('');
    setFiltroMotivo('');
    setBuscaInstalacao('');
    setBuscaMedidor('');
    setBuscaConsistencia('');
    setHasGenerated(false);
    setPage(1);
  };

  // Base filtered records - desconsidera "FATURADA"
  const filteredBase = useMemo(() => {
    if (!hasGenerated) return [];

    return records.filter((r) => {
      const cons = String(r.consistencia || '').trim();

      if (filtroMotivo) {
        if (cons.toUpperCase() !== filtroMotivo.trim().toUpperCase()) {
          return false;
        }
      } else {
        // Registros com inconsistência preenchida diferente de "FATURADA"
        if (!cons || cons.toUpperCase() === 'FATURADA') return false;
      }

      if (filtroAno && String(r.Ano) !== filtroAno) return false;
      if (filtroMes && String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return false;
      if (filtroRz && String(r.rz).padStart(2, '0') !== filtroRz.padStart(2, '0')) return false;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return false;

      return true;
    });
  }, [records, hasGenerated, filtroAno, filtroMes, filtroRz, filtroMatr, filtroMotivo]);

  // TABELA 1 (NO TOPO): Relação Quantitativa por Razão e Motivo
  const relacaoQuantitativa = useMemo(() => {
    const map = new Map<string, { razao: string; motivo: string; quantidade: number }>();

    filteredBase.forEach((r) => {
      const rz = String(r.rz || '01').padStart(2, '0');
      const motivo = String(r.consistencia || 'NÃO ESPECIFICADO').trim();
      const key = `${rz}_${motivo}`;

      if (!map.has(key)) {
        map.set(key, { razao: rz, motivo, quantidade: 0 });
      }
      map.get(key)!.quantidade += 1;
    });

    const total = filteredBase.length;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        indicador: total > 0 ? ((item.quantidade / total) * 100).toFixed(2).replace('.', ',') + '%' : '0,00%',
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredBase]);

  // TABELA 2 (LOGO ABAIXO): Relação de Dados Selecionados (com busca local por INSTALAÇÃO, MEDIDOR e CONSISTENCIA)
  const dadosSelecionados = useMemo(() => {
    const instTerm = buscaInstalacao.trim().toLowerCase();
    const instDigits = instTerm.replace(/\D/g, '');
    const medTerm = buscaMedidor.trim().toLowerCase();
    const consTerm = buscaConsistencia.trim().toLowerCase();

    return filteredBase.filter((r) => {
      if (instTerm) {
        const rInst = String(r.instalacao || '').toLowerCase();
        const rDigits = rInst.replace(/\D/g, '');
        const matchRaw = rInst.includes(instTerm);
        const matchDigits = instDigits.length >= 2 && rDigits.includes(instDigits);
        if (!matchRaw && !matchDigits) return false;
      }
      if (medTerm && !String(r.medidor || '').toLowerCase().includes(medTerm)) return false;
      if (consTerm && !String(r.consistencia || '').toLowerCase().includes(consTerm)) return false;
      return true;
    });
  }, [filteredBase, buscaInstalacao, buscaMedidor, buscaConsistencia]);

  // Paginação da tabela de dados selecionados: 20 registros
  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return dadosSelecionados.slice(start, start + PAGE_SIZE);
  }, [dadosSelecionados, page]);

  const totalPages = Math.ceil(dadosSelecionados.length / PAGE_SIZE) || 1;

  // Resumo Textual
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = filtroAno ? `Ano: ${filtroAno}` : 'Ano: Todos';
    const mesTxt = filtroMes ? `Mês: ${filtroMes}` : 'Mês: Todos';
    const rzTxt = filtroRz ? `Razão: ${filtroRz}` : 'Razão: Todas';
    const matrTxt = filtroMatr ? `Matrícula: ${filtroMatr}` : 'Matrícula: Todas';
    const motTxt = filtroMotivo ? `Motivo: ${filtroMotivo}` : 'Motivo: Todos (exceto Faturada)';
    return `Parâmetros: ${anoTxt} | ${mesTxt} | ${rzTxt} | ${matrTxt} | ${motTxt} • Total de registros: ${dadosSelecionados.length}`;
  }, [filtroAno, filtroMes, filtroRz, filtroMatr, filtroMotivo, dadosSelecionados]);

  // Exportar Excel
  const exportToExcel = () => {
    if (dadosSelecionados.length === 0 && relacaoQuantitativa.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['SAL – Sistema de Análise de Leitura'],
      ['Relatório: 3.3. Controle de Consistência'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtros: ${resumoFiltrosTexto}`],
      [],
    ];

    // Sheet 1: Relação Quantitativa
    const quantHeaders = ['RAZÃO', 'MOTIVO DA CONSISTENCIA', 'QUANTIDADE', 'INDICADOR'];
    const quantRows = relacaoQuantitativa.map((q) => [q.razao, q.motivo, q.quantidade, q.indicador]);
    const wsQuant = XLSX.utils.aoa_to_sheet([...titleRows, quantHeaders, ...quantRows]);

    // Sheet 2: Dados Selecionados (Ordem exata: MES, ANO, RAZÃO, UL, INSTALAÇÃO, MEDIDOR, REG, FOTO, MATR, NL, LEITURA, CONSISTENCIA)
    const dataHeaders = [
      'MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 
      'REG', 'FOTO', 'MATR', 'NL', 'LEITURA', 'CONSISTENCIA'
    ];
    const dataRows = dadosSelecionados.map((d) => [
      d.Mes, d.Ano, String(d.rz || '').padStart(2, '0'), d.rz_ul_lv, d.instalacao, d.medidor,
      d.reg, d.foto ? 'Sim' : 'Não', d.matr, d.nl, d.l_atual, d.consistencia
    ]);
    const wsData = XLSX.utils.aoa_to_sheet([...titleRows, dataHeaders, ...dataRows]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsQuant, 'Quantitativo');
    XLSX.utils.book_append_sheet(wb, wsData, 'Dados Selecionados');

    XLSX.writeFile(wb, `SAL_Controle_Consistencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF
  const exportToPDF = () => {
    if (dadosSelecionados.length === 0 && relacaoQuantitativa.length === 0) return;
    exportPdfReport({
      title: 'Relatório: 3.3. Controle de Consistência',
      subtitle: resumoFiltrosTexto,
      headers: ['MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'FOTO', 'MATR', 'NL', 'LEITURA', 'CONSISTÊNCIA'],
      rows: dadosSelecionados.map((d) => [
        d.Mes || '',
        d.Ano || '',
        String(d.rz || '').padStart(2, '0'),
        d.rz_ul_lv || '',
        d.instalacao || '',
        d.medidor || '',
        d.reg || '',
        d.foto ? 'Sim' : 'Não',
        d.matr || '',
        d.nl || '',
        d.l_atual || '',
        d.consistencia || ''
      ]),
      filename: `SAL_Controle_Consistencia_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Título do menu no topo */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              3.3. Controle de Consistência
            </h1>
            <p className="text-xs text-slate-400">
              Análise e monitoramento das inconsistências operacionais em campo (motivos desconsiderando Faturada)
            </p>
          </div>
        </div>
      </div>

      {/* Caixa de Filtros */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Selecione Filtros:</span>
        </div>

        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* ANO */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Ano
              </label>
              <select
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos os Anos</option>
                {opcoesAnos.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            {/* MÊS */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Mês
              </label>
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

            {/* RAZÃO */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Razão (rz)
              </label>
              <select
                value={filtroRz}
                onChange={(e) => setFiltroRz(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todas as Razões</option>
                {opcoesRazoes.map((rz) => (
                  <option key={rz} value={rz}>
                    RZ {rz}
                  </option>
                ))}
              </select>
            </div>

            {/* MATRÍCULA */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Matrícula
              </label>
              <select
                value={filtroMatr}
                onChange={(e) => setFiltroMatr(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todas as Matrículas</option>
                {opcoesMatriculas.map((matr) => (
                  <option key={matr} value={matr}>
                    {matr}
                  </option>
                ))}
              </select>
            </div>

            {/* MOTIVO DE CONSISTÊNCIA */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Motivo de Consistência
              </label>
              <select
                value={filtroMotivo}
                onChange={(e) => setFiltroMotivo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos os Motivos (sem Faturada)</option>
                {opcoesMotivos.map((mot) => (
                  <option key={mot} value={mot}>
                    {mot}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
          {/* TABELA 1 (NO TOPO): Relação Quantitativa por Razão e Motivo */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0d1322] print:hidden">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Relação Quantitativa por Razão e Motivo ({relacaoQuantitativa.length} grupos consolidados)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 whitespace-nowrap">RAZÃO</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">MOTIVO DA CONSISTENCIA</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">QUANTIDADE</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">INDICADOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {relacaoQuantitativa.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 text-white font-bold">{item.razao}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-200">{item.motivo}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-cyan-400">
                        {item.quantidade.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                        {item.indicador}
                      </td>
                    </tr>
                  ))}
                  {relacaoQuantitativa.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 font-sans">
                        Sem dados quantitativos para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA 2 (LOGO ABAIXO): Relação de Dados Selecionados (com busca local) */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 bg-[#0d1322] flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Relação de Dados Selecionados</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/50">
                  {dadosSelecionados.length.toLocaleString('pt-BR')} registros
                </span>
              </div>

              {/* Local Search Inputs: Instalação, Medidor e Consistência */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrar Instalação..."
                    value={buscaInstalacao}
                    onChange={(e) => {
                      setBuscaInstalacao(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
                  />
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrar Medidor..."
                    value={buscaMedidor}
                    onChange={(e) => {
                      setBuscaMedidor(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
                  />
                </div>
                <div className="relative">
                  <select
                    value={buscaConsistencia}
                    onChange={(e) => {
                      setBuscaConsistencia(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 bg-[#0b0f19] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="">Todas as Consistências ({opcoesMotivos.length})</option>
                    {opcoesMotivos.map((mot) => (
                      <option key={mot} value={mot}>
                        {mot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">MES</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ANO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">RAZÃO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">UL</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">INSTALAÇÃO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">MEDIDOR</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">REG</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-center">FOTO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">MATR</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">NL</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">LEITURA</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-amber-400">CONSISTENCIA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-300 font-sans">{row.Mes}</td>
                      <td className="py-2 px-3 text-slate-400">{row.Ano}</td>
                      <td className="py-2 px-3 text-white font-bold">{String(row.rz || '').padStart(2, '0')}</td>
                      <td className="py-2 px-3 text-slate-300">{row.rz_ul_lv}</td>
                      <td className="py-2 px-3 text-cyan-400 font-bold">{row.instalacao || '—'}</td>
                      <td className="py-2 px-3 text-slate-300">{row.medidor}</td>
                      <td className="py-2 px-3 text-slate-400">{row.reg}</td>
                      <td className="py-2 px-3 text-center text-slate-300 text-[11px] truncate max-w-[120px]">
                        {row.foto || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{row.matr}</td>
                      <td className="py-2 px-3 text-red-400 font-bold">{row.nl}</td>
                      <td className="py-2 px-3 text-right text-slate-200">{row.l_atual}</td>
                      <td className="py-2 px-3 font-sans font-medium text-amber-300">
                        {row.consistencia || '—'}
                      </td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum registro encontrado para os parâmetros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação de 20 registros */}
            {dadosSelecionados.length > PAGE_SIZE && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-[#0d1322] print:hidden">
                <div>
                  Página <span className="font-bold text-white">{page}</span> de{' '}
                  <span className="font-bold text-white">{totalPages}</span>
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

export default ControleConsistencia;
