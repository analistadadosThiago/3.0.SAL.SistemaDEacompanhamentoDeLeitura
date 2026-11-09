import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Printer, PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Layers, Search, ExternalLink, AlertTriangle, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

const PAGE_SIZE = 20;

export const ControleImpressao: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesRazoes, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroRz, setFiltroRz] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');
  const [filtroMotivo, setFiltroMotivo] = useState<string>('');

  // Busca local acima da tabela de dados selecionados: Instalação, Medidor e Consistência/Motivo
  const [buscaInstalacao, setBuscaInstalacao] = useState<string>('');
  const [buscaMedidor, setBuscaMedidor] = useState<string>('');
  const [buscaConsistencia, setBuscaConsistencia] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Distinct motivos da coluna nosb_impedimento - EXCLUINDO "FATURADA"
  const opcoesMotivos = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const mot = String(r.nosb_impedimento || '').trim();
      if (mot && mot.toUpperCase() !== 'FATURADA') {
        set.add(mot);
      }
    });
    return Array.from(set).sort();
  }, [records]);

  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [alertCollaborators, setAlertCollaborators] = useState<Array<{
    mes: string;
    ano: number;
    razao: string;
    matr: string;
    motivo: string;
    quantidade: number;
  }>>([]);

  const exportAlertToPDF = () => {
    if (alertCollaborators.length === 0) return;
    exportPdfReport({
      title: 'Alerta: N\'OSB Impedimento',
      subtitle: `Ano: ${filtroAno || 'Todos'} | Mês: ${filtroMes || 'Todos'}`,
      filters: `Total de Colaboradores em Alerta: ${alertCollaborators.length}`,
      filename: `SAL_Alerta_NOSB_Impedimento_${new Date().toISOString().slice(0, 10)}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'IMPORTANTE: abaixo as ocorrências apostadas com N´OSB Impedimento. Tratar casos que exijam atenção',
          headers: ['MES', 'ANO', 'RAZAO', 'MATR', "N'OSB IMPEDIMENTO", 'QUANTIDADE'],
          data: alertCollaborators.map((r) => [
            r.mes,
            r.ano,
            r.razao,
            r.matr,
            r.motivo,
            r.quantidade,
          ]),
        },
      ],
    });
  };

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setHasGenerated(true);

    // Agrupamento para o Pop-up de Alerta
    const mapAlert = new Map<string, {
      mes: string;
      ano: number;
      razao: string;
      matr: string;
      motivo: string;
      quantidade: number;
    }>();

    records.forEach((r) => {
      const mot = String(r.nosb_impedimento || '').trim();
      if (!mot || mot.toUpperCase() === 'FATURADA') return;
      if (filtroMotivo && mot.toUpperCase() !== filtroMotivo.trim().toUpperCase()) return;
      if (filtroAno && String(r.Ano) !== filtroAno) return;
      if (filtroMes && String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return;
      if (filtroRz && String(r.rz).padStart(2, '0') !== filtroRz.padStart(2, '0')) return;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return;

      const matr = String(r.matr || 'SEM_MATR').trim();
      const rz = String(r.rz || '01').padStart(2, '0');
      const key = `${r.Ano}_${r.Mes}_${rz}_${matr}_${mot}`;

      if (!mapAlert.has(key)) {
        mapAlert.set(key, {
          mes: r.Mes,
          ano: r.Ano,
          razao: rz,
          matr,
          motivo: mot,
          quantidade: 0,
        });
      }
      mapAlert.get(key)!.quantidade += 1;
    });

    const alertList = Array.from(mapAlert.values()).sort((a, b) => a.quantidade - b.quantidade); // Pré-ordenada CRESCENTE
    if (alertList.length > 0) {
      setAlertCollaborators(alertList);
      setShowAlertModal(true);
    }
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
    setShowAlertModal(false);
    setAlertCollaborators([]);
    setHasGenerated(false);
    setPage(1);
  };

  // Base filtered records - desconsidera "FATURADA"
  const filteredBase = useMemo(() => {
    if (!hasGenerated) return [];

    return records.filter((r) => {
      const mot = String(r.nosb_impedimento || '').trim();

      if (filtroMotivo) {
        if (mot.toUpperCase() !== filtroMotivo.trim().toUpperCase()) {
          return false;
        }
      } else {
        if (!mot || mot.toUpperCase() === 'FATURADA') return false;
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
      const motivo = String(r.nosb_impedimento || 'NÃO ESPECIFICADO').trim();
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

  // TABELA 2 (LOGO ABAIXO): Relação de Dados Selecionados (com busca local)
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
      if (consTerm) {
        const matchNosb = String(r.nosb_impedimento || '').toLowerCase().includes(consTerm);
        const matchCons = String(r.consistencia || '').toLowerCase().includes(consTerm);
        if (!matchNosb && !matchCons) return false;
      }
      return true;
    });
  }, [filteredBase, buscaInstalacao, buscaMedidor, buscaConsistencia]);

  // Paginação: 20 registros por página
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
      ["Relatório: 5.1. N'OSB – Impedimento"],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtros: ${resumoFiltrosTexto}`],
      [],
    ];

    // Sheet 1: Relação Quantitativa
    const quantHeaders = ['RAZÃO', 'NÃO IMPRESSÃO (MOTIVO)', 'QUANTIDADE', 'INDICADOR'];
    const quantData = relacaoQuantitativa.map(q => [q.razao, q.motivo, q.quantidade, q.indicador]);
    const wsQuant = XLSX.utils.aoa_to_sheet([...titleRows, quantHeaders, ...quantData]);

    // Sheet 2: Dados Selecionados (Ordem exata: MES, ANO, RAZÃO, UL, INSTALAÇÃO, MEDIDOR, REG, FOTO, MATR, NL, LEITURA, N'OSB IMPEDIMENTO)
    const selectedHeaders = [
      'MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'FOTO', 'MATR', 'NL', 'LEITURA', "N'OSB IMPEDIMENTO"
    ];
    const selData = dadosSelecionados.map(r => [
      r.Mes, r.Ano, String(r.rz || '').padStart(2, '0'), r.rz_ul_lv, r.instalacao, r.medidor,
      r.reg, r.foto ? 'Sim' : 'Não', r.matr, r.nl, r.l_atual, r.nosb_impedimento
    ]);
    const wsSel = XLSX.utils.aoa_to_sheet([...titleRows, selectedHeaders, ...selData]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsQuant, 'Relacao_Quantitativa');
    XLSX.utils.book_append_sheet(wb, wsSel, 'Dados_Selecionados');
    XLSX.writeFile(wb, `SAL_NOSB_Impedimento_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF oficial via jsPDF + autoTable
  const exportToPDF = () => {
    if (dadosSelecionados.length === 0 && relacaoQuantitativa.length === 0) return;
    exportPdfReport({
      title: "Relatório: 5.1. N'OSB – Impedimento",
      subtitle: resumoFiltrosTexto,
      headers: ['MES', 'ANO', 'RAZÃO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'FOTO', 'MATR', 'NL', 'LEITURA', "N'OSB IMPEDIMENTO"],
      rows: dadosSelecionados.map(r => [
        r.Mes,
        r.Ano,
        String(r.rz || '').padStart(2, '0'),
        r.rz_ul_lv || '',
        r.instalacao,
        r.medidor,
        r.reg || '',
        r.foto ? 'Sim' : 'Não',
        r.matr,
        r.nl,
        r.l_atual,
        r.nosb_impedimento || ''
      ]),
      filename: `SAL_NOSB_Impedimento_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* POP-UP DE ALERTA: EVIDÊNCIA INFERIOR AO ESPERADO (N'OSB IMPEDIMENTO) - CENTRALIZADO NO TOPO */}
      {showAlertModal && (
        <div className="fixed inset-0 z-[160] flex items-start justify-center p-4 pt-6 sm:pt-10 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#111827] border-2 border-amber-500 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto sm:my-0">
            <div className="p-4 sm:p-5 bg-amber-950/80 border-b border-amber-800 flex items-center justify-between text-amber-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  IMPORTANTE: abaixo as ocorrências apostadas com N´OSB Impedimento. Tratar casos que exijam atenção
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
              <p className="text-xs text-slate-300">
                Lista de leituristas com ocorrências registradas em N'OSB Impedimento, pré-ordenada de forma crescente pela quantidade:
              </p>
              <div className="border border-amber-900/40 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-[#0b0f19] text-slate-400 font-semibold border-b border-amber-900/40 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">MES</th>
                      <th className="py-2.5 px-3">ANO</th>
                      <th className="py-2.5 px-3">RAZAO</th>
                      <th className="py-2.5 px-3">MATR</th>
                      <th className="py-2.5 px-3">N'OSB IMPEDIMENTO</th>
                      <th className="py-2.5 px-3 text-right">QUANTIDADE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {alertCollaborators.map((c, i) => (
                      <tr key={i} className="hover:bg-amber-950/30">
                        <td className="py-2 px-3 text-slate-300 font-sans">{c.mes}</td>
                        <td className="py-2 px-3 text-slate-400">{c.ano}</td>
                        <td className="py-2 px-3 text-white font-bold">{c.razao}</td>
                        <td className="py-2 px-3 text-cyan-300 font-bold">{c.matr}</td>
                        <td className="py-2 px-3 text-amber-300">{c.motivo}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold">{c.quantidade}</td>
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
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              5.1. N'OSB – Impedimento
            </h1>
            <p className="text-xs text-slate-400">
              Controle de Não Impressão, de acordo com N'OSB_impedimento
            </p>
          </div>
        </div>
      </div>

      {/* ÁREA DE FILTROS */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl print:hidden">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Selecione Filtros:</span>
        </div>

        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Ano */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ano</label>
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
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mês</label>
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

            {/* Razão */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Razão (rz)</label>
              <select
                value={filtroRz}
                onChange={(e) => setFiltroRz(e.target.value)}
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

            {/* Matrícula */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Matrícula</label>
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

            {/* Motivo de Não Impressão (excluindo Faturada) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Motivo Não Impressão</label>
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
          {/* TABELA 1: Relação Quantitativa por Razão e Motivo */}
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

            <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 whitespace-nowrap">RAZÃO</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">NÃO IMPRESSÃO (MOTIVO)</th>
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

          {/* TABELA 2: Relação de Dados Selecionados (com busca local) */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 bg-[#0d1322] flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Relação de Dados Selecionados</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/50">
                  {dadosSelecionados.length.toLocaleString('pt-BR')} registros
                </span>
              </div>

              {/* Local Search Inputs: Instalação, Medidor e Consistência/Motivo */}
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
                    <option value="">Todos N'OSB Impedimento ({opcoesMotivos.length})</option>
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
                    <th className="py-2.5 px-3 whitespace-nowrap text-amber-400">N'OSB IMPEDIMENTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-300 font-sans">{row.Mes}</td>
                      <td className="py-2 px-3 text-slate-400">{row.Ano}</td>
                      <td className="py-2 px-3 text-white font-bold">{String(row.rz || '').padStart(2, '0')}</td>
                      <td className="py-2 px-3 text-slate-300">{row.rz_ul_lv}</td>
                      <td className="py-2 px-3 text-cyan-400 font-bold font-mono">{row.instalacao || '—'}</td>
                      <td className="py-2 px-3 text-slate-300">{row.medidor}</td>
                      <td className="py-2 px-3 text-slate-400">{row.reg}</td>
                      <td className="py-2 px-3 text-center text-slate-300 text-[11px] truncate max-w-[120px]">
                        {row.foto || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{row.matr}</td>
                      <td className="py-2 px-3 text-red-400 font-bold">{row.nl}</td>
                      <td className="py-2 px-3 text-right text-slate-200">{row.l_atual}</td>
                      <td className="py-2 px-3 font-sans font-medium text-amber-300">
                        {row.nosb_impedimento || '—'}
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

export default ControleImpressao;
