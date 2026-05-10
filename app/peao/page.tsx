'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, getDietaDiaByData, getTratosByLoteData, getLeituraCocho } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { Lote } from '@/types';

interface LoteComStatus {
  lote: Lote;
  recomendacao: number;
  tratosFeitos: number;
  cochoRegistrado: boolean;
}

export default function PeaoHome() {
  const { usuario, signOut } = useAuth();
  const [lotesStatus, setLotesStatus] = useState<LoteComStatus[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  useEffect(() => {
    if (usuario) carregar();
  }, [usuario, hoje]);

  // Recarrega ao voltar para a tela após lançar trato ou cocho
  useEffect(() => {
    const onFocus = () => { if (usuario) carregar(); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && usuario) carregar(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [usuario]);

  async function carregar() {
    if (!usuario) return;
    setCarregando(true);
    try {
      const lotes = await getLotes(usuario.fazendaId);
      const status = await Promise.all(
        lotes.map(async lote => {
          const [dieta, tratos, cocho] = await Promise.all([
            getDietaDiaByData(lote.id, hoje),
            getTratosByLoteData(lote.id, hoje),
            getLeituraCocho(lote.id, hoje),
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

  const totalPendente = lotesStatus.filter(l => l.tratosFeitos < l.lote.numTratosDia).length;
  const totalConcluido = lotesStatus.filter(l => l.tratosFeitos >= l.lote.numTratosDia).length;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-200 text-sm capitalize">{dataFormatada}</p>
            <h1 className="text-white text-2xl font-extrabold mt-0.5">
              Olá, {usuario?.nome.split(' ')[0]} 👋
            </h1>
          </div>
          <button
            onClick={signOut}
            className="text-green-200 text-xs mt-1 border border-green-500 px-3 py-1.5 rounded-lg"
          >
            Sair
          </button>
        </div>

        {/* Resumo */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{totalPendente}</p>
            <p className="text-xs text-green-200">Pendentes</p>
          </div>
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{totalConcluido}</p>
            <p className="text-xs text-green-200">Concluídos</p>
          </div>
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{lotesStatus.length}</p>
            <p className="text-xs text-green-200">Total</p>
          </div>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="px-4 py-4">
        <p className="text-xs font-bold text-gray-500 mb-3">ORDEM DE DESCARREGAMENTO</p>

        {carregando ? (
          <div className="text-center py-10">
            <p className="text-gray-400">Carregando lotes...</p>
          </div>
        ) : lotesStatus.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🐄</p>
            <p className="text-gray-500 font-semibold">Nenhum lote ativo</p>
            <p className="text-gray-400 text-sm mt-1">Aguarde o gerente cadastrar lotes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lotesStatus.map(({ lote, recomendacao, tratosFeitos, cochoRegistrado }, i) => {
              const concluido = tratosFeitos >= lote.numTratosDia;
              const progresso = Math.min(100, (tratosFeitos / lote.numTratosDia) * 100);

              return (
                <div key={lote.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${
                  concluido ? 'border-green-500' : 'border-orange-400'
                }`}>
                  <div className="p-4">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                          <p className="font-bold text-gray-800">{lote.nome}</p>
                        </div>
                        <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                      </div>
                      <div className="text-right">
                        {recomendacao > 0 ? (
                          <>
                            <p className="text-lg font-extrabold text-green-700">{recomendacao}kg</p>
                            <p className="text-xs text-gray-400">recomendado hoje</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Sem dieta</p>
                        )}
                      </div>
                    </div>

                    {/* Progresso de tratos */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Tratos: {tratosFeitos}/{lote.numTratosDia}</span>
                        <span>{concluido ? '✓ Concluído' : 'Pendente'}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${concluido ? 'bg-green-500' : 'bg-orange-400'}`}
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Link href={`/peao/trato/${lote.id}`} className="flex-1">
                        <button
                          className={`w-full font-bold py-3 rounded-xl text-sm active:opacity-80 ${
                            concluido
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-green-700 text-white'
                          }`}
                        >
                          {concluido ? '✓ Trato feito' : '🌾 Lançar trato'}
                        </button>
                      </Link>
                      <Link href={`/peao/cocho/${lote.id}`}>
                        <button
                          className={`px-4 py-3 rounded-xl text-sm font-bold active:opacity-80 ${
                            cochoRegistrado
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cochoRegistrado ? '📊 ✓' : '📊 Cocho'}
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
