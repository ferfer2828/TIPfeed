'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getLote, getLeituraCocho, salvarLeituraCocho } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, LeituraCocho } from '@/types';

const OPCOES = [
  {
    valor: 0 as 0 | 1 | 2 | 3,
    label: 'Limpo',
    desc: 'Cocho vazio, sem sobras',
    emoji: '✅',
    cor: 'border-green-500 bg-green-50 text-green-700',
    corSel: 'bg-green-600 text-white border-green-600',
  },
  {
    valor: 1 as 0 | 1 | 2 | 3,
    label: 'Pouco',
    desc: 'Poucas sobras no cocho',
    emoji: '🟡',
    cor: 'border-yellow-400 bg-yellow-50 text-yellow-700',
    corSel: 'bg-yellow-500 text-white border-yellow-500',
  },
  {
    valor: 2 as 0 | 1 | 2 | 3,
    label: 'Médio',
    desc: 'Quantidade média de sobras',
    emoji: '🟠',
    cor: 'border-orange-400 bg-orange-50 text-orange-700',
    corSel: 'bg-orange-500 text-white border-orange-500',
  },
  {
    valor: 3 as 0 | 1 | 2 | 3,
    label: 'Cheio',
    desc: 'Muito alimento sobrando',
    emoji: '🔴',
    cor: 'border-red-400 bg-red-50 text-red-700',
    corSel: 'bg-red-600 text-white border-red-600',
  },
];

export default function CochoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();

  const [lote, setLote] = useState<Lote | null>(null);
  const [leituraExistente, setLeituraExistente] = useState<LeituraCocho | null>(null);
  const [selecionado, setSelecionado] = useState<0 | 1 | 2 | 3 | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  const hoje = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!usuario) return;
    Promise.all([getLote(id), getLeituraCocho(id, hoje)]).then(([l, lc]) => {
      setLote(l);
      if (lc) {
        setLeituraExistente(lc);
        setSelecionado(lc.valor);
      }
    }).catch(e => console.error('Erro ao carregar cocho:', e))
      .finally(() => setCarregando(false));
  }, [id, hoje, usuario]);

  async function salvar() {
    if (!lote || !usuario || selecionado === null) return;
    setErro('');
    setSalvando(true);
    try {
      const leitura: LeituraCocho = {
        id: `${id}_cocho_${hoje}`,
        loteId: id,
        fazendaId: lote.fazendaId,
        data: hoje,
        valor: selecionado,
        funcionarioId: usuario.uid,
        funcionarioNome: usuario.nome,
        criadoEm: new Date().toISOString(),
      };
      await salvarLeituraCocho(leitura);
      setSalvo(true);
      setTimeout(() => router.replace('/peao'), 1500);
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-gray-400">Lote não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="text-green-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-white text-xl font-extrabold">Leitura de Cocho</h1>
            <p className="text-green-200 text-xs">{lote.nome} · {lote.invernada}</p>
          </div>
        </div>
        <p className="text-green-200 text-sm capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="px-4 py-5">
        {salvo ? (
          <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-green-700 font-bold text-lg">Leitura salva!</p>
            <p className="text-green-600 text-sm mt-1">Voltando...</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-600 mb-4 text-center">
              Como está o cocho agora?
            </p>

            {leituraExistente && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-blue-700 font-semibold">
                  ℹ️ Você já registrou hoje. Selecione outra opção para atualizar.
                </p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {OPCOES.map(op => {
                const sel = selecionado === op.valor;
                return (
                  <button
                    key={op.valor}
                    onClick={() => setSelecionado(op.valor)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition active:scale-[0.98] ${
                      sel ? op.corSel : op.cor
                    }`}
                  >
                    <span className="text-3xl">{op.emoji}</span>
                    <div className="text-left flex-1">
                      <p className="font-bold text-base">{op.label}</p>
                      <p className={`text-xs mt-0.5 ${sel ? 'text-white/80' : 'text-gray-500'}`}>
                        {op.desc}
                      </p>
                    </div>
                    {sel && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {erro && <p className="text-red-500 text-sm text-center mb-3">{erro}</p>}

            <button
              onClick={salvar}
              disabled={selecionado === null || salvando}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40 active:bg-green-800"
            >
              {salvando ? 'Salvando...' : '📊 Confirmar leitura'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
