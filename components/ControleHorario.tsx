import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Clock, PlayCircle, RotateCcw, FileSpreadsheet, FileText,
  Users, Activity, CheckCircle, Timer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportPdfReport } from '../utils/pdfExport';

interface HorarioResumo {
  matr: string;
  data: string;
  razao: string;
  horaInicial: string;
  horaFinal: string;
  tempoServico: string;
  tempoMinutos: number;
  totalLeituras: number;
  tempoLh: string; // Apenas o valor numérico
  tempoLm: string; // Média de tempo em minutos para execução de cada leitura
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToHours(min: number): string {
  if (min <= 0) return '00h 00m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

// Extrai dia, mês e ano de strings em formato ISO (YYYY-MM-DD), BR (DD/MM/YYYY), timestamps e datas seriais
export function parseDateParts(str: string): { day: number; month: number; year: number } | null {
  if (!str) return null;
  const clean = str.trim().split(/[T ]/)[0];
  
  // 1. ISO: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }
  
  // 2. BR: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const brMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (brMatch) {
    return {
      day: parseInt(brMatch[1], 10),
      month: parseInt(brMatch[2], 10),
      year: parseInt(brMatch[3], 10),
    };
  }

  // 3. Short BR: DD/MM/YY
  const brShortMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (brShortMatch) {
    const yr = parseInt(brShortMatch[3], 10);
    return {
      day: parseInt(brShortMatch[1], 10),
      month: parseInt(brShortMatch[2], 10),
      year: yr < 70 ? 2000 + yr : 1900 + yr,
    };
  }

  // 4. Excel Serial Number (e.g. 45312)
  const num = Number(clean);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const dt = new Date(Math.round((num - 25569) * 86400 * 1000));
    return {
      day: dt.getUTCDate(),
      month: dt.getUTCMonth() + 1,
      year: dt.getUTCFullYear(),
    };
  }

  // 5. JavaScript Date parsing fallback
  const dt = new Date(str.trim());
  if (!isNaN(dt.getTime())) {
    return {
      day: dt.getDate(),
      month: dt.getMonth() + 1,
      year: dt.getFullYear(),
    };
  }
  return null;
}

// Compara datas de maneira robusta independente da formatação de origem
export function matchDate(recordDate: string, filterDate: string): boolean {
  if (!filterDate) return true;
  if (!recordDate) return false;

  const fParts = parseDateParts(filterDate);
  const rParts = parseDateParts(recordDate);

  if (fParts && rParts) {
    return (
      fParts.day === rParts.day &&
      fParts.month === rParts.month &&
      fParts.year === rParts.year
    );
  }

  return recordDate.trim().includes(filterDate.trim());
}

