import { FieldRecord, EXACT_IMPEDIMENTO_CODES } from '../types';

/**
 * Extracts spreadsheet ID and optional GID from Google Sheets URL
 */
export function parseGoogleSheetUrl(inputUrl: string): { sheetId: string; gid?: string } | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  // Pattern: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={GID}
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    const sheetId = match[1];
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    return { sheetId, gid: gidMatch ? gidMatch[1] : undefined };
  }

  // Direct ID check
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return { sheetId: trimmed };
  }

  return null;
}

/**
 * Normalizes header string to match the 22 required column keys
 */
function normalizeColumnName(rawHeader: string): string {
  const clean = rawHeader
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9_]/g, "_");

  if (clean.includes("mes") || clean === "m") return "Mes";
  if (clean.includes("ano") || clean === "a") return "Ano";
  if (clean.includes("instalac") || clean === "inst") return "instalacao";
  if (clean.includes("medid") || clean === "med") return "medidor";
  if (clean === "reg" || clean.includes("registro")) return "reg";
  if (clean === "rz" || clean === "razao") return "rz";
  if (clean.includes("rz_ul") || clean.includes("rzullv") || clean === "ui") return "rz_ul_lv";
  if (clean === "ul" || clean.includes("unidade_leitura")) return "ul";
  if (clean.includes("foto") || clean.includes("evidenc")) return "foto";
  if (clean.includes("tipo") || clean.includes("tipolog")) return "tipo";
  if (clean.includes("matr") || clean.includes("leiturista")) return "matr";
  if (clean === "nl" || clean.includes("nao_leitura") || clean === "cod") return "nl";
  if (clean.includes("data")) return "data_original";
  if (clean.includes("hora")) return "hora_original";
  if (clean.includes("end") || clean.includes("lograd")) return "endereco";
  if (clean.includes("l_atual") || clean.includes("leitura")) return "l_atual";
  if (clean.includes("consumo") || clean === "kwh") return "consumo";
  if (clean.includes("nosb_imp") || clean.includes("impedimento") || clean.includes("motivo")) return "nosb_impedimento";
  if (clean.includes("nosb_sim") || clean.includes("simulac")) return "nosb_simulacao";
  if (clean.includes("dig") || clean.includes("digitacao")) return "digitacao";
  if (clean.includes("cna") || clean.includes("classe")) return "cna";
  if (clean.includes("consist")) return "consistencia";

  return rawHeader.trim();
}

/**
 * Connects to Google Sheets via GViz Visualization API
 */
