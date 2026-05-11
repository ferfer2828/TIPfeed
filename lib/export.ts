import { utils, write } from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote } from '@/types';
import {
  getTratosByLote,
  getLeiturasCochoByLote,
  getDietaDias,
  getLotes,
} from './firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

// ─── Exportar lote individual ─────────────────────────────────────────────────

export async function exportarLote(lote: Lote, fazendaId: string) {
  const [tratos, leituras, dietas] = await Promise.all([
    getTratosByLote(lote.id, fazendaId),
    getLeiturasCochoByLote(lote.id, fazendaId),
    getDietaDias(lote.id, fazendaId),
  ]);

  const dietaMap: Record<string, number> = {};
  for (const d of dietas) dietaMap[d.data] = d.quantidadeRecomendada;

  const leituraMap: Record<string, number> = {};
  for (const l of leituras) leituraMap[l.data] = l.valor;

  const porDia: Record<string, typeof tratos> = {};
  for (const t of tratos) {
    if (!porDia[t.data]) porDia[t.data] = [];
    porDia[t.data].push(t);
  }

  const label = ['Limpo', 'Baixo', 'Médio', 'Cheio'];
  const linhas = Object.keys(porDia).sort().map(data => {
    const total = porDia[data].reduce((s, t) => s + t.quantidadeEfetiva, 0);
    return {
      'Data': format(new Date(data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      'Recomendado (kg)': dietaMap[data] ?? '',
      'Efetivo (kg)': total,
      'Diferença (kg)': dietaMap[data] != null ? total - dietaMap[data] : '',
      'Cocho': leituraMap[data] != null ? label[leituraMap[data]] : '',
      'Funcionários': porDia[data].map(t => t.funcionarioNome).join(', '),
    };
  });

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet([
    ['Lote', lote.nome],
    ['Invernada', lote.invernada],
    ['Peso de Entrada (kg)', lote.pesoEntrada],
    ['Qtd. Bois', lote.quantidadeBois],
    ['Data de Início', lote.dataInicio],
    ['Previsão de Abate', lote.previsaoAbate],
    ['Tratos/dia', lote.numTratosDia],
  ]), 'Dados do Lote');
  utils.book_append_sheet(wb, utils.json_to_sheet(linhas), 'Histórico');

  baixarXlsx(wb, `trato_${lote.nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ─── Exportar geral da fazenda ────────────────────────────────────────────────

export async function exportarGeral(fazendaId: string) {
  const lotes = await getLotes(fazendaId);
  const loteMap: Record<string, Lote> = {};
  for (const l of lotes) loteMap[l.id] = l;

  // Buscar todos os tratos da fazenda
  const snap = await getDocs(
    query(collection(db, 'tratos'), where('fazendaId', '==', fazendaId))
  );
  const tratos = snap.docs.map(d => d.data() as any);
  tratos.sort((a: any, b: any) => a.data.localeCompare(b.data));

  const linhas = tratos.map((t: any) => ({
    'Data': format(new Date(t.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    'Lote': loteMap[t.loteId]?.nome ?? t.loteId,
    'Invernada': loteMap[t.loteId]?.invernada ?? '',
    'Bois': loteMap[t.loteId]?.quantidadeBois ?? '',
    'Nº Trato': t.numeroTrato,
    'Qtd. Efetiva (kg)': t.quantidadeEfetiva,
    'Funcionário': t.funcionarioNome,
  }));

  const lotesLinhas = lotes.map(l => ({
    'Lote': l.nome,
    'Invernada': l.invernada,
    'Bois': l.quantidadeBois,
    'Peso Entrada (kg)': l.pesoEntrada,
    'Início': l.dataInicio,
    'Prev. Abate': l.previsaoAbate,
    'Tratos/dia': l.numTratosDia,
  }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(lotesLinhas), 'Lotes');
  utils.book_append_sheet(wb, utils.json_to_sheet(linhas), 'Tratos');

  baixarXlsx(wb, `trato_bovino_geral_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function baixarXlsx(wb: any, nome: string) {
  const data = write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
