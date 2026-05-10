'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, salvarLote } from '@/lib/firestore';
import { format, addDays } from 'date-fns';

export default function NovoLotePage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const daqui90 = format(addDays(new Date(), 90), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    nome: '',
    invernada: '',
    dataInicio: hoje,
    previsaoAbate: daqui90,
    quantidadeBois: '',
    pesoEntrada: '',
    numTratosDia: '1',
  });

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!usuario) return;
    if (new Date(form.previsaoAbate) <= new Date(form.dataInicio)) {
      setErro('A data de abate deve ser após a data de início.');
      return;
    }
    setCarregando(true);
    try {
      // Buscar lotes existentes para definir ordem
      const lotes = await getLotes(usuario.fazendaId);
      const maxOrdem = lotes.length > 0
        ? Math.max(...lotes.map(l => l.ordemDescarregamento))
        : 0;

      const id = `${usuario.fazendaId}_${Date.now()}`;
      const agora = new Date().toISOString();
      await salvarLote({
        id,
        fazendaId: usuario.fazendaId,
        nome: form.nome.trim(),
        invernada: form.invernada.trim(),
        dataInicio: form.dataInicio,
        previsaoAbate: form.previsaoAbate,
        quantidadeBois: Number(form.quantidadeBois),
        pesoEntrada: Number(form.pesoEntrada),
        numTratosDia: Number(form.numTratosDia),
        ordemDescarregamento: maxOrdem + 1,
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      });
      // Ir direto para configuração da dieta
      router.replace(`/gerente/lotes/${id}/dieta?novo=1`);
    } catch {
      setErro('Erro ao salvar o lote. Tente novamente.');
    } finally {
      setCarregando(false);
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
        <h1 className="text-white text-xl font-extrabold">Novo Lote</h1>
      </div>

      <form onSubmit={salvar} className="px-4 py-5 space-y-4">
        <Secao titulo="IDENTIFICAÇÃO">
          <Campo label="Nome do lote" value={form.nome} onChange={v => set('nome', v)} placeholder="Ex: Lote A - Nelore" required />
          <Campo label="Invernada / Curral" value={form.invernada} onChange={v => set('invernada', v)} placeholder="Ex: Curral 3" required />
        </Secao>

        <Secao titulo="DATAS">
          <Campo label="Data de início" type="date" value={form.dataInicio} onChange={v => set('dataInicio', v)} required />
          <Campo label="Previsão de abate" type="date" value={form.previsaoAbate} onChange={v => set('previsaoAbate', v)} required />
        </Secao>

        <Secao titulo="DADOS DO LOTE">
          <Campo label="Quantidade de bois" type="number" value={form.quantidadeBois} onChange={v => set('quantidadeBois', v)} placeholder="Ex: 120" required min="1" />
          <Campo label="Peso médio de entrada (kg)" type="number" value={form.pesoEntrada} onChange={v => set('pesoEntrada', v)} placeholder="Ex: 350" required min="1" />
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tratos por dia</label>
            <div className="flex gap-2">
              {['1', '2', '3'].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('numTratosDia', n)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition
                    ${form.numTratosDia === n
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        </Secao>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl transition disabled:opacity-60"
        >
          {carregando ? 'Salvando...' : 'Salvar e configurar dieta →'}
        </button>
      </form>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-green-700 mb-3 tracking-widest">{titulo}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text', required, min }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; min?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}
