'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { atualizarNomeUsuario } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function PerfilPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [salvoNome, setSalvoNome] = useState(false);
  const [erroNome, setErroNome] = useState('');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [salvoSenha, setSalvoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  async function salvarNome() {
    if (!nome.trim() || !usuario) return;
    setSalvandoNome(true);
    setErroNome('');
    try {
      await atualizarNomeUsuario(usuario.uid, nome.trim());
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: nome.trim() });
      setSalvoNome(true);
      setTimeout(() => setSalvoNome(false), 2500);
    } catch {
      setErroNome('Erro ao salvar nome. Tente novamente.');
    } finally {
      setSalvandoNome(false);
    }
  }

  async function salvarSenha() {
    setErroSenha('');
    if (!senhaAtual) { setErroSenha('Informe a senha atual.'); return; }
    if (novaSenha.length < 6) { setErroSenha('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (novaSenha !== confirmarSenha) { setErroSenha('As senhas não coincidem.'); return; }
    if (!auth.currentUser?.email) { setErroSenha('Usuário não encontrado.'); return; }

    setSalvandoSenha(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, novaSenha);
      setSalvoSenha(true);
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      setTimeout(() => setSalvoSenha(false), 2500);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setErroSenha('Senha atual incorreta.');
      } else {
        setErroSenha('Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-green-200">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-white text-xl font-extrabold">Meu Perfil</h1>
          <p className="text-green-200 text-xs">{usuario?.email}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Nome */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-green-700 tracking-widest mb-3">NOME</p>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
            placeholder="Seu nome"
          />
          {erroNome && <p className="text-red-500 text-xs mb-2">{erroNome}</p>}
          {salvoNome && <p className="text-green-600 text-xs mb-2 font-semibold">✓ Nome atualizado!</p>}
          <button
            onClick={salvarNome}
            disabled={salvandoNome || !nome.trim() || nome.trim() === usuario?.nome}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:bg-green-800 text-sm"
          >
            {salvandoNome ? 'Salvando...' : 'Salvar nome'}
          </button>
        </div>

        {/* Senha */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-green-700 tracking-widest mb-3">ALTERAR SENHA</p>
          <div className="space-y-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Senha atual</label>
              <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="••••••" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Confirmar nova senha</label>
              <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Repita a nova senha" />
            </div>
          </div>
          {erroSenha && <p className="text-red-500 text-xs mb-2">{erroSenha}</p>}
          {salvoSenha && <p className="text-green-600 text-xs mb-2 font-semibold">✓ Senha alterada com sucesso!</p>}
          <button
            onClick={salvarSenha}
            disabled={salvandoSenha || !senhaAtual || !novaSenha || !confirmarSenha}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:bg-blue-700 text-sm"
          >
            {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>

        {/* Info */}
        <div className="bg-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 text-center">
            Perfil: <span className="font-semibold capitalize">{usuario?.perfil}</span>
            {' · '}E-mail: <span className="font-semibold">{usuario?.email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