export async function fetchGoogleSheetsGViz(sheetUrlOrId: string): Promise<FieldRecord[]> {
  const parsed = parseGoogleSheetUrl(sheetUrlOrId);
  if (!parsed) {
    throw new Error("Link da planilha inválido. Cole a URL pública completa do Google Sheets (ex: https://docs.google.com/spreadsheets/d/.../edit).");
  }

  const { sheetId, gid } = parsed;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json${gid ? `&gid=${gid}` : ''}`;

  let response: Response;
  try {
    response = await fetch(gvizUrl);
  } catch (err: any) {
    throw new Error(`Falha de conexão com a planilha: ${err.message}. Certifique-se de que a planilha está pública ("Qualquer pessoa com o link pode ler").`);
  }

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao consultar a API GViz do Google Sheets. Verifique o compartilhamento da planilha.`);
  }

  const text = await response.text();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Formato de resposta GViz não reconhecido. Verifique se o documento é uma planilha válida e pública.");
  }

  const jsonStr = text.substring(jsonStart, jsonEnd + 1);
  const data = JSON.parse(jsonStr);

  if (data.status === 'error') {
    const errorMsg = data.errors?.[0]?.message || 'Erro desconhecido na consulta GViz.';
    throw new Error(`Google Sheets GViz erro: ${errorMsg}`);
  }

  const table = data.table;
  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new Error("Estrutura de dados não encontrada na planilha.");
  }

  // Extract column mapping
  let colNames: string[] = table.cols.map((col: any) => normalizeColumnName(col.label || col.id || ''));

  // If column labels in cols are empty, check if first row contains headers
  let startRowIndex = 0;
  const isColsEmpty = colNames.every(name => !name || name.startsWith('col_') || name.length <= 2);
  if (isColsEmpty && table.rows.length > 0) {
    const firstRowValues = table.rows[0].c.map((cell: any) => cell?.v ? String(cell.v) : '');
    colNames = firstRowValues.map(normalizeColumnName);
    startRowIndex = 1;
  }

  const records: FieldRecord[] = [];

  for (let i = startRowIndex; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row || !Array.isArray(row.c)) continue;

    const rowObj: any = {};
    colNames.forEach((colName, cIdx) => {
      const cell = row.c[cIdx];
      // In Google Sheets GViz, cell.f contains the user-facing formatted text (with dots, dashes, dates)
      const formattedVal = cell?.f !== undefined && cell?.f !== null ? String(cell.f).trim() : '';
      const rawVal = cell?.v !== undefined && cell?.v !== null ? cell.v : '';
      
      // For string columns like instalacao, data, hora, use formattedVal if present
      if (formattedVal !== '') {
        rowObj[colName] = formattedVal;
      } else {
        rowObj[colName] = rawVal;
      }
    });

    // Skip empty lines
    if (!rowObj.instalacao && !rowObj.medidor && !rowObj.matr) continue;

    // Helper to parse GViz Date(...) format if present
    const parseGvizDateOrStr = (val: any): { date: string; time: string } => {
      const str = String(val || '').trim();
      if (str.startsWith('Date(')) {
        const nums = str.replace(/[Date()]/g, '').split(',').map(s => parseInt(s.trim(), 10));
        const y = nums[0];
        const m = (nums[1] || 0) + 1;
        const d = nums[2] || 1;
        const h = nums[3] || 0;
        const min = nums[4] || 0;
        const s = nums[5] || 0;
        return {
          date: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
          time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        };
      }
      return { date: str, time: str };
    };

    const parsedDate = parseGvizDateOrStr(rowObj.data_original);
    const parsedHora = parseGvizDateOrStr(rowObj.hora_original);

    // Normalize types
    const rz_val = rowObj.rz ? String(rowObj.rz).padStart(2, '0') : '01';
    const ul_val = rowObj.ul ? String(rowObj.ul) : '1001';
    const rz_ul_numeric = Number(String(rowObj.rz_ul_lv || `${rz_val}${ul_val}`).replace(/\D/g, '')) || Number(`${rz_val}${ul_val}`);

    const record: FieldRecord = {
      Mes: String(rowObj.Mes || 'Janeiro').trim(),
      Ano: Number(rowObj.Ano) || new Date().getFullYear(),
      // Strictly maintain exact installation with all original dots (.) and dashes (-)
      instalacao: String(rowObj.instalacao || '').trim(),
      medidor: String(rowObj.medidor || '').trim(),
      reg: rowObj.reg !== undefined ? String(rowObj.reg) : '01',
      rz: rz_val,
      rz_ul_lv: rz_ul_numeric,
      ul: ul_val,
      foto: String(rowObj.foto || 'OK').trim().toUpperCase(),
      tipo: String(rowObj.tipo || 'URBANO').trim().toUpperCase(),
      matr: String(rowObj.matr || '').trim(),
      nl: String(rowObj.nl || '0').trim(),
      data_original: parsedDate.date || String(rowObj.data_original || '').trim(),
      hora_original: parsedHora.time || String(rowObj.hora_original || '').trim(),
      endereco: String(rowObj.endereco || '').trim(),
      l_atual: Number(rowObj.l_atual) || 0,
      consumo: Number(rowObj.consumo) || 0,
      nosb_impedimento: String(rowObj.nosb_impedimento || '').trim(),
      nosb_simulacao: String(rowObj.nosb_simulacao || '').trim(),
      digitacao: Number(rowObj.digitacao) || 1,
      cna: String(rowObj.cna || 'B1 - RESIDENCIAL').trim(),
      consistencia: String(rowObj.consistencia || 'CONSISTENTE').trim(),
    };

    records.push(record);
  }

  if (records.length === 0) {
    throw new Error("A planilha foi lida com sucesso, porém nenhuma linha válida com dados de leiturista foi encontrada.");
  }

  return records;
}

/**
 * Generates an extensive, highly realistic demonstration dataset (650+ records)
 * containing all 22 required columns with real Brazilian electrical utility patterns.
 */
