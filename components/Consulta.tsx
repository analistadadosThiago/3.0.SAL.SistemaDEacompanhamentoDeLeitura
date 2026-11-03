import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { FieldRecord, MONTH_ORDER } from '../types';
import { 
  Search, RotateCcw, FileSpreadsheet, FileText, 
  BarChart2, TrendingUp, AlertCircle, Database, Hash
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

export function formatInstalacao(val: string | number | undefined | null): string {
  if (!val) return '';
  // Strictly preserve the exact raw value from the database with all dots and dashes intact
  return String(val).trim();
}

export const Consulta: React.FC = () => {
  const { records } = useData();

  const [instalacao, setInstalacao] = useState('');
  const [medidor, setMedidor] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<FieldRecord[]>([]);

  // Aceita exatamente o formato presente na base (números, pontos, traços)
  const handleInstalacaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInstalacao(val);
    if (val) setMedidor('');
  };

  const handleMedidorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMedidor(val);
    if (val) setInstalacao('');
  };

  const handlePesquisar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const instClean = instalacao.trim().toLowerCase();
    const instDigits = instClean.replace(/\D/g, '');
    const medClean = medidor.trim().toLowerCase();

    if (!instClean && !medClean) return;

    const matched = records.filter((r) => {
      if (instClean) {
        const rInst = String(r.instalacao || '').trim().toLowerCase();
        const rDigits = rInst.replace(/\D/g, '');

        // 1. Correspondência exata da string ou dos dígitos
        const matchExact = rInst === instClean || (instDigits !== '' && rDigits === instDigits);
        // 2. Substring direta no valor cadastrado
        const matchSubstring = rInst.includes(instClean);
        // 3. Substring pelos dígitos se houver pelo menos 2 dígitos
        const matchDigits = instDigits.length >= 2 && rDigits.includes(instDigits);
        // 4. Substring ignorando caracteres especiais (pontos, traços, barras)
        const rAlphaNum = rInst.replace(/[^a-z0-9]/g, '');
        const instAlphaNum = instClean.replace(/[^a-z0-9]/g, '');
        const matchAlphaNum = instAlphaNum.length >= 2 && rAlphaNum.includes(instAlphaNum);

        if (matchExact || matchSubstring || matchDigits || matchAlphaNum) {
          return true;
        }
      }
      if (medClean) {
        const rMed = String(r.medidor || '').toLowerCase().trim();
        if (rMed.includes(medClean)) return true;
      }
      return false;
    });

    // Ordenar por Mês (ordem cronológica de calendário: Janeiro, Fevereiro...) e Ano crescente
    matched.sort((a, b) => {
      const anoA = Number(a.Ano) || 0;
      const anoB = Number(b.Ano) || 0;
      if (anoA !== anoB) return anoA - anoB;

      const mesOrderA = MONTH_ORDER[String(a.Mes || '').toUpperCase()] || 99;
      const mesOrderB = MONTH_ORDER[String(b.Mes || '').toUpperCase()] || 99;
      return mesOrderA - mesOrderB;
    });

    setSearchResults(matched);
    setHasSearched(true);
  };

  // Botão "Fazer nova pesquisa": limpa o campo de busca e a tela atual
  const handleNovaPesquisa = () => {
    setInstalacao('');
    setMedidor('');
    setHasSearched(false);
    setSearchResults([]);
  };

  // Histórico de COD: Código e Ocorrência
  const resumoCod = useMemo(() => {
    const counts: Record<string, number> = {};
    searchResults.forEach((r) => {
      const cod = String(r.nl || '0').trim();
      counts[cod] = (counts[cod] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([codigo, ocorrencia]) => ({ codigo, ocorrencia }))
      .sort((a, b) => b.ocorrencia - a.ocorrencia);
  }, [searchResults]);

  // Progressão de consumo em formato de dados e gráfico
  const consumoProgression = useMemo(() => {
    return searchResults.map((r) => ({
      periodo: `${r.Mes.slice(0, 3)}/${String(r.Ano).slice(-2)}`,
      periodoCompleto: `${r.Mes}/${r.Ano}`,
      leitura: Number(r.l_atual) || 0,
      consumo: Number(r.consumo) || 0,
      nl: r.nl || '0',
      impedimento: r.nosb_impedimento || (String(r.nl) === '0' ? 'LEITURA REGULAR' : 'IMPEDIMENTO'),
    }));
  }, [searchResults]);

  // Exportar Excel
  const exportToExcel = () => {
    if (searchResults.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['Sistema de Análise de Leitura'],
      ['Relatório: Consulta de Instalação e Medidor'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtro Pesquisado: ${instalacao ? `Instalação ${instalacao}` : `Medidor ${medidor}`}`],
      [],
    ];

    const headers = [
      'MES', 'ANO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'MATR',
      'NL', 'LEITURA', 'CONSUMO', 'DIG', 'FOTO', 'NOSB.IMP', 'NOSB.SIM'
    ];

    const dataRows = searchResults.map((r) => [
      r.Mes,
      r.Ano,
      r.rz_ul_lv,
      formatInstalacao(r.instalacao),
      r.medidor,
      r.reg,
      r.matr,
      r.nl,
      r.l_atual,
      r.consumo,
      r.digitacao,
      r.foto,
      r.nosb_impedimento,
      r.nosb_simulacao
    ]);

    const aoa = [...titleRows, headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta');
    XLSX.writeFile(wb, `SAL_Consulta_${(instalacao || medidor).replace(/[.\-]/g, '_')}_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF via jsPDF & autoTable
  const exportToPDF = () => {
    if (searchResults.length === 0) return;

    exportPdfReport({
      title: 'Consulta Técnica de Instalação e Medidor',
      subtitle: `Registro Selecionado: ${instalacao ? `Instalação ${instalacao}` : `Medidor ${medidor}`}`,
      filters: `Total de registros cronológicos encontrados: ${searchResults.length}`,
      filename: `SAL_Consulta_${(instalacao || medidor).replace(/[.\-]/g, '_')}`,
      orientation: 'landscape',
      tables: [
        {
          title: 'Histórico Completo de Medições e Ocorrências',
          headers: [
            'MES', 'ANO', 'UL', 'INSTALAÇÃO', 'MEDIDOR', 'REG', 'MATR',
            'NL', 'LEITURA', 'CONSUMO', 'DIG', 'FOTO', 'NOSB.IMP', 'NOSB.SIM'
          ],
          data: searchResults.map((r) => [
            r.Mes,
            r.Ano,
            r.rz_ul_lv,
            formatInstalacao(r.instalacao),
            r.medidor,
            r.reg,
            r.matr,
            r.nl,
            r.l_atual,
            r.consumo,
            r.digitacao,
            r.foto,
            r.nosb_impedimento || '—',
            r.nosb_simulacao || '—',
          ]),
        },
        {
          title: 'Resumo Histórico de COD (Códigos de Não-Leitura)',
          headers: ['CÓDIGO (NL)', 'TOTAL DE OCORRÊNCIAS'],
          data: resumoCod.map(c => [c.codigo, c.ocorrencia]),
        },
      ],
    });
  };

  const nowPrintStr = new Date().toLocaleString('pt-BR');

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* CABEÇALHO PARA IMPRESSÃO (PDF) COM NOME DO SISTEMA E DATA/HORA */}
      <div className="hidden print:block mb-4 pb-2 border-b border-slate-300 text-slate-900">
        <h1 className="text-xl font-bold uppercase tracking-tight">Sistema de Análise de Leitura</h1>
        <p className="text-xs text-slate-600">
          Relatório de Consulta de Instalação / Medidor • Emitido em: <strong>{nowPrintStr}</strong>
        </p>
      </div>

      {/* TÍTULO DO MENU NO TOPO */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              2. Consulta de instalação/medidor
            </h1>
            <p className="text-xs text-slate-400">
              Histórico de leitura/Codificação
            </p>
          </div>
        </div>
      </div>

      {/* ÁREA DE FILTROS E PESQUISA */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl print:hidden">
        <form onSubmit={handlePesquisar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Campo Instalação: aceita exatamente o formato presente na base */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Instalação
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 994.108.018-03 ou 99410801803"
                value={instalacao}
                onChange={handleInstalacaoChange}
                className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
              {instalacao && (
                <button
                  type="button"
                  onClick={() => setInstalacao('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">Busca ampla por qualquer caractere ou formato</p>
          </div>

          {/* Campo Medidor */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Por Medidor
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 14238712"
                value={medidor}
                onChange={handleMedidorChange}
                className="w-full px-4 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
              {medidor && (
                <button
                  type="button"
                  onClick={() => setMedidor('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">Identificação alfanumérica do medidor</p>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNovaPesquisa}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              title="Limpar campos e tela"
            >
              <RotateCcw className="w-4 h-4" />
              Nova Pesquisa
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Pesquisar
            </button>
          </div>
        </form>
      </div>

      {/* RESULTADOS DA CONSULTA */}
      {hasSearched && searchResults.length > 0 && (
        <div className="space-y-8 animate-fade-in">
          {/* TABELA PRINCIPAL */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Histórico Técnico ({searchResults.length} leituras encontradas)
                </span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                  {instalacao ? `Instalação: ${formatInstalacao(instalacao)}` : `Medidor: ${medidor}`}
                </span>
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
                    <th className="py-3 px-3.5 whitespace-nowrap">MES</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">ANO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">UL</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">INSTALAÇÃO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">MEDIDOR</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">REG</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">MATR</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-center">NL</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-right">LEITURA</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-right">CONSUMO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-center">DIG</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-center">FOTO</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">NOSB.IMP</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">NOSB.SIM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                  {searchResults.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3.5 font-bold text-white font-sans">{row.Mes}</td>
                      <td className="py-2.5 px-3.5 text-slate-300">{row.Ano}</td>
                      <td className="py-2.5 px-3.5 text-blue-400 font-bold">{row.rz_ul_lv}</td>
                      <td className="py-2.5 px-3.5 text-cyan-300 font-black">{formatInstalacao(row.instalacao)}</td>
                      <td className="py-2.5 px-3.5 text-slate-200">{row.medidor}</td>
                      <td className="py-2.5 px-3.5 text-slate-400">{row.reg}</td>
                      <td className="py-2.5 px-3.5 text-slate-300">{row.matr}</td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          String(row.nl) === '0'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          {row.nl}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-white">
                        {Number(row.l_atual).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-blue-400">
                        {Number(row.consumo).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-slate-300">{row.digitacao}</td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          String(row.foto).toUpperCase() === 'OK'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {row.foto || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-400 text-[11px]">
                        {row.nosb_impedimento || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-400 text-[11px]">
                        {row.nosb_simulacao || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* HISTÓRICO DE COD & GRÁFICO DE PROGRESSÃO DE CONSUMO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Histórico quantitativo de COD */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                Histórico de COD
              </h3>
              <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">CÓDIGO (NL)</th>
                      <th className="py-2 px-3 text-right">OCORRÊNCIA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {resumoCod.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              item.codigo === '0'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {item.codigo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-white font-bold">
                          {item.ocorrencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GRÁFICO E PROGRESSÃO DE CONSUMO */}
            <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Progressão de Consumo (Gráfico & Tabela)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Consumo Histórico em kWh
                </span>
              </div>

              {/* GRÁFICO VERTICAL DE CONSUMO */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumoProgression} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis 
                      dataKey="periodo" 
                      stroke="#6b7280" 
                      tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: '600' }}
                      dy={5}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#0b0f19] border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                              <div className="font-bold text-white">{data.periodoCompleto}</div>
                              <div className="text-cyan-400 font-bold font-mono">
                                Consumo: {data.consumo.toLocaleString('pt-BR')} kWh
                              </div>
                              <div className="text-slate-300 font-mono text-[11px]">
                                Leitura Medida: {data.leitura.toLocaleString('pt-BR')}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                Código NL: {data.nl} ({data.impedimento})
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="consumo" fill="#0284c7" radius={[6, 6, 0, 0]} barSize={28}>
                      {consumoProgression.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.nl !== '0' ? '#ef4444' : '#0284c7'} 
                        />
                      ))}
                      <LabelList 
                        dataKey="consumo" 
                        position="top" 
                        style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 'bold' }} 
                        offset={5}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela de Detalhes da Progressão */}
              <div className="overflow-y-auto max-h-[160px] custom-scrollbar border-t border-slate-800 pt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3 whitespace-nowrap">PERÍODO</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">LEITURA (MEDIDA)</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">CONSUMO (kWh)</th>
                      <th className="py-2 px-3 text-center whitespace-nowrap">NL</th>
                      <th className="py-2 px-3 whitespace-nowrap">SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                    {consumoProgression.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 text-slate-200 font-sans font-medium">{item.periodoCompleto}</td>
                        <td className="py-1.5 px-3 text-right text-slate-300">
                          {item.leitura.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-cyan-400">
                          {item.consumo.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.nl === '0' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {item.nl}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-sans text-slate-400 text-[11px] truncate max-w-[180px]">
                          {item.impedimento}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasSearched && searchResults.length === 0 && (
        <div className="bg-[#111827] border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
          <h4 className="text-sm font-bold text-white">Nenhum Registro Encontrado</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não foram encontrados registros correspondentes à instalação "{instalacao}" ou medidor "{medidor}".
          </p>
        </div>
      )}
    </div>
  );
};

export default Consulta;