export const ControleHorario: React.FC = () => {
  const { records, opcoesAnos, opcoesMeses, opcoesMatriculas } = useData();

  const [filtroAno, setFiltroAno] = useState<string>('');
  const [filtroMes, setFiltroMes] = useState<string>('');
  const [filtroData, setFiltroData] = useState<string>('');
  const [filtroMatr, setFiltroMatr] = useState<string>('');

  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  const handleGerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasGenerated(true);
  };

  const handleNovaPesquisa = () => {
    setFiltroAno('');
    setFiltroMes('');
    setFiltroData('');
    setFiltroMatr('');
    setHasGenerated(false);
  };

  // Group readings by DATA, MATR and RAZÃO
  const relatorioHorarios = useMemo((): HorarioResumo[] => {
    if (!hasGenerated) return [];

    const map = new Map<string, {
      matr: string;
      data: string;
      razao: string;
      times: number[];
      timeStrings: string[];
      count: number;
    }>();

    records.forEach((r) => {
      if (filtroAno && String(r.Ano) !== filtroAno) return;
      if (filtroMes && String(r.Mes).trim().toUpperCase() !== filtroMes.trim().toUpperCase()) return;
      if (filtroData && !matchDate(String(r.data_original || ''), filtroData)) return;
      if (filtroMatr && String(r.matr).trim() !== filtroMatr.trim()) return;

      const matr = String(r.matr || 'SEM_MATR').trim();
      const data = String(r.data_original || 'SEM_DATA').trim();
      const razao = String(r.rz || '01').padStart(2, '0');
      const hora = String(r.hora_original || '').trim();

      const key = `${data}_${matr}_${razao}`;
      if (!map.has(key)) {
        map.set(key, { matr, data, razao, times: [], timeStrings: [], count: 0 });
      }

      const item = map.get(key)!;
      item.count += 1;
      if (hora) {
        item.times.push(timeToMinutes(hora));
        item.timeStrings.push(hora);
      }
    });

    const result: HorarioResumo[] = [];

    map.forEach((item) => {
      if (item.times.length === 0) {
        result.push({
          matr: item.matr,
          data: item.data,
          razao: item.razao,
          horaInicial: '—',
          horaFinal: '—',
          tempoServico: '—',
          tempoMinutos: 0,
          totalLeituras: item.count,
          tempoLh: '0.0',
          tempoLm: '0.00',
        });
        return;
      }

      const minTime = Math.min(...item.times);
      const maxTime = Math.max(...item.times);
      const diffMinutes = Math.max(0, maxTime - minTime);

      const minIdx = item.times.indexOf(minTime);
      const maxIdx = item.times.indexOf(maxTime);

      const horaInicial = item.timeStrings[minIdx] || '—';
      const horaFinal = item.timeStrings[maxIdx] || '—';
      const tempoServico = formatMinutesToHours(diffMinutes);

      const hours = diffMinutes / 60;
      // TEMPO (L/H): apenas o valor numérico
      const tempoLh = hours > 0.05 ? (item.count / hours).toFixed(1) : String(item.count);

      // TEMPO (L/M): Média de tempo em minutos para execução de cada leitura
      const tempoLm = item.count > 0 && diffMinutes > 0
        ? (diffMinutes / item.count).toFixed(2)
        : '0.00';

      result.push({
        matr: item.matr,
        data: item.data,
        razao: item.razao,
        horaInicial,
        horaFinal,
        tempoServico,
        tempoMinutos: diffMinutes,
        totalLeituras: item.count,
        tempoLh,
        tempoLm,
      });
    });

    // Ordenar por data decrescente e matrícula
    return result.sort((a, b) => b.data.localeCompare(a.data) || a.matr.localeCompare(b.matr));
  }, [records, hasGenerated, filtroAno, filtroMes, filtroData, filtroMatr]);

  // Totais Consolidados para os Cards do Topo
  const totaisConsolidados = useMemo(() => {
    const totalLeituras = relatorioHorarios.reduce((acc, curr) => acc + curr.totalLeituras, 0);
    const totalMinutos = relatorioHorarios.reduce((acc, curr) => acc + curr.tempoMinutos, 0);
    const totalHoras = totalMinutos / 60;

    const tempoLhGlobal = totalHoras > 0.05 ? (totalLeituras / totalHoras).toFixed(1) : '0.0';
    const tempoLmGlobal = totalLeituras > 0 && totalMinutos > 0 ? (totalMinutos / totalLeituras).toFixed(2) : '0.00';

    return {
      totalJornadas: relatorioHorarios.length,
      totalLeituras,
      tempoServicoGeral: formatMinutesToHours(totalMinutos),
      tempoLhGlobal,
      tempoLmGlobal,
    };
  }, [relatorioHorarios]);

  // Resumo Textual
  const resumoFiltrosTexto = useMemo(() => {
    const anoTxt = filtroAno ? `Ano: ${filtroAno}` : 'Ano: Todos';
    const mesTxt = filtroMes ? `Mês: ${filtroMes}` : 'Mês: Todos';
    const dataTxt = filtroData ? `Data: ${filtroData}` : 'Data: Todas';
    const matrTxt = filtroMatr ? `Matrícula: ${filtroMatr}` : 'Matrícula: Todas';
    return `Parâmetros: ${anoTxt} | ${mesTxt} | ${dataTxt} | ${matrTxt} • Total consolidado: ${relatorioHorarios.length} jornadas`;
  }, [filtroAno, filtroMes, filtroData, filtroMatr, relatorioHorarios]);

  // Exportar Excel com cabeçalho institucional
  const exportToExcel = () => {
    if (relatorioHorarios.length === 0) return;
    const now = new Date();
    const dataHoraStr = now.toLocaleString('pt-BR');

    const titleRows = [
      ['SAL – Sistema de Análise de Leitura'],
      ['Relatório: 4.1. Controle de Horário'],
      [`Data e Hora do Relatório: ${dataHoraStr}`],
      [`Filtros: ${resumoFiltrosTexto}`],
      [],
    ];

    const headers = [
      'DATA', 'MATRÍCULA', 'RAZÃO', 'HORA INICIAL', 'HORA FINAL', 'TEMPO DE SERVIÇO', 'TOTAL LEITURAS', 'TEMPO (L/H)', 'TEMPO (L/M)'
    ];

    const dataRows = relatorioHorarios.map((r) => [
      r.data,
      r.matr,
      r.razao,
      r.horaInicial,
      r.horaFinal,
      r.tempoServico,
      r.totalLeituras,
      r.tempoLh,
      r.tempoLm,
    ]);

    const aoa = [...titleRows, headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Horario');
    XLSX.writeFile(wb, `SAL_Relatorio_Horario_${now.toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF oficial via jsPDF + autoTable
  const exportToPDF = () => {
    if (relatorioHorarios.length === 0) return;
    exportPdfReport({
      title: 'Relatório: 4.1. Controle de Horário',
      subtitle: resumoFiltrosTexto,
      headers: ['DATA', 'MATRÍCULA', 'RAZÃO', 'HORA INICIAL', 'HORA FINAL', 'TEMPO SERVIÇO', 'TOTAL LEITURAS', 'TEMPO (L/H)', 'TEMPO (L/M)'],
      rows: relatorioHorarios.map((r) => [
        r.data,
        r.matr,
        r.razao,
        r.horaInicial,
        r.horaFinal,
        r.tempoServico,
        r.totalLeituras.toLocaleString('pt-BR'),
        r.tempoLh,
        r.tempoLm
      ]),
      filename: `SAL_Relatorio_Horario_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-100 print:p-0 pb-12">
      {/* TÍTULO DO MENU NO TOPO */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-cyan-400 border border-blue-500/30">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              4.1. Controle de Horário
            </h1>
            <p className="text-xs text-slate-400">
              Acompanhamento de início, término, tempo de serviço e produtividade (L/H e L/M) por jornada de campo
            </p>
          </div>
        </div>
      </div>

      {/* ÁREA DE FILTROS */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl print:hidden">
        <form onSubmit={handleGerar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* DATA (Filtragem precisa via parseDateParts) */}
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
          {/* CARDS RESUMO DO PERÍODO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Jornadas Processadas</p>
                <p className="text-xl font-black text-white mt-0.5">{totaisConsolidados.totalJornadas.toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">dias x leituristas</p>
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Leituras</p>
                <p className="text-xl font-black text-cyan-400 mt-0.5">{totaisConsolidados.totalLeituras.toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">medidores registrados</p>
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tempo Total em Campo</p>
                <p className="text-xl font-black text-amber-400 mt-0.5">{totaisConsolidados.tempoServicoGeral}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">horas acumuladas</p>
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Produtividade Média</p>
                <p className="text-xl font-black text-emerald-400 mt-0.5">{totaisConsolidados.tempoLhGlobal} L/H</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{totaisConsolidados.tempoLmGlobal} min por leitura</p>
              </div>
            </div>
          </div>

          {/* TABELA: RELATÓRIO DE HORÁRIO */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1322] print:hidden">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Relatório de Horário ({relatorioHorarios.length} jornadas consolidadas)
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0b0f19] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">DATA</th>
                    <th className="py-3 px-4 whitespace-nowrap">MATRÍCULA</th>
                    <th className="py-3 px-4 whitespace-nowrap">RAZÃO</th>
                    <th className="py-3 px-4 whitespace-nowrap">HORA INICIAL</th>
                    <th className="py-3 px-4 whitespace-nowrap">HORA FINAL</th>
                    <th className="py-3 px-4 whitespace-nowrap">TEMPO DE SERVIÇO</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">TOTAL LEITURAS</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">TEMPO (L/H)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">TEMPO (L/M)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                  {relatorioHorarios.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{row.data}</td>
                      <td className="py-2.5 px-4 font-bold text-white">{row.matr}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-sans">{row.razao}</td>
                      <td className="py-2.5 px-4 text-cyan-400 font-bold">{row.horaInicial}</td>
                      <td className="py-2.5 px-4 text-cyan-400 font-bold">{row.horaFinal}</td>
                      <td className="py-2.5 px-4 text-amber-400 font-bold">{row.tempoServico}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-white">
                        {row.totalLeituras.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                        {row.tempoLh}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-purple-400">
                        {row.tempoLm}
                      </td>
                    </tr>
                  ))}
                  {relatorioHorarios.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum registro de horário encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleHorario;
