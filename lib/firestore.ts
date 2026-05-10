import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, updateDoc, deleteDoc,
  writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lote, DietaDia, Trato, LeituraCocho, Insumo, RecebimentoInsumo } from '@/types';

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
  for (const d of dietas) {
    batch.set(doc(db, 'dieta_dias', d.id), d);
  }
  await batch.commit();
}

export async function getDietaDias(loteId: string): Promise<DietaDia[]> {
  const snap = await getDocs(
    query(collection(db, 'dieta_dias'), where('loteId', '==', loteId), orderBy('dia', 'asc'))
  );
  return snap.docs.map(d => d.data() as DietaDia);
}

export async function getDietaDiaByData(loteId: string, data: string): Promise<DietaDia | null> {
  const snap = await getDocs(
    query(collection(db, 'dieta_dias'), where('loteId', '==', loteId), where('data', '==', data))
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as DietaDia;
}

// ─── Tratos ───────────────────────────────────────────────────────────────────

export async function salvarTrato(trato: Trato) {
  await setDoc(doc(db, 'tratos', trato.id), trato);
}

export async function getTratosByLote(loteId: string): Promise<Trato[]> {
  const snap = await getDocs(
    query(collection(db, 'tratos'), where('loteId', '==', loteId), orderBy('data', 'desc'))
  );
  return snap.docs.map(d => d.data() as Trato);
}

export async function getTratosByLoteData(loteId: string, data: string): Promise<Trato[]> {
  const snap = await getDocs(
    query(collection(db, 'tratos'), where('loteId', '==', loteId), where('data', '==', data))
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

export async function getLeituraCocho(loteId: string, data: string): Promise<LeituraCocho | null> {
  const snap = await getDocs(
    query(collection(db, 'leituras_cocho'), where('loteId', '==', loteId), where('data', '==', data))
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as LeituraCocho;
}

export async function getLeiturasCochoByLote(loteId: string): Promise<LeituraCocho[]> {
  const snap = await getDocs(
    query(collection(db, 'leituras_cocho'), where('loteId', '==', loteId), orderBy('data', 'desc'))
  );
  return snap.docs.map(d => d.data() as LeituraCocho);
}

// ─── Insumos ──────────────────────────────────────────────────────────────────

export async function salvarInsumo(insumo: Insumo) {
  await setDoc(doc(db, 'insumos', insumo.id), insumo);
}

export async function getInsumos(fazendaId: string): Promise<Insumo[]> {
  const snap = await getDocs(
    query(collection(db, 'insumos'), where('fazendaId', '==', fazendaId), orderBy('nome', 'asc'))
  );
  return snap.docs.map(d => d.data() as Insumo);
}

export async function salvarRecebimento(r: RecebimentoInsumo) {
  await setDoc(doc(db, 'recebimentos_insumo', r.id), r);
}

export async function getRecebimentos(insumoId: string): Promise<RecebimentoInsumo[]> {
  const snap = await getDocs(
    query(collection(db, 'recebimentos_insumo'), where('insumoId', '==', insumoId), orderBy('data', 'desc'))
  );
  return snap.docs.map(d => d.data() as RecebimentoInsumo);
}
