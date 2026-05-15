'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getLote, getDietaDiaByData, getTratosByLoteData,
  salvarTrato, getLeituraCocho, salvarLeituraCocho,
} from '@/lib/firestore';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, DietaDia, Trato, LeituraCocho } from '@/types';

const COCHO_LABELS = ['Limpo', 'Pouca sobra', 'Média sobra', 'Muita sobra'];
const COCHO_CORES = ['text-green-600', 'text-yellow-600', 'text-orange-500', 'text-red-600'];

type Fase = 'trato' | 'cocho' | 'concluido';

export default function TratoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();

  const [lote, setLote] = useState<Lote | null>(null);
  const [dieta, setDieta] = useState<DietaDia | null>(null);
  const [tratosHoje, setTratosHoje] = useState<Trato[]>([]);
  const [leituraCocho, setLeituraCocho] = useState<LeituraCocho | null>(null);

  const [quantidade, setQuantidade] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregamentoLento, setCarregamentoLento] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [fase, setFase] = useState<Fase>('trato');
  const [cochoVal, setCochoVal] = useState('');
  const [salvandoCocho, setSalvandoCocho] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');

  const hoje = format(new Date(), 'yyyy-MM-dd');

  // Detecta mudança de conexão
  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!usuario) return;

    // Timeout: se demorar mais de 5s, mostra aviso de lentidão
    const lento = setTimeout(() => setCarregamentoLento(true), 5000);
    // Timeout máximo: 12s força saída do loading (não trava para sempre)
    const maxLoad = setTimeout(() => setCarregando(false), 12000);

    getLote(id).then(async l => {
      if (!l) { setCarregando(false); return; }
      const [d, t, lc] = await Promise.all([
        getDietaDiaByData(id, hoje, l.fazendaId),
        getTratosByLoteData(id, hoje, l.fazendaId),
        getLeituraCocho(id, hoje, l.fazendaId),
      ]);
      setLote(l);
      setDieta(d);
      setTratosHoje(t);
      setLeituraCocho(lc);
      if (lc !== null) setCochoVal(String(lc.valor));
      if (d && l) {
        const jaLancado = t.reduce((s, tr) => s + tr.quantidadeEfetiva, 0);
        const sugestao = t.length === 0 && l.numTratosDia > 1
          ? Math.ceil(d.quantidadeRecomendada / l.numTratosDia)
          : Math.max(0, d.quantidadeRecomendada - jaLancado);
        if (sugestao > 0) setQuantidade(String(sugestao));
      }
    }).catch(e => console.error('Erro ao carregar trato:', e))
      .finally(() => {
        clearTimeout(lento);
        clearTimeout(maxLoad);
        setCarregando(false);
      });

    return () => { clearTimeout(lento); clearTimeout(maxLoad); };
  }, [id, hoje, usuario]);

  // ─── Lançar trato (otimista — funciona offline) ───────────────────────────────

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!lote || !usuario) return;
    setErro('');
    const qtd = Math.ceil(Number(quantidade));
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade em kg.'); return; }

    const tratoNum = tratosHoje.length + 1;
    if (tratoNum > lote.numTratosDia) {
      setErro(`Todos os ${lote.numTratosDia} trato(s) do dia já foram lançados.`);
      return;
    }

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

    // Atualiza UI imediatamente — não bloqueia aguardando o servidor
    setTratosHoje(prev => [...prev, trato]);
    setFase('cocho');

    // Salva em background (com persistentLocalCache, já está salvo localmente)
    setSalvando(true);
    salvarTrato(trato)
      .catch(err => console.warn('Trato salvo no cache local, sincronizará quando houver conexão:', err))
      .finally(() => setSalvando(false));
  }

  // ─── Editar trato existente ───────────────────────────────────────────────────

  async function confirmarEdicao(trato: Trato) {
    const qtd = Math.ceil(Number(editQtd));
    if (!qtd || qtd <= 0) { setErro('Informe uma quantidade válida.'); return; }
    setErro('');
    const atualizado = { ...trato, quantidadeEfetiva: qtd };
    setTratosHoje(prev => prev.map(t => t.id === trato.id ? atualizado : t));
    setEditandoId(null);
    salvarTrato(atualizado).catch(err => console.warn('Edição salva localmente:', err));
  }

  // ─── Salvar cocho (otimista) ──────────────────────────────────────────────────

  async function salvarCocho(pular = false) {
    if (!lote || !usuario) return;
    if (!pular) {
      const v = parseInt(cochoVal);
      if (isNaN(v) || v < 0 || v > 3) { setErro('Digite 0, 1, 2 ou 3.'); return; }
      setErro('');
      const leitura: LeituraCocho = {
        id: `${id}_cocho_${hoje}`,
        loteId: id,
        fazendaId: lote.fazendaId,
        data: hoje,
        valor: v as 0 | 1 | 2 | 3,
        funcionarioId: usuario.uid,
        funcionarioNome: usuario.nome,
        criadoEm: new Date().toISOString(),
      };
      // Salva em background
      setSalvandoCocho(true);
      salvarLeituraCocho(leitura)
        .catch(err => console.warn('Cocho salvo localmente:', err))
        .finally(() => setSalvandoCocho(false));
    }
    setFase('concluido');
    setTimeout(() => router.replace('/peao'), 1200);
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4 px-6">
        {offline && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center mb-2">
            <p className="text-orange-700 font-bold text-sm">📶 Sem conexão</p>
            <p className="text-orange-600 text-xs mt-0.5">Usando dados em cache</p>
          </div>
        )}
        <p className="text-gray-400">Carregando...</p>
        {carregamentoLento && (
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-3">Demorando mais que o normal…</p>
            <button
              onClick={() => { setCarregando(false); }}
              className="bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Continuar offline
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4 px-6">
        {offline ? (
          <>
            <p className="text-4xl">📶</p>
            <p className="text-gray-600 font-bold">Sem conexão</p>
            <p className="text-gray-400 text-sm text-center">
              Os dados deste lote não estão em cache. Conecte-se e tente novamente.
            </p>
          </>
        ) : (
          <p className="text-gray-400">Lote não encontrado.</p>
        )}
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

  const qtdPorTrato = dieta
    ? tratoAtual === 1 && lote.numTratosDia > 1
      ? Math.ceil(dieta.quantidadeRecomendada / lote.numTratosDia)
      : Math.max(0, dieta.quantidadeRecomendada - jaLancado)
    : 0;

  // ─── Fase: concluido ──────────────────────────────────────────────────────────

  if (fase === 'concluido') {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 px-6">
        <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-10 text-center w-full max-w-sm">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-bold text-xl text-green-700">Tudo registrado!</p>
          {offline && <p className="text-xs text-orange-500 mt-1">Salvo offline · sincronizará em breve</p>}
          <p className="text-sm text-green-600 mt-2">Voltando...</p>
        </div>
      </div>
    );
  }

  // ─── Fase: cocho ─────────────────────────────────────────────────────────────

  if (fase === 'cocho') {
    const cochoNum = parseInt(cochoVal);
    const cochoValido = !isNaN(cochoNum) && cochoNum >= 0 && cochoNum <= 3;
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-green-700 px-4 pt-10 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">2</div>
            <h1 className="text-white text-xl font-extrabold">Leitura de cocho</h1>
          </div>
          <p className="text-green-200 text-sm ml-11">{lote.nome} · {lote.invernada}</p>
        </div>

        <div className="px-4 py-5 space-y-4">
          {offline && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-orange-700 font-semibold">📶 Offline — dados salvos localmente</p>
            </div>
          )}

          <div className="bg-green-50 border border-green-300 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-green-700 text-sm">
                Trato {tratosHoje.length} lançado — {tratosHoje[tratosHoje.length - 1]?.quantidadeEfetiva}kg
              </p>
              <p className="text-green-600 text-xs">Registre a leitura do cocho agora</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-600 mb-1 text-center">Como está o cocho?</p>
            <p className="text-xs text-gray-400 text-center mb-4">
              0 · Limpo &nbsp;|&nbsp; 1 · Pouca sobra &nbsp;|&nbsp; 2 · Média &nbsp;|&nbsp; 3 · Muita sobra
            </p>

            {leituraCocho !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3 text-center">
                <p className="text-xs text-blue-600 font-semibold">
                  ℹ️ Já registrado hoje: {leituraCocho.valor} – {COCHO_LABELS[leituraCocho.valor]}. Novo valor vai atualizar.
                </p>
              </div>
            )}

            <input
              type="number"
              inputMode="numeric"
              value={cochoVal}
              onChange={e => { setCochoVal(e.target.value); setErro(''); }}
              placeholder="0–3"
              min={0}
              max={3}
              autoFocus
              className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-6xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50 mb-2"
            />

            {cochoValido && (
              <p className={`text-center font-bold text-sm ${COCHO_CORES[cochoNum]}`}>
                {cochoNum} – {COCHO_LABELS[cochoNum]}
              </p>
            )}
          </div>

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

          <button
            onClick={() => salvarCocho(false)}
            disabled={!cochoValido || salvandoCocho}
            className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40 active:bg-green-800"
          >
            {salvandoCocho ? 'Salvando...' : '📊 Confirmar leitura'}
          </button>

          <button
            onClick={() => salvarCocho(true)}
            className="w-full text-gray-400 text-sm py-2"
          >
            Pular leitura de cocho
          </button>
        </div>
      </div>
    );
  }

  // ─── Fase: trato ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-gray-50">
      {/* Banner offline */}
      {offline && (
        <div className="bg-orange-500 px-4 py-2 text-center">
          <p className="text-white text-xs font-semibold">📶 Sem conexão — tratos serão sincronizados ao reconectar</p>
        </div>
      )}

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
        {/* Dieta */}
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
                    ~{Math.ceil(dieta.quantidadeRecomendada / lote.numTratosDia)}kg
                  </p>
                  <p className="text-xs text-gray-400">por trato ({lote.numTratosDia}x/dia)</p>
                </div>
              )}
            </div>

            {tratosHoje.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-xs font-bold text-gray-400">JÁ LANÇADOS HOJE</p>
                {tratosHoje.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
                  <div key={t.id}>
                    {editandoId === t.id ? (
                      <div className="flex items-center gap-2 bg-yellow-50 rounded-xl px-3 py-2">
                        <span className="text-xs text-gray-500 flex-shrink-0">Trato {t.numeroTrato}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editQtd}
                          onChange={e => setEditQtd(e.target.value)}
                          autoFocus
                          className="flex-1 border border-yellow-400 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        />
                        <span className="text-xs text-gray-400 flex-shrink-0">kg</span>
                        <button
                          onClick={() => confirmarEdicao(t)}
                          className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-green-700"
                        >✓</button>
                        <button
                          onClick={() => { setEditandoId(null); setErro(''); }}
                          className="text-gray-400 text-xs px-2 py-1.5"
                        >✕</button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-gray-500">Trato {t.numeroTrato}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-700">{t.quantidadeEfetiva}kg</span>
                          <button
                            onClick={() => { setEditandoId(t.id); setEditQtd(String(t.quantidadeEfetiva)); setErro(''); }}
                            className="text-gray-300 active:text-gray-500 p-1"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
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
              O gerente ainda não configurou a dieta. Informe a quantidade manualmente.
            </p>
          </div>
        )}

        {/* Formulário */}
        {todosFeitos ? (
          <div className="rounded-2xl p-8 text-center bg-green-50 border-2 border-green-300">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-bold text-xl text-green-700">Todos os tratos concluídos!</p>
            <p className="text-sm text-green-600 mt-2">{tratosHoje.length} trato(s) · {jaLancado}kg lançados hoje</p>
            <button
              onClick={() => router.replace('/peao')}
              className="mt-4 bg-green-700 text-white font-bold px-6 py-3 rounded-xl"
            >
              Voltar ao início
            </button>
          </div>
        ) : (
          <form onSubmit={lancar} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-gray-800">
                  🌾 Trato {tratoAtual}
                  {lote.numTratosDia > 1 && (
                    <span className="text-gray-400 font-normal"> de {lote.numTratosDia}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lote.numTratosDia === 1 ? 'Trato único do dia' : 'Informe a quantidade deste trato'}
                </p>
              </div>
            </div>

            <input
              type="number"
              inputMode="numeric"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              onBlur={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setQuantidade(String(Math.ceil(v)));
              }}
              placeholder="0"
              min="1"
              required
              autoFocus
              className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-5xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50 mb-2"
            />
            <p className="text-xs text-gray-400 text-center mb-4">kg lançados neste trato</p>

            {dieta && qtdPorTrato > 0 && (
              <div className="flex gap-2 mb-4">
                {lote.numTratosDia > 1 ? (
                  [
                    { label: '-10%', v: Math.ceil(qtdPorTrato * 0.9) },
                    { label: 'Sugerido', v: qtdPorTrato },
                    { label: '+10%', v: Math.ceil(qtdPorTrato * 1.1) },
                  ].map(({ label, v }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setQuantidade(String(v))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold active:bg-gray-200 ${
                        label === 'Sugerido' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {label}<br />
                      <span className={label === 'Sugerido' ? 'text-green-600' : 'text-gray-400'}>{v}kg</span>
                    </button>
                  ))
                ) : (
                  [0.8, 0.9, 1.0].map(f => {
                    const v = Math.ceil(dieta.quantidadeRecomendada * f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setQuantidade(String(v))}
                        className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2.5 rounded-xl active:bg-gray-200"
                      >
                        {Math.round(f * 100)}%<br />
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