export function generateSampleRecords(): FieldRecord[] {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio'];
  const years = [2024, 2025];
  const razoes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12', '15'];
  const matriculas = ['10420', '10421', '10422', '10423', '10424', '10425', '10428', '10430'];
  const tipos = ['URBANO', 'POVOADO', 'RURAL'];
  const logradouros = [
    'AV. BRASIL', 'RUA DAS FLORES', 'RUA 15 DE NOVEMBRO', 'RODOVIA BR-101 KM 12',
    'TRAVESSA SAO PAULO', 'RUA DO COMERCIO', 'ALAMEDA DOS IPES', 'ESTRADA VELHA RURAL',
    'AV. INDEPENDENCIA', 'RUA AMAZONAS', 'PRACA CENTRAL', 'RUA SANTOS DUMONT'
  ];

  const nosbReasons = [
    'PORTAO FECHADO',
    'CAO BRAVO',
    'MEDIDOR OBSTRUIDO',
    'CLIENTE IMPEDIU',
    'PADRAO DESTRUIDO',
    'AREA DE RISCO',
    'CHUVAS INTENSAS',
    'MEDIDOR EMBAÇADO'
  ];

  const sampleRecords: FieldRecord[] = [];
  let installationBase = 1004820000;
  let meterBase = 8400000;

  for (const year of years) {
    for (const month of months) {
      for (const matr of matriculas) {
        // Each leiturista executes 6-10 readings per month/batch
        const batchSize = 8;
        let startHour = 7;
        let startMin = Math.floor(Math.random() * 20) + 10;

        for (let i = 0; i < batchSize; i++) {
          installationBase += Math.floor(Math.random() * 12) + 1;
          meterBase += Math.floor(Math.random() * 9) + 1;

          const rz = razoes[(parseInt(matr) + i) % razoes.length];
          const ulNum = 1000 + ((parseInt(matr) * 3 + i * 2) % 500);
          const rz_ul_lv = Number(`${rz}${ulNum}`);
          const tipo = tipos[i % 3 === 0 ? 2 : (i % 2 === 0 ? 1 : 0)];

          // Determinar se tem impedimento
          // Leiturista 10423 e 10428 propositalmente com mais impedimentos para alertar acima de 0,50%
          const isHighFail = matr === '10423' || matr === '10428';
          const hasImpediment = isHighFail ? Math.random() < 0.65 : Math.random() < 0.22;
          
          let nl = '0';
          let nosb_imp = '';
          let foto = 'OK';
          let digitacao = Math.random() > 0.4 ? 2 : (Math.random() > 0.8 ? 3 : 1);

          if (hasImpediment) {
            const randomCode = EXACT_IMPEDIMENTO_CODES[Math.floor(Math.random() * EXACT_IMPEDIMENTO_CODES.length)];
            nl = randomCode;
            nosb_imp = nosbReasons[Math.floor(Math.random() * nosbReasons.length)];
            foto = Math.random() > 0.35 ? 'OK' : 'N-OK';
          } else {
            foto = Math.random() > 0.15 ? 'OK' : 'N-OK';
          }

          // Generate date & incrementing time
          startMin += Math.floor(Math.random() * 6) + 3;
          if (startMin >= 60) {
            startHour += Math.floor(startMin / 60);
            startMin = startMin % 60;
          }
          const horaStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}`;
          
          const day = Math.min(28, (parseInt(matr) % 15) + (i % 5) + 1);
          const monthNum = months.indexOf(month) + 1;
          const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          const prevLeitura = 14000 + i * 150 + Math.floor(Math.random() * 50);
          const consumoKwh = hasImpediment ? 0 : Math.floor(Math.random() * 380) + 90;
          const leituraAtual = prevLeitura + consumoKwh;

          const instDigitStr = String(installationBase).padStart(11, '0');
          const formattedInst = `${instDigitStr.slice(0, 3)}.${instDigitStr.slice(3, 6)}.${instDigitStr.slice(6, 9)}-${instDigitStr.slice(9, 11)}`;

          sampleRecords.push({
            Mes: month,
            Ano: year,
            instalacao: formattedInst,
            medidor: `BR${meterBase}`,
            reg: String(Math.floor(Math.random() * 5) + 1).padStart(2, '0'),
            rz,
            rz_ul_lv,
            ul: String(ulNum),
            foto,
            tipo,
            matr,
            nl,
            data_original: dateStr,
            hora_original: horaStr,
            endereco: `${logradouros[i % logradouros.length]}, ${100 + i * 14}`,
            l_atual: leituraAtual,
            consumo: consumoKwh,
            nosb_impedimento: nosb_imp || (hasImpediment ? 'LEITURA CONFIRMADA' : ''),
            nosb_simulacao: hasImpediment ? 'SIM' : 'NAO',
            digitacao,
            cna: tipo === 'RURAL' ? 'B2 - RURAL' : (i % 3 === 0 ? 'B3 - COMERCIAL' : 'B1 - RESIDENCIAL'),
            consistencia: hasImpediment ? 'IMPEDIMENTO' : 'CONSISTENTE'
          });
        }
      }
    }
  }

  return sampleRecords;
}
