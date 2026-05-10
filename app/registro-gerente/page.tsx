'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registrarGerente } from '@/lib/convites';

export default function RegistroGerentePage() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '', fazenda: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return; }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    setCarregando(true);
    try {
      await registrarGerente(form.nome.trim(), form.email.trim(), form.senha, form.fazenda.trim());
      router.replace('/');
    } catch (e: any) {
      setErro(e.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.' : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-full bg-green-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <Link href="/login" className="text-green-700 text-sm flex items-center gap-1 mb-5">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Criar conta</h1>
        <p className="text-gray-400 text-sm mb-6">Você será o gerente da fazenda</p>

        <form onSubmit={cadastrar} className="space-y-4">
          <Secao titulo="SEUS DADOS">
            <Campo label="Nome completo" value={form.nome} onChange={v => set('nome', v)} placeholder="João da Silva" />
            <Campo label="E-mail" type="email" value={form.email} onChange={v => set('email', v)} placeholder="gerente@fazenda.com" />
            <Campo label="Senha" type="password" value={form.senha} onChange={v => set('senha', v)} placeholder="Mínimo 6 caracteres" />
            <Campo label="Confirmar senha" type="password" value={form.confirmar} onChange={v => set('confirmar', v)} placeholder="Repita a senha" />
          </Secao>

          <Secao titulo="SUA FAZENDA">
            <Campo label="Nome da fazenda" value={form.fazenda} onChange={v => set('fazenda', v)} placeholder="Ex: Fazenda Santa Fé" />
          </Secao>

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
          >
            {carregando ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
      <p className="text-xs font-bold text-green-700 mb-3 tracking-widest">{titulo}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
      />
    </div>
  );
}
