import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from './firebase';

export function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return codigo;
}

export async function criarConvite(fazendaId: string, fazendaNome: string, criadoPorUid: string): Promise<string> {
  const codigo = gerarCodigo();
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await setDoc(doc(db, 'convites', codigo), {
    codigo, fazendaId, fazendaNome, perfil: 'peao',
    criadoPor: criadoPorUid, criadoEm: new Date().toISOString(),
    expiresAt: expira.toISOString(), usado: false,
  });
  return codigo;
}

export async function validarConvite(codigo: string): Promise<{ valido: boolean; motivo?: string; convite?: any }> {
  const snap = await getDoc(doc(db, 'convites', codigo.toUpperCase().trim()));
  if (!snap.exists()) return { valido: false, motivo: 'Código inválido.' };
  const convite = snap.data();
  if (convite.usado) return { valido: false, motivo: 'Este convite já foi utilizado.' };
  if (new Date() > new Date(convite.expiresAt)) return { valido: false, motivo: 'Este convite expirou.' };
  return { valido: true, convite };
}

export async function registrarPeao(codigo: string, nome: string, email: string, senha: string) {
  const { valido, motivo, convite } = await validarConvite(codigo);
  if (!valido) throw new Error(motivo);
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    uid: cred.user.uid, nome, email, perfil: 'peao',
    fazendaId: convite.fazendaId, criadoEm: new Date().toISOString(),
  });
  await updateDoc(doc(db, 'convites', codigo.toUpperCase().trim()), {
    usado: true, usadoPor: cred.user.uid, usadoEm: new Date().toISOString(),
  });
}

export async function registrarGerente(nome: string, email: string, senha: string, nomeFazenda: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  const fazendaId = cred.user.uid;
  await setDoc(doc(db, 'fazendas', fazendaId), {
    id: fazendaId, nome: nomeFazenda, donoUid: cred.user.uid, criadoEm: new Date().toISOString(),
  });
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    uid: cred.user.uid, nome, email, perfil: 'gerente',
    fazendaId, criadoEm: new Date().toISOString(),
  });
}

export async function listarPeoes(fazendaId: string): Promise<any[]> {
  const snap = await getDocs(query(collection(db, 'usuarios'), where('fazendaId', '==', fazendaId), where('perfil', '==', 'peao')));
  return snap.docs.map(d => d.data());
}

export async function listarConvites(fazendaId: string): Promise<any[]> {
  const snap = await getDocs(query(collection(db, 'convites'), where('fazendaId', '==', fazendaId)));
  return snap.docs.map(d => d.data()).sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

export async function getNomeFazenda(fazendaId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'fazendas', fazendaId));
  return snap.exists() ? snap.data()?.nome ?? 'Fazenda' : 'Fazenda';
}
