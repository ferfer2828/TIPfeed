'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.replace('/');
    } catch {
      setErro('E-mail ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-green-800 p-4">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🐄</div>
        <h1 className="text-3xl font-extrabold text-white">Trato Bovino</h1>
        <p className="text-green-300 mt-1">Confinamento</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">Primeira vez?</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-3">
          <Link
            href="/registro-gerente"
            className="block w-full border-2 border-green-700 text-green-700 font-semibold py-3 rounded-xl text-center text-sm hover:bg-green-50 transition"
          >
            Sou gerente — criar fazenda
          </Link>
          <Link
            href="/registro-peao"
            className="block w-full border-2 border-gray-300 text-gray-600 font-semibold py-3 rounded-xl text-center text-sm hover:bg-gray-50 transition"
          >
            Tenho um código de convite
          </Link>
        </div>
      </div>
    </div>
  );
}
