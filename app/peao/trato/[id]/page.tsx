'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getLote, getDietaDiaByData, getTratosByLoteData, salvarTrato } from '@/lib/firestore';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, DietaDia, Trato } from '@/types';

export default function TratoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();

  const [lote, setLote] = useState<Lote | null>(null);
  const [dieta, setDieta] = useState<DietaDia | null>(null);
  const [tratosHoje, setTratosHoje] = useState<Trato[]>([]);
  const [quantidade, setQuantidade] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  const hoje = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    Promise.all([
      getLote(id),
      getDietaDiaByData(id, hoje),
      getTratosByLoteData(id, hoje),
    ]).then(([l, d, t]) => {
      setLote(l);
      setDieta(d);
      setTratosHoje(t);
      // Sugerir quantidade restante
      if (d) {
        const jaLancado = t.reduce((s, tr) => s + tr.quantidadeEfetiva, 0);
        const restante = Math.max(0, d.quantidadeRecomendada - jaLancado);
        if (restante > 0) setQuantidade(String(restante));
      }
    }).finally(() => setCarregando(false));
  }, [id, hoje]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!lote || !usuario) return;
    setErro('');
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade.'); return; }

    const tratoNum = tratosHoje.length + 1;
    if (tratoNum > lote.numTratosDia) {
      setErro(`Todos os ${lote.numTratosDia} trato(s) do dia já foram lançados.`);
      return;
    }

    setSalvando(true);
    try {
      const trato: Trato = {
        id: `${id}_${hoje}_${tratoNum}_${Date.now()}`,
        loteId: id,
        fazendaId: lote.fazendaId,
        data: hoje,
        numeroTrato: tratoNum,
        quantidadeEfetiva: qtd,
        funcionarioId: usuario.uid,
        funcionarioNome: usuario.nome,
        criadoEm: new Date().toISOString(),
      };
      await salvarTrato(trato);
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

  const jaLancado = tratosHoje.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const tratoAtual = tratosHoje.length + 1;
  const todosFeitos = tratosHoje.length >= lote.numTratosDia;
  const diasConfinamento = differenceInDays(new Date(), new Date(lote.dataInicio)) + 1;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-green-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-white text-xl font-extrabold">{lote.nome}</h1>
            <p className="text-green-200 text-xs">{lote.invernada} · {lote.quantidadeBois} bois · Dia {diasConfinamento}</p>
          </div>
        </div>

        {/* Data */}
        <p className="text-green-200 text-sm capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="px-4 py-5">
        {/* Recomendação do dia */}
        {dieta && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2">RECOMENDAÇÃO DO DIA</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-extrabold text-green-700">{dieta.quantidadeRecomendada}kg</p>
                <p className="text-xs text-gray-400 mt-1">total recomendado</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-700">{jaLancado}kg lançados</p>
                <p className="text-xs text-gray-400">
                  {tratosHoje.length}/{lote.numTratosDia} tratos
                </p>
              </div>
            </div>

            {/* Tratos anteriores hoje */}
            {tratosHoje.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {tratosHoje.map(t => (
                  <div key={t.id} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500">Trato {t.numeroTrato}</span>
                    <span className="font-bold text-gray-700">{t.quantidadeEfetiva}kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formulário de lançamento */}
        {todosFeitos || salvo ? (
          <div className={`rounded-2xl p-6 text-center ${salvo ? 'bg-green-50 border-2 border-green-400' : 'bg-gray-100'}`}>
            <p className="text-4xl mb-3">{salvo ? '✅' : '🎉'}</p>
            <p className={`font-bold text-lg ${salvo ? 'text-green-700' : 'text-gray-700'}`}>
              {salvo ? 'Trato lançado!' : 'Todos os tratos concluídos!'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {salvo ? 'Voltando...' : `${tratosHoje.length} trato(s) lançado(s) hoje`}
            </p>
          </div>
        ) : (
          <form onSubmit={lancar} className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 mb-1">LANÇAR TRATO {tratoAtual}</p>
            <p className="text-sm text-gray-400 mb-4">
              {lote.numTratosDia > 1 ? `Trato ${tratoAtual} de ${lote.numTratosDia}` : 'Trato único do dia'}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Quantidade efetiva (kg)
              </label>
              <input
                type="number"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
                required
                autoFocus
                className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-4xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50"
              />
              {dieta && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Recomendação: {dieta.quantidadeRecomendada}kg total
                </p>
              )}
            </div>

            {/* Atalhos rápidos */}
            {dieta && (
              <div className="flex gap-2 mb-4">
                {[0.8, 0.9, 1.0].map(fator => {
                  const val = Math.round(dieta.quantidadeRecomendada * fator);
                  return (
                    <button
                      key={fator}
                      type="button"
                      onClick={() => setQuantidade(String(val))}
                      className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2.5 rounded-xl active:bg-gray-200"
                    >
                      {Math.round(fator * 100)}%
                      <br />
                      <span className="text-gray-400">{val}kg</span>
                    </button>
                  );
                })}
              </div>
            )}

            {erro && <p className="text-red-500 text-sm text-center mb-3">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-60 active:bg-green-800"
            >
              {salvando ? 'Lançando...' : '🌾 Confirmar trato'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
