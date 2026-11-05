import { FieldRecord } from '../types';

export const SUPABASE_URL = 'https://mzguwfuncsmgihzmeqoq.supabase.co/rest/v1/BaseLeitura?select=*';
export const SUPABASE_API_KEY = 'sb_publishable_7ikVHkk3N6N7uv2-cmSsTg_VMgP9IMO';

/**
 * Maps raw Supabase record to normalized FieldRecord conforming to SAL business logic.
 * Field names supported:
 * MÊS, ANO, INSTALACAO, MEDIDOR, REG, RAZAO, RZ_UL_LV, UL, FOTO, TIPO, MATR, NL,
 * DATA, HORA, ENDERECO, LEITURA, CONSUMO, nosb_impedimento, nosb_simulacao,
 * digitacao, cna, consistencia, CICLO.
 */
export function mapSupabaseRecordToFieldRecord(raw: any): FieldRecord {
  const mes = String(raw['MÊS'] || raw['MES'] || raw['Mes'] || raw['mes'] || 'Outubro').trim();
  const ano = Number(raw['ANO'] || raw['Ano'] || raw['ano']) || 2026;
  
  // Preserve exact installation string with dots and dashes
  const instalacao = String(raw['INSTALACAO'] ?? raw['instalacao'] ?? raw['Instalacao'] ?? '').trim();
  const medidor = String(raw['MEDIDOR'] ?? raw['medidor'] ?? raw['Medidor'] ?? '').trim();
  const reg = raw['REG'] !== undefined && raw['REG'] !== null ? String(raw['REG']).trim() : (raw['reg'] !== undefined ? String(raw['reg']).trim() : '01');
  
  // Razão (maps to rz with 2-digit padding)
  const razaoRaw = raw['RAZAO'] ?? raw['razao'] ?? raw['rz'] ?? '01';
  const rz = String(razaoRaw).trim().padStart(2, '0');
  
  const ul = String(raw['UL'] ?? raw['ul'] ?? '1001').trim();
  const rzUlRaw = raw['RZ_UL_LV'] ?? raw['rz_ul_lv'] ?? `${rz}${ul}`;
  const rz_ul_lv = Number(String(rzUlRaw).replace(/\D/g, '')) || Number(`${rz}${ul}`) || 0;

  const foto = String(raw['FOTO'] ?? raw['foto'] ?? 'OK').trim().toUpperCase();
  const tipo = String(raw['TIPO'] ?? raw['tipo'] ?? 'URBANO').trim().toUpperCase();
  const matr = String(raw['MATR'] ?? raw['matr'] ?? '').trim();
  const nl = String(raw['NL'] ?? raw['nl'] ?? '0').trim();

  const dataOriginal = String(raw['DATA'] ?? raw['data'] ?? raw['data_original'] ?? '').trim();
  const horaOriginal = String(raw['HORA'] ?? raw['hora'] ?? raw['hora_original'] ?? '').trim();
  const endereco = String(raw['ENDERECO'] ?? raw['endereco'] ?? '').trim();

  const leituraVal = raw['LEITURA'] ?? raw['leitura'] ?? raw['l_atual'] ?? 0;
  const l_atual = Number(leituraVal) || 0;

  const consumoVal = raw['CONSUMO'] ?? raw['consumo'] ?? 0;
  const consumo = Number(consumoVal) || 0;

  const nosb_impedimento = String(raw['nosb_impedimento'] ?? raw['NOSB_IMPEDIMENTO'] ?? '').trim();
  const nosb_simulacao = String(raw['nosb_simulacao'] ?? raw['NOSB_SIMULACAO'] ?? '').trim();
  const digitacao = Number(raw['digitacao'] ?? raw['DIGITACAO']) || 1;
  const cna = String(raw['cna'] ?? raw['CNA'] ?? 'B1 - RESIDENCIAL').trim();
  const consistencia = String(raw['consistencia'] ?? raw['CONSISTENCIA'] ?? 'CONSISTENTE').trim();
  const ciclo = String(raw['CICLO'] ?? raw['ciclo'] ?? '').trim();

  return {
    Mes: mes,
    Ano: ano,
    instalacao,
    medidor,
    reg,
    rz,
    rz_ul_lv,
    ul,
    foto,
    tipo,
    matr,
    nl,
    data_original: dataOriginal,
    hora_original: horaOriginal,
    endereco,
    l_atual,
    consumo,
    nosb_impedimento,
    nosb_simulacao,
    digitacao,
    cna,
    consistencia,
    ciclo,
  };
}

/**
 * Fetches 100% of records from Supabase BaseLeitura API using pagination.
 * Successively calls limit=1000 with offset=0, offset=1000, offset=2000, and so on,
 * until a response returns fewer than 1000 rows.
 * Combines all blocks into a single array before returning.
 */
export async function fetchSupabaseBaseLeitura(onProgress?: (loadedCount: number) => void): Promise<FieldRecord[]> {
  const headers = {
    'apikey': SUPABASE_API_KEY,
    'Authorization': `Bearer ${SUPABASE_API_KEY}`,
    'Accept': 'application/json',
  };

  const limit = 1000;
  let offset = 0;
  let allRawRecords: any[] = [];
  let keepGoing = true;

  // Process concurrent batches of offsets to accelerate loading while strictly paging in order
  const CONCURRENCY = 6;

  try {
    while (keepGoing) {
      const offsets: number[] = [];
      for (let c = 0; c < CONCURRENCY; c++) {
        offsets.push(offset + c * limit);
      }

      const promises = offsets.map(async (off) => {
        const pageUrl = `${SUPABASE_URL}&limit=${limit}&offset=${off}`;
        const res = await fetch(pageUrl, { headers });
        if (!res.ok) {
          throw new Error(`Erro ${res.status} ao consultar API do Supabase: ${res.statusText}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      });

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const batch = results[i];
        if (batch.length > 0) {
          allRawRecords = allRawRecords.concat(batch);
        }
        if (onProgress) {
          onProgress(allRawRecords.length);
        }
        if (batch.length < limit) {
          keepGoing = false;
          break;
        }
      }

      offset += CONCURRENCY * limit;
    }

    return allRawRecords.map(mapSupabaseRecordToFieldRecord);
  } catch (err: any) {
    console.error('Erro na conexão com Supabase:', err);
    throw new Error(err.message || 'Falha ao buscar dados na API do Supabase.');
  }
}
