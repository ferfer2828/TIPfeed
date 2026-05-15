'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, getTratosByFazendaData, getInsumos } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { Lote, Insumo, Trato } from '@/types';

export default function GerentePainel() {
  const { usuario, signOut } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = format(new Date(), 'yyyy-MM-dd');

  async function carregar() {
    if (!usuario) return;
    try {
      const [l, t, i] = await Promise.all([
        getLotes(usuario.fazendaId),
        getTratosByFazendaData(usuario.fazendaId, hoje),
        getInsumos(usuario.fazendaId),
      ]);
      setLotes(l);
      setTratos(t);
      setInsumos(i);
    } catch (e) {
      console.error('Erro ao carregar painel:', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
  }, [usuario]);

  // Recarrega ao voltar para a aba/página
  useEffect(() => {
    const onFocus = () => carregar();
    const onVisibility = () => { if (document.visibilityState === 'visible') carregar(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const alertas = insumos.filter(i => i.alertaAtivo);
  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

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
      </div>

      <div className="px-4 -mt-4">
        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <p className="text-3xl font-extrabold text-green-700">{lotes.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Lotes ativos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <p className="text-3xl font-extrabold text-blue-600">{tratos.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Tratos hoje</p>
          </div>
          <div className={`rounded-2xl shadow-sm p-3 text-center ${alertas.length > 0 ? 'bg-red-50' : 'bg-white'}`}>
            <p className={`text-3xl font-extrabold ${alertas.length > 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {alertas.length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Alertas</p>
          </div>
        </div>

        {/* Alertas de insumos */}
        {alertas.length > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold text-gray-700 mb-2">⚠️ Alertas de Insumos</h2>
            <div className="space-y-2">
              {alertas.map(a => (
                <div key={a.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="font-semibold text-red-700 text-sm">{a.nome}</p>
                  <p className="text-red-500 text-xs mt-0.5">{a.mensagemAlerta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lotes do dia */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-700">Lotes ativos</h2>
            <Link href="/gerente/lotes" className="text-xs text-green-700 font-semibold">Ver todos →</Link>
          </div>
          {carregando ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : lotes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">Nenhum lote ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lotes.map(lote => {
                const tratosLote = tratos.filter(t => t.loteId === lote.id);
                const diasConfinamento = Math.floor(
                  (new Date().getTime() - new Date(lote.dataInicio).getTime()) / (1000 * 60 * 60 * 24)
                );
                const totalKgHoje = tratosLote.reduce((s, t) => s + t.quantidadeEfetiva, 0);
                const trata = lote.trataDomingo ?? false;
                const kgBoiDia = totalKgHoje > 0 && lote.quantidadeBois > 0
                  ? trata
                    ? (totalKgHoje / lote.quantidadeBois).toFixed(1)
                    : ((totalKgHoje / lote.quantidadeBois / 7) * 6).toFixed(1)
                  : null;
                return (
                  <Link key={lote.id} href={`/gerente/lotes/${lote.id}`}>
                    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-gray-50">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{lote.nome}</p>
                        <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois · Dia {diasConfinamento + 1}</p>
                        {kgBoiDia && (
                          <p className="text-xs text-green-600 font-semibold mt-0.5">{kgBoiDia} kg/boi/dia</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          tratosLote.length >= lote.numTratosDia
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {tratosLote.length}/{lote.numTratosDia}
                        </span>
                        <span className="text-gray-300">›</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="flex gap-3 mb-6">
          <Link href="/gerente/lotes/novo" className="flex-1">
            <div className="bg-green-700 rounded-2xl p-4 flex items-center gap-3 active:bg-green-800">
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-lg flex-shrink-0">+</div>
              <div>
                <p className="text-white font-bold text-sm">Novo lote</p>
                <p className="text-green-200 text-xs">Cadastrar confinamento</p>
              </div>
            </div>
          </Link>
          <Link href="/gerente/relatorios" className="flex-1">
            <div className="bg-gray-700 rounded-2xl p-4 flex items-center gap-3 active:bg-gray-800">
              <div className="w-9 h-9 bg-gray-600 rounded-xl flex items-center justify-center text-lg flex-shrink-0">📊</div>
              <div>
                <p className="text-white font-bold text-sm">Relatórios</p>
                <p className="text-gray-300 text-xs">Exportar Excel</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
