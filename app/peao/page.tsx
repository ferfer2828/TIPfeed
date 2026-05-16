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
  numTratos: number;
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
            numTratos: lote.numTratosDia,
            cochoRegistrado: cocho !== null,
          };
        })
      );
      setLotesStatus(status);
    } finally {
      setCarregando(false);
    }
  }

  const totalPendente = lotesStatus.filter(l => l.tratosFeitos < l.numTratos).length;
  const totalConcluido = lotesStatus.filter(l => l.tratosFeitos >= l.numTratos).length;
  const semCochoPendente = lotesStatus.filter(l => !l.cochoRegistrado).length;

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

        {/* Resumo do dia */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{totalPendente}</p>
            <p className="text-xs text-green-200">Pendentes</p>
          </div>
          <div className="bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{totalConcluido}</p>
            <p className="text-xs text-green-200">Concluídos</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${semCochoPendente > 0 ? 'bg-orange-500' : 'bg-green-600'}`}>
            <p className="text-2xl font-extrabold text-white">{semCochoPendente}</p>
            <p className="text-xs text-white/80">Sem cocho</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Botão de ação principal */}
        {totalPendente > 0 && (
          <Link href="/peao/trato">
            <div className="bg-green-700 rounded-2xl p-4 flex items-center justify-between active:bg-green-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🌾</div>
                <div>
                  <p className="text-white font-bold">Lançar tratos</p>
                  <p className="text-green-200 text-xs">{totalPendente} lote{totalPendente !== 1 ? 's' : ''} pendente{totalPendente !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" opacity="0.7">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Status dos lotes */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">STATUS DOS LOTES HOJE</p>
          {carregando ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : lotesStatus.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🐄</p>
              <p className="text-gray-500 font-semibold">Nenhum lote ativo</p>
              <p className="text-gray-400 text-sm mt-1">Aguarde o gerente cadastrar lotes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lotesStatus.map(({ lote, recomendacao, tratosFeitos, numTratos, cochoRegistrado }) => {
                const concluido = tratosFeitos >= numTratos;
                return (
                  <div key={lote.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${concluido ? 'border-green-500' : 'border-orange-400'}`}>
                    <div className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">{lote.nome}</p>
                        <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {recomendacao > 0 && (
                          <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-1 rounded-lg">{recomendacao}kg</span>
                        )}
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${concluido ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {tratosFeitos}/{numTratos}
                        </span>
                        {cochoRegistrado && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">📊✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Links rápidos */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/peao/historico">
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 active:bg-gray-50">
              <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">📋</div>
              <div>
                <p className="text-sm font-bold text-gray-700">Histórico</p>
                <p className="text-xs text-gray-400">Meus lançamentos</p>
              </div>
            </div>
          </Link>
          <Link href="/peao/insumos">
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 active:bg-gray-50">
              <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg">📦</div>
              <div>
                <p className="text-sm font-bold text-gray-700">Insumos</p>
                <p className="text-xs text-gray-400">Ver estoque</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
