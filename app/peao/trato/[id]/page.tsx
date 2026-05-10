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
    if (!usuario) return;
    Promise.all([
      getLote(id),
      getDietaDiaByData(id, hoje),
      getTratosByLoteData(id, hoje),
    ]).then(([l, d, t]) => {
      setLote(l);
      setDieta(d);
      setTratosHoje(t);
      if (d && l) {
        const jaLancado = t.reduce((s, tr) => s + tr.quantidadeEfetiva, 0);
        // Para primeiro trato de lote multi-trato: sugerir divisão por número de tratos
        const sugestao = t.length === 0 && l.numTratosDia > 1
          ? Math.round(d.quantidadeRecomendada / l.numTratosDia)
          : Math.max(0, d.quantidadeRecomendada - jaLancado);
        if (sugestao > 0) setQuantidade(String(sugestao));
      }
    }).catch(e => console.error('Erro ao carregar trato:', e))
      .finally(() => setCarregando(false));
  }, [id, hoje, usuario]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!lote || !usuario) return;
    setErro('');
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade em kg.'); return; }

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
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-400">Lote não encontrado.</p>
        <button onClick={() => router.back()} className="bg-green-700 text-white font-bold px-6 py-3 rounded-xl">
          Voltar
        </button>
      </div>
    );
  }

  const jaLancado = tratosHoje.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const tratoAtual = tratosHoje.length + 1;
  const todosFeitos = tratosHoje.length >= lote.numTratosDia;
  const diasConfinamento = differenceInDays(new Date(), new Date(lote.dataInicio)) + 1;

  // Sugestão por trato (para atalhos de %)
  const qtdPorTrato = dieta
    ? tratoAtual === 1 && lote.numTratosDia > 1
      ? Math.round(dieta.quantidadeRecomendada / lote.numTratosDia)
      : Math.max(0, dieta.quantidadeRecomendada - jaLancado)
    : 0;

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
          <div className="flex-1">
            <h1 className="text-white text-xl font-extrabold">{lote.nome}</h1>
            <p className="text-green-200 text-xs">{lote.invernada} · {lote.quantidadeBois} bois · Dia {diasConfinamento}</p>
          </div>
          {/* Badge de progresso do dia */}
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 ${
            todosFeitos ? 'bg-white text-green-700' : 'bg-green-600 text-white'
          }`}>
            {tratosHoje.length}/{lote.numTratosDia} tratos
          </div>
        </div>
        <p className="text-green-200 text-sm capitalize">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Recomendação do dia */}
        {dieta ? (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 mb-3">DIETA DO DIA</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-extrabold text-green-700">{dieta.quantidadeRecomendada}kg</p>
                <p className="text-xs text-gray-400 mt-0.5">total recomendado hoje</p>
              </div>
              {lote.numTratosDia > 1 && (
                <div className="text-right bg-green-50 rounded-xl px-3 py-2">
                  <p className="text-lg font-extrabold text-green-700">
                    ~{Math.round(dieta.quantidadeRecomendada / lote.numTratosDia)}kg
                  </p>
                  <p className="text-xs text-gray-400">por trato ({lote.numTratosDia}x/dia)</p>
                </div>
              )}
            </div>

            {/* Tratos já feitos hoje */}
            {tratosHoje.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-xs font-bold text-gray-400">JÁ LANÇADOS HOJE</p>
                {tratosHoje.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
                  <div key={t.id} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-500">Trato {t.numeroTrato}</span>
                    <span className="font-bold text-gray-700">{t.quantidadeEfetiva}kg</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-1 text-sm">
                  <span className="text-gray-400">Subtotal lançado</span>
                  <span className="font-bold text-green-700">{jaLancado}kg</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="font-bold text-yellow-700 text-sm">⚠️ Sem dieta configurada</p>
            <p className="text-yellow-600 text-xs mt-1">
              O gerente ainda não configurou a dieta para este lote. Informe a quantidade manualmente.
            </p>
          </div>
        )}

        {/* Formulário / status */}
        {todosFeitos || salvo ? (
          <div className={`rounded-2xl p-8 text-center ${salvo ? 'bg-green-50 border-2 border-green-400' : 'bg-green-50 border-2 border-green-300'}`}>
            <p className="text-5xl mb-3">{salvo ? '✅' : '🎉'}</p>
            <p className="font-bold text-xl text-green-700">
              {salvo ? 'Trato lançado!' : 'Todos os tratos concluídos!'}
            </p>
            <p className="text-sm text-green-600 mt-2">
              {salvo ? 'Voltando para a lista...' : `${tratosHoje.length} trato(s) · ${jaLancado}kg lançados hoje`}
            </p>
            {!salvo && (
              <button
                onClick={() => router.replace('/peao')}
                className="mt-4 bg-green-700 text-white font-bold px-6 py-3 rounded-xl"
              >
                Voltar ao início
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={lancar} className="bg-white rounded-2xl shadow-sm p-4">
            {/* Título do trato atual */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-gray-800">
                  🌾 Trato {tratoAtual}
                  {lote.numTratosDia > 1 && (
                    <span className="text-gray-400 font-normal"> de {lote.numTratosDia}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lote.numTratosDia === 1 ? 'Trato único do dia' : `Informe a quantidade deste trato`}
                </p>
              </div>
            </div>

            {/* Input grande */}
            <input
              type="number"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              placeholder="0"
              min="0"
              step="0.5"
              required
              autoFocus
              className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-5xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50 mb-2"
            />
            <p className="text-xs text-gray-400 text-center mb-4">kg lançados neste trato</p>

            {/* Atalhos de quantidade */}
            {dieta && qtdPorTrato > 0 && (
              <div className="flex gap-2 mb-4">
                {lote.numTratosDia > 1 ? (
                  // Multi-trato: atalhos baseados na divisão por trato
                  [
                    { label: '-10%', v: Math.round(qtdPorTrato * 0.9) },
                    { label: 'Sugerido', v: qtdPorTrato },
                    { label: '+10%', v: Math.round(qtdPorTrato * 1.1) },
                  ].map(({ label, v }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setQuantidade(String(v))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold active:bg-gray-200 ${
                        label === 'Sugerido' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {label}
                      <br />
                      <span className={label === 'Sugerido' ? 'text-green-600' : 'text-gray-400'}>{v}kg</span>
                    </button>
                  ))
                ) : (
                  // Trato único: atalhos baseados no total diário
                  [0.8, 0.9, 1.0].map(f => {
                    const v = Math.round(dieta.quantidadeRecomendada * f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setQuantidade(String(v))}
                        className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2.5 rounded-xl active:bg-gray-200"
                      >
                        {Math.round(f * 100)}%
                        <br />
                        <span className="text-gray-400">{v}kg</span>
                      </button>
                    );
                  })
                )}
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
