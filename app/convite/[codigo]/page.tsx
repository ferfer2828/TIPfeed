'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { validarConvite, registrarPeao } from '@/lib/convites';

type Fase = 'validando' | 'dados' | 'erro' | 'sucesso';

export default function ConvitePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();

  const [fase, setFase] = useState<Fase>('validando');
  const [conviteInfo, setConviteInfo] = useState<any>(null);
  const [erroConvite, setErroConvite] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  // Valida o convite automaticamente ao carregar
  useEffect(() => {
    if (!codigo) return;
    validarConvite(codigo)
      .then(res => {
        if (!res.valido) {
          setErroConvite(res.motivo ?? 'Convite inválido.');
          setFase('erro');
        } else {
          setConviteInfo(res.convite);
          setFase('dados');
        }
      })
      .catch(() => {
        setErroConvite('Não foi possível verificar o convite. Verifique sua conexão.');
        setFase('erro');
      });
  }, [codigo]);

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return; }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    setSalvando(true);
    try {
      await registrarPeao(codigo, form.nome.trim(), form.email.trim(), form.senha);
      setFase('sucesso');
      setTimeout(() => router.replace('/'), 2000);
    } catch (e: any) {
      setErro(
        e.code === 'auth/email-already-in-use'
          ? 'Este e-mail já está cadastrado.'
          : e.message || 'Erro ao criar conta.'
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">

        {/* Logo / título */}
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">🐄</p>
          <h1 className="text-xl font-extrabold text-green-800">TIPFeed</h1>
        </div>

        {/* Validando */}
        {fase === 'validando' && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Verificando convite...</p>
          </div>
        )}

        {/* Erro no convite */}
        {fase === 'erro' && (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold text-red-600 mb-1">Convite inválido</p>
            <p className="text-sm text-gray-500 mb-6">{erroConvite}</p>
            <p className="text-xs text-gray-400">
              Peça ao gerente para gerar um novo link de convite.
            </p>
          </div>
        )}

        {/* Formulário de cadastro */}
        {fase === 'dados' && (
          <>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-5">
              <span className="text-green-600 text-lg">✓</span>
              <div>
                <p className="text-xs text-green-600">Convite válido</p>
                <p className="text-sm text-green-700 font-bold">{conviteInfo?.fazendaNome}</p>
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-gray-800 mb-1">Criar sua conta</h2>
            <p className="text-gray-400 text-sm mb-5">Você será cadastrado como peão</p>

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
                disabled={salvando}
                className="w-full bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-60 active:bg-green-800 mt-2"
              >
                {salvando ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>
          </>
        )}

        {/* Sucesso */}
        {fase === 'sucesso' && (
          <div className="text-center py-8">
            <p className="text-5xl mb-3">✅</p>
            <p className="font-bold text-green-700 text-lg">Conta criada!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecionando...</p>
          </div>
        )}
      </div>
    </div>
  );
}
