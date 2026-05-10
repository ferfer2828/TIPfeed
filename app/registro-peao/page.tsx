'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validarConvite, registrarPeao } from '@/lib/convites';

type Etapa = 'codigo' | 'dados';

export default function RegistroPeaoPage() {
  const [etapa, setEtapa] = useState<Etapa>('codigo');
  const [codigo, setCodigo] = useState('');
  const [conviteInfo, setConviteInfo] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await validarConvite(codigo);
      if (!res.valido) { setErro(res.motivo!); return; }
      setConviteInfo(res.convite);
      setEtapa('dados');
    } catch {
      setErro('Erro ao verificar o código. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  }

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return; }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    setCarregando(true);
    try {
      await registrarPeao(codigo, form.nome.trim(), form.email.trim(), form.senha);
      router.replace('/');
    } catch (e: any) {
      setErro(e.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.' : e.message || 'Erro ao criar conta.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-full bg-green-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <button
          onClick={() => etapa === 'dados' ? setEtapa('codigo') : router.back()}
          className="text-green-700 text-sm flex items-center gap-1 mb-5"
        >
          ← Voltar
        </button>

        {etapa === 'codigo' ? (
          <>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Código de convite</h1>
            <p className="text-gray-400 text-sm mb-6">Digite o código que o gerente enviou</p>

            <form onSubmit={verificar} className="space-y-4">
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: AB3X9K"
                maxLength={6}
                required
                className="w-full border-2 border-green-600 rounded-xl px-4 py-5 text-3xl font-extrabold text-green-700 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
              />
              <p className="text-xs text-gray-400 text-center">O código tem 6 caracteres e é enviado pelo gerente</p>

              {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

              <button
                type="submit"
                disabled={carregando}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
              >
                {carregando ? 'Verificando...' : 'Verificar código'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-5">
              <span className="text-green-600">✓</span>
              <span className="text-sm text-green-700">
                Fazenda: <strong>{conviteInfo?.fazendaNome}</strong>
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Criar sua conta</h1>
            <p className="text-gray-400 text-sm mb-6">Você será cadastrado como peão</p>

            <form onSubmit={finalizar} className="space-y-3">
              {[
                { label: 'Nome completo', campo: 'nome', type: 'text', ph: 'Carlos Pereira' },
                { label: 'E-mail', campo: 'email', type: 'email', ph: 'peao@fazenda.com' },
                { label: 'Senha', campo: 'senha', type: 'password', ph: 'Mínimo 6 caracteres' },
                { label: 'Confirmar senha', campo: 'confirmar', type: 'password', ph: 'Repita a senha' },
              ].map(f => (
                <div key={f.campo}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.campo as keyof typeof form]}
                    onChange={e => set(f.campo, e.target.value)}
                    placeholder={f.ph}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}

              {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

              <button
                type="submit"
                disabled={carregando}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 mt-2"
              >
                {carregando ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
