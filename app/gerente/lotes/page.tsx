'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, salvarLote, inativarLote } from '@/lib/firestore';
import Link from 'next/link';
import type { Lote } from '@/types';
import { format, differenceInDays } from 'date-fns';

export default function LotesPage() {
  const { usuario } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  async function carregar() {
    if (!usuario) return;
    const l = await getLotes(usuario.fazendaId);
    setLotes(l);
    setCarregando(false);
  }

  useEffect(() => { if (usuario) carregar(); }, [usuario]);

  async function moverOrdem(index: number, direcao: 'up' | 'down') {
    const novaLista = [...lotes];
    const destIndex = direcao === 'up' ? index - 1 : index + 1;
    if (destIndex < 0 || destIndex >= novaLista.length) return;
    // Trocar ordens
    const ordemA = novaLista[index].ordemDescarregamento;
    const ordemB = novaLista[destIndex].ordemDescarregamento;
    novaLista[index] = { ...novaLista[index], ordemDescarregamento: ordemB };
    novaLista[destIndex] = { ...novaLista[destIndex], ordemDescarregamento: ordemA };
    // Re-sort
    novaLista.sort((a, b) => a.ordemDescarregamento - b.ordemDescarregamento);
    setLotes(novaLista);
    await Promise.all([
      salvarLote(novaLista[index]),
      salvarLote(novaLista[destIndex]),
    ]);
  }

  async function encerrarLote(id: string) {
    await inativarLote(id);
    setConfirmandoId(null);
    carregar();
  }

  const hoje = new Date();

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Lotes</h1>
        <p className="text-green-200 text-xs mt-0.5">Ordem de descarregamento</p>
      </div>

      <div className="px-4 mt-4">
        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : lotes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">Nenhum lote ativo</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {lotes.map((lote, i) => {
              const diasConfinamento = differenceInDays(hoje, new Date(lote.dataInicio)) + 1;
              const diasRestantes = differenceInDays(new Date(lote.previsaoAbate), hoje);
              const totalDias = differenceInDays(new Date(lote.previsaoAbate), new Date(lote.dataInicio));
              const progresso = Math.min(100, Math.max(0, (diasConfinamento / totalDias) * 100));

              return (
                <div key={lote.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            #{i + 1}
                          </span>
                          <Link href={`/gerente/lotes/${lote.id}`}>
                            <span className="font-bold text-gray-800">{lote.nome}</span>
                          </Link>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {lote.invernada} · {lote.quantidadeBois} bois · {lote.pesoEntrada}kg
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Dia <span className="font-bold text-green-700">{diasConfinamento}</span> ·{' '}
                          {diasRestantes > 0 ? `${diasRestantes} dias p/ abate` : 'No prazo de abate'}
                        </p>
                      </div>

                      {/* Botões de ordem */}
                      <div className="flex flex-col gap-1 ml-3">
                        <button
                          onClick={() => moverOrdem(i, 'up')}
                          disabled={i === 0}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg disabled:opacity-30 active:bg-gray-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 15l-6-6-6 6"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => moverOrdem(i, 'down')}
                          disabled={i === lotes.length - 1}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg disabled:opacity-30 active:bg-gray-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{format(new Date(lote.dataInicio), 'dd/MM')}</span>
                        <span>{Math.round(progresso)}% concluído</span>
                        <span>{format(new Date(lote.previsaoAbate), 'dd/MM')}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 mt-3">
                      <Link href={`/gerente/lotes/${lote.id}`} className="flex-1">
                        <button className="w-full text-xs bg-green-50 text-green-700 font-semibold py-2 rounded-xl active:bg-green-100">
                          Ver histórico
                        </button>
                      </Link>
                      <Link href={`/gerente/lotes/${lote.id}/dieta`} className="flex-1">
                        <button className="w-full text-xs bg-blue-50 text-blue-700 font-semibold py-2 rounded-xl active:bg-blue-100">
                          Dieta
                        </button>
                      </Link>
                      <button
                        onClick={() => setConfirmandoId(lote.id)}
                        className="text-xs bg-red-50 text-red-600 font-semibold py-2 px-3 rounded-xl active:bg-red-100"
                      >
                        Encerrar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/gerente/lotes/novo">
          <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl active:bg-green-800 mb-6">
            + Novo lote
          </button>
        </Link>
      </div>

      {/* Modal de confirmação de encerramento */}
      {confirmandoId && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-2">Encerrar lote?</h3>
            <p className="text-gray-500 text-sm mb-6">O lote será marcado como inativo. Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmandoId(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => encerrarLote(confirmandoId)}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl"
              >
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
