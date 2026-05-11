'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, getDietaDiaByData, getTratosByLoteData, getLeituraCocho } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { Lote } from '@/types';

interface LoteStatus {
  lote: Lote;
  recomendacao: number;
  tratosFeitos: number;
  cochoRegistrado: boolean;
}

export default function PeaoTratoPage() {
  const { usuario } = useAuth();
  const [lotesStatus, setLotesStatus] = useState<LoteStatus[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  async function carregar() {
    if (!usuario) return;
    setCarregando(true);
    try {
      const lotes = await getLotes(usuario.fazendaId);
      const status = await Promise.all(
        lotes.map(async lote => {
          const [dieta, tratos, cocho] = await Promise.all([
            getDietaDiaByData(lote.id, hoje, lote.fazendaId),
            getTratosByLoteData(lote.id, hoje, lote.fazendaId),
            getLeituraCocho(lote.id, hoje, lote.fazendaId),
          ]);
          return {
            lote,
            recomendacao: dieta?.quantidadeRecomendada ?? 0,
            tratosFeitos: tratos.length,
            cochoRegistrado: cocho !== null,
          };
        })
      );
      setLotesStatus(status);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
  }, [usuario]);

  useEffect(() => {
    const onFocus = () => { if (usuario) carregar(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && usuario) carregar();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const pendentes = lotesStatus.filter(l => l.tratosFeitos < l.lote.numTratosDia);
  const concluidos = lotesStatus.filter(l => l.tratosFeitos >= l.lote.numTratosDia);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <p className="text-green-200 text-sm capitalize">{dataFormatada}</p>
        <h1 className="text-white text-2xl font-extrabold mt-0.5">Tratos do dia</h1>

        {/* Resumo */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{pendentes.length}</p>
            <p className="text-xs text-green-200">Pendentes</p>
          </div>
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{concluidos.length}</p>
            <p className="text-xs text-green-200">Concluídos</p>
          </div>
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{lotesStatus.length}</p>
            <p className="text-xs text-green-200">Total</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {carregando ? (
          <div className="text-center py-14">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Carregando lotes...</p>
          </div>
        ) : lotesStatus.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">🐄</p>
            <p className="text-gray-500 font-semibold">Nenhum lote ativo</p>
            <p className="text-gray-400 text-sm mt-1">Aguarde o gerente cadastrar lotes.</p>
          </div>
        ) : (
          <>
            {/* Pendentes */}
            {pendentes.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">PENDENTES</p>
                <div className="space-y-3">
                  {pendentes.map(({ lote, recomendacao, tratosFeitos, cochoRegistrado }) => {
                    const progresso = Math.min(100, (tratosFeitos / lote.numTratosDia) * 100);
                    return (
                      <div key={lote.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-orange-400">
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold text-gray-800">{lote.nome}</p>
                              <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                            </div>
                            {recomendacao > 0 ? (
                              <div className="text-right">
                                <p className="text-lg font-extrabold text-green-700">{recomendacao}kg</p>
                                <p className="text-xs text-gray-400">recomendado</p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Sem dieta</span>
                            )}
                          </div>

                          {/* Progresso */}
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Tratos: {tratosFeitos}/{lote.numTratosDia}</span>
                              <span className="text-orange-500 font-semibold">Pendente</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full transition-all"
                                style={{ width: `${progresso}%` }}
                              />
                            </div>
                          </div>

                          {/* Botões */}
                          <div className="flex gap-2">
                            <Link href={`/peao/trato/${lote.id}`} className="flex-1">
                              <button className="w-full bg-green-700 text-white font-bold py-3 rounded-xl text-sm active:bg-green-800">
                                🌾 Lançar trato
                              </button>
                            </Link>
                            <Link href={`/peao/cocho/${lote.id}`}>
                              <button className={`px-4 py-3 rounded-xl text-sm font-bold active:opacity-80 ${
                                cochoRegistrado ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {cochoRegistrado ? '📊 ✓' : '📊 Cocho'}
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Concluídos */}
            {concluidos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">CONCLUÍDOS</p>
                <div className="space-y-2">
                  {concluidos.map(({ lote, tratosFeitos, cochoRegistrado }) => (
                    <div key={lote.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-green-500">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{lote.nome}</p>
                            <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                              ✓ {tratosFeitos}/{lote.numTratosDia}
                            </span>
                            <Link href={`/peao/cocho/${lote.id}`}>
                              <button className={`text-xs font-bold px-3 py-1.5 rounded-xl active:opacity-80 ${
                                cochoRegistrado ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {cochoRegistrado ? '📊 ✓' : '📊 Cocho'}
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
