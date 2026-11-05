export interface FieldRecord {
  Mes: string;
  Ano: number;
  instalacao: string;
  medidor: string;
  reg: string | number;
  rz: string | number;
  rz_ul_lv: number;
  ul: string;
  foto: string;
  tipo: string;
  matr: string;
  nl: string | number;
  data_original: string;
  hora_original: string;
  endereco: string;
  l_atual: number;
  consumo: number;
  nosb_impedimento: string;
  nosb_simulacao: string;
  digitacao: number;
  cna: string;
  consistencia: string;
  ciclo?: string;
}

export const EXACT_IMPEDIMENTO_CODES: string[] = [
  '3201', '3205', '3245', '3301', '3312', '3313', '3369', '3370', '3374', '3379',
  '3901', '3902', '3903', '3904', '3905', '3906', '3907', '3908',
  '5101', '5102', '5103', '5104', '5105', '5106', '5107', '5108', '5109', '5127',
  '5260', '5558', '5800', '5802', '3376'
];

export const EXTENDED_IMPEDIMENTO_CODES: string[] = [
  ...EXACT_IMPEDIMENTO_CODES,
  '3511', '3601', '3700', '3801', '3830', '3865', '3868', '3871', '3878',
  '3804', '3867', '3894', '3895', '2000', '6824'
];

export const MONTH_ORDER: Record<string, number> = {
  'JANEIRO': 1, 'FEVEREIRO': 2, 'MARÇO': 3, 'MARCO': 3,
  'ABRIL': 4, 'MAIO': 5, 'JUNHO': 6,
  'JULHO': 7, 'AGOSTO': 8, 'SETEMBRO': 9,
  'OUTUBRO': 10, 'NOVEMBRO': 11, 'DEZEMBRO': 12
};

export interface MetricasPrincipais {
  total_leituras: number;
  nao_realizadas: number;
  realizadas: number;
  perc_impedimentos: number;
}

export interface DadosPorTipo {
  tipo: string;
  total_leituras: number;
  nao_realizadas: number;
  realizadas: number;
  perc_impedimentos: number;
}

export interface ImpedimentoMatricula {
  matricula: string;
  qtd_leituras: number;
  qtd_impedimentos: number;
}

export interface ImpedimentoRazao {
  razao: string;
  qtd_leituras: number;
  qtd_impedimentos: number;
}

export interface ConsultaRecord {
  mes: string;
  ano: number;
  ul: string;
  instalacao: string;
  medidor: string;
  reg: string;
  matr: string;
  cod: string;
  leitura: number;
  consumo: number;
  dig: string;
  nosb_imp: string;
  nosb_sim: string;
  cna: string;
}

export interface ControleLeituristaRecord {
  ano: number;
  mes: string;
  razao: string;
  ul: string;
  matr: string;
  leit_urb: number;
  leit_povoado: number;
  leit_rural: number;
  leit_total: number;
  impedimentos: number;
  indicador: number;
}