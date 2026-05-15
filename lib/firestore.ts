import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lote, DietaDia, Trato, LeituraCocho, Insumo, RecebimentoInsumo, Cotacao, DietaFazenda } from '@/types';

// ─── Lotes ────────────────────────────────────────────────────────────────────

export async function salvarLote(lote: Lote) {
  await setDoc(doc(db, 'lotes', lote.id), lote);
}

export async function getLotes(fazendaId: string): Promise<Lote[]> {
  const snap = await getDocs(
    query(collection(db, 'lotes'), where('fazendaId', '==', fazendaId), where('ativo', '==', true))
  );
  return snap.docs.map(d => d.data() as Lote)
    .sort((a, b) => a.ordemDescarregamento - b.ordemDescarregamento);
}

export async function getLote(id: string): Promise<Lote | null> {
  const snap = await getDoc(doc(db, 'lotes', id));
  return snap.exists() ? snap.data() as Lote : null;
}

export async function inativarLote(id: string) {
  await updateDoc(doc(db, 'lotes', id), { ativo: false, atualizadoEm: new Date().toISOString() });
}

// ─── Dieta Dias ───────────────────────────────────────────────────────────────

export async function salvarDietaDias(dietas: DietaDia[]) {
  const batch = writeBatch(db);
  for (const d of dietas) batch.set(doc(db, 'dieta_dias', d.id), d);
  await batch.commit();
}

// fazendaId obrigatório — as regras de segurança do Firestore exigem que
// queries de coleção incluam o campo usado na regra (pertenceAFazenda).
export async function getDietaDias(loteId: string, fazendaId: string): Promise<DietaDia[]> {
  const snap = await getDocs(
    query(
      collection(db, 'dieta_dias'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
    )
  );
  return snap.docs.map(d => d.data() as DietaDia)
    .sort((a, b) => a.dia - b.dia);
}

export async function getDietaDiaByData(loteId: string, data: string, fazendaId: string): Promise<DietaDia | null> {
  const snap = await getDocs(
    query(
      collection(db, 'dieta_dias'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
      where('data', '==', data),
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as DietaDia;
}

// ─── Tratos ───────────────────────────────────────────────────────────────────

export async function salvarTrato(trato: Trato) {
  await setDoc(doc(db, 'tratos', trato.id), trato);
}

export async function getTratosByLote(loteId: string, fazendaId: string): Promise<Trato[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tratos'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
    )
  );
  return snap.docs.map(d => d.data() as Trato)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export async function getTratosByLoteData(loteId: string, data: string, fazendaId: string): Promise<Trato[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tratos'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
      where('data', '==', data),
    )
  );
  return snap.docs.map(d => d.data() as Trato);
}

export async function getTratosByFazendaData(fazendaId: string, data: string): Promise<Trato[]> {
  const snap = await getDocs(
    query(collection(db, 'tratos'), where('fazendaId', '==', fazendaId), where('data', '==', data))
  );
  return snap.docs.map(d => d.data() as Trato);
}

// ─── Leitura Cocho ────────────────────────────────────────────────────────────

export async function salvarLeituraCocho(l: LeituraCocho) {
  await setDoc(doc(db, 'leituras_cocho', l.id), l);
}

export async function getLeituraCocho(loteId: string, data: string, fazendaId: string): Promise<LeituraCocho | null> {
  const snap = await getDocs(
    query(
      collection(db, 'leituras_cocho'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
      where('data', '==', data),
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as LeituraCocho;
}

export async function getLeiturasCochoByLote(loteId: string, fazendaId: string): Promise<LeituraCocho[]> {
  const snap = await getDocs(
    query(
      collection(db, 'leituras_cocho'),
      where('loteId', '==', loteId),
      where('fazendaId', '==', fazendaId),
    )
  );
  return snap.docs.map(d => d.data() as LeituraCocho)
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ─── Insumos ──────────────────────────────────────────────────────────────────

export async function salvarInsumo(insumo: Insumo) {
  await setDoc(doc(db, 'insumos', insumo.id), insumo);
}

export async function getInsumos(fazendaId: string): Promise<Insumo[]> {
  const snap = await getDocs(
    query(collection(db, 'insumos'), where('fazendaId', '==', fazendaId))
  );
  return snap.docs.map(d => d.data() as Insumo)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function salvarRecebimento(r: RecebimentoInsumo) {
  await setDoc(doc(db, 'recebimentos_insumo', r.id), r);
}

export async function getRecebimentos(insumoId: string, fazendaId: string): Promise<RecebimentoInsumo[]> {
  const snap = await getDocs(
    query(
      collection(db, 'recebimentos_insumo'),
      where('insumoId', '==', insumoId),
      where('fazendaId', '==', fazendaId),
    )
  );
  return snap.docs.map(d => d.data() as RecebimentoInsumo)
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ─── Cotações ─────────────────────────────────────────────────────────────────

export async function salvarCotacao(c: Cotacao) {
  await setDoc(doc(db, 'cotacoes', c.id), c);
}

export async function getCotacoesByInsumo(insumoId: string, fazendaId: string): Promise<Cotacao[]> {
  const snap = await getDocs(
    query(
      collection(db, 'cotacoes'),
      where('insumoId', '==', insumoId),
      where('fazendaId', '==', fazendaId),
    )
  );
  return snap.docs.map(d => d.data() as Cotacao)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export async function getCotacoesByFazenda(fazendaId: string): Promise<Cotacao[]> {
  const snap = await getDocs(
    query(collection(db, 'cotacoes'), where('fazendaId', '==', fazendaId))
  );
  return snap.docs.map(d => d.data() as Cotacao)
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ─── Dieta da Fazenda ─────────────────────────────────────────────────────────

export async function getDietaFazenda(fazendaId: string): Promise<DietaFazenda | null> {
  const snap = await getDoc(doc(db, 'dieta_fazenda', fazendaId));
  return snap.exists() ? snap.data() as DietaFazenda : null;
}

export async function salvarDietaFazenda(d: DietaFazenda) {
  await setDoc(doc(db, 'dieta_fazenda', d.id), d);
}
