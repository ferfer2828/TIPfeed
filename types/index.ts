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

export interface Insumo {
  id: string;
  fazendaId: string;
  nome: string;
  unidade: string;
  alertaAtivo: boolean;
  mensagemAlerta: string;
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
