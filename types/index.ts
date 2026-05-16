export type Perfil = 'gerente' | 'peao';

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  perfil: Perfil;
  fazendaId: string;
}

export interface Lote {
  id: string;
  fazendaId: string;
  nome: string;
  invernada: string;
  pesoEntrada: number;
  dataInicio: string;
  quantidadeBois: number;
  previsaoAbate: string;
  numTratosDia: number;
  ordemDescarregamento: number;
  /** true = trata 7 dias/semana · false/undefined = não trata domingo (usa fator ×7÷6) */
  trataDomingo?: boolean;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DietaDia {
  id: string;
  loteId: string;
  fazendaId: string;
  dia: number;
  data: string;
  quantidadeRecomendada: number;
}

export interface Trato {
  id: string;
  loteId: string;
  fazendaId: string;
  data: string;
  numeroTrato: number;
  quantidadeEfetiva: number;
  funcionarioId: string;
  funcionarioNome: string;
  criadoEm: string;
}

export interface LeituraCocho {
  id: string;
  loteId: string;
  fazendaId: string;
  data: string;
  valor: 0 | 1 | 2 | 3;
  funcionarioId: string;
  funcionarioNome: string;
  criadoEm: string;
}

export const CATEGORIAS_INSUMO = [
  { valor: 'volumoso',    label: 'Volumoso',    icon: '🌾' },
  { valor: 'concentrado', label: 'Concentrado', icon: '🌽' },
  { valor: 'mineral',     label: 'Mineral',     icon: '💊' },
  { valor: 'outros',      label: 'Outros',      icon: '📦' },
] as const;

export type CategoriaInsumo = 'volumoso' | 'concentrado' | 'mineral' | 'outros';

export interface Insumo {
  id: string;
  fazendaId: string;
  nome: string;
  unidade: string;
  categoria: CategoriaInsumo;
  alertaAtivo: boolean;
  mensagemAlerta: string;
  atualizadoEm: string;
  ativo?: boolean; // undefined = ativo; false = excluído (soft-delete)
}

export interface Cotacao {
  id: string;
  insumoId: string;
  fazendaId: string;
  precoUnitario: number;
  fornecedor: string;
  data: string;
  criadoEm: string;
}

export interface ComposicaoItem {
  insumoId: string;
  insumoNome: string;
  percentual: number;   // % na ração (0–100)
  precoKg: number;      // R$/kg (já convertido pelo usuário)
  unidade: string;      // unidade original do insumo (para referência)
}

export interface DietaFazenda {
  id: string;           // = fazendaId
  fazendaId: string;
  ganhoDiarioEsperado: number; // kg/animal/dia
  composicao: ComposicaoItem[];
  atualizadoEm: string;
}

export interface RecebimentoInsumo {
  id: string;
  insumoId: string;
  fazendaId: string;
  quantidade: number;
  data: string;
  observacao: string;
  criadoEm: string;
}

export interface Fazenda {
  id: string;          // = fazendaId
  nome: string;
  localizacao?: string;
  donoUid: string;
  criadoEm: string;
  atualizadoEm?: string;
}
