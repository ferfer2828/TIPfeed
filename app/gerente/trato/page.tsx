'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getLotes, getDietaDiaByData, getTratosByFazendaData,
  salvarTrato, salvarLote, getLeituraCocho, salvarLeituraCocho,
} from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, Trato, DietaDia, LeituraCocho } from '@/types';

const COCHO_LABELS = ['Limpo', 'Pouca sobra', 'Média sobra', 'Muita sobra'];
const COCHO_CORES = ['text-green-600', 'text-yellow-600', 'text-orange-500', 'text-red-600'];

interface LoteInfo {
  lote: Lote;
  dietaHoje: DietaDia | null;
  tratosHoje: Trato[];
}

export default function TratoGerentePage() {
  const { usuario } = useAuth();
  const [lotesInfo, setLotesInfo] = useState<LoteInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalLote, setModalLote] = useState<LoteInfo | null>(null);
  const [modoOrdem, setModoOrdem] = useState(false);

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  async function carregar(tentativas = 3) {
    if (!usuario) return;
    setCarregando(true);
    for (let i = 0; i < tentativas; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, i * 1000));
        const lotes = await getLotes(usuario.fazendaId);
        const todosTratos = await getTratosByFazendaData(usuario.fazendaId, hoje);
        const infos = await Promise.all(
          lotes.map(async lote => {
            const dieta = await getDietaDiaByData(lote.id, hoje, lote.fazendaId);
            const tratos = todosTratos.filter(t => t.loteId === lote.id);
            return { lote, dietaHoje: dieta, tratosHoje: tratos };
          })
        );
        setLotesInfo(infos);
        setCarregando(false);
        return;
      } catch (e) {
        console.error(`Tentativa ${i + 1}:`, e);
      }
    }
    setCarregando(false);
  }

  useEffect(() => { if (usuario) carregar(); }, [usuario]);

  // Recarrega ao voltar para a tela
  useEffect(() => {
    const onFocus = () => carregar();
    const onVisibility = () => { if (document.visibilityState === 'visible') carregar(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [usuario]);

  async function moverOrdem(index: number, direcao: 'up' | 'down') {
    const lista = [...lotesInfo];
    const destIndex = direcao === 'up' ? index - 1 : index + 1;
    if (destIndex < 0 || destIndex >= lista.length) return;

    const ordemA = lista[index].lote.ordemDescarregamento;
    const ordemB = lista[destIndex].lote.ordemDescarregamento;

    lista[index] = { ...lista[index], lote: { ...lista[index].lote, ordemDescarregamento: ordemB } };
    lista[destIndex] = { ...lista[destIndex], lote: { ...lista[destIndex].lote, ordemDescarregamento: ordemA } };

    await Promise.all([salvarLote(lista[index].lote), salvarLote(lista[destIndex].lote)]);
    lista.sort((a, b) => a.lote.ordemDescarregamento - b.lote.ordemDescarregamento);
    setLotesInfo([...lista]);
  }

  const totalConcluidos = lotesInfo.filter(i => i.tratosHoje.length >= i.lote.numTratosDia).length;
  const totalPendentes = lotesInfo.length - totalConcluidos;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-200 text-sm capitalize">{dataFormatada}</p>
            <h1 className="text-white text-2xl font-extrabold mt-0.5">🌾 Trato do dia</h1>
          </div>
          <button
            onClick={() => setModoOrdem(!modoOrdem)}
            className={`text-xs font-bold px-3 py-2 rounded-xl mt-1 border transition
              ${modoOrdem ? 'bg-white text-green-700 border-white' : 'border-green-500 text-green-200'}`}
          >
            {modoOrdem ? '✓ Feito' : '⇅ Ordem'}
          </button>
        </div>

        {/* Resumo */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{totalConcluidos}</p>
            <p className="text-xs text-green-200">Concluídos</p>
          </div>
          <div className={`flex-1 rounded-xl p-3 text-center ${totalPendentes > 0 ? 'bg-orange-500' : 'bg-green-600'}`}>
            <p className="text-2xl font-extrabold text-white">{totalPendentes}</p>
            <p className="text-xs text-white/80">Pendentes</p>
          </div>
          <div className="flex-1 bg-green-600 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{lotesInfo.length}</p>
            <p className="text-xs text-green-200">Total</p>
          </div>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="px-4 py-4">
        {modoOrdem && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-blue-600 font-semibold">
              ⇅ Modo de ordenação — use as setas para reordenar os lotes. A ordem é salva automaticamente.
            </p>
          </div>
        )}

        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : lotesInfo.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🐄</p>
            <p className="text-gray-500 font-semibold">Nenhum lote ativo</p>
            <p className="text-gray-400 text-sm mt-2 mb-4">
              Se você acabou de cadastrar um lote, aguarde alguns segundos e recarregue.
            </p>
            <button
              onClick={() => carregar(4)}
              className="bg-green-700 text-white font-bold px-6 py-3 rounded-xl active:bg-green-800 text-sm"
            >
              🔄 Recarregar lotes
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lotesInfo.map(({ lote, dietaHoje, tratosHoje }, i) => {
              const concluido = tratosHoje.length >= lote.numTratosDia;
              const totalKgLancado = tratosHoje.reduce((s, t) => s + t.quantidadeEfetiva, 0);
              const progresso = Math.min(100, (tratosHoje.length / lote.numTratosDia) * 100);

              return (
                <div
                  key={lote.id}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4
                    ${concluido ? 'border-green-500' : 'border-orange-400'}`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            #{i + 1}
                          </span>
                          <p className="font-bold text-gray-800 truncate">{lote.nome}</p>
                        </div>
                        <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                      </div>

                      {modoOrdem ? (
                        /* Botões de reordenação */
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => moverOrdem(i, 'up')}
                            disabled={i === 0}
                            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl disabled:opacity-30 active:bg-gray-200"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 15l-6-6-6 6"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => moverOrdem(i, 'down')}
                            disabled={i === lotesInfo.length - 1}
                            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl disabled:opacity-30 active:bg-gray-200"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        /* Info da dieta */
                        <div className="text-right flex-shrink-0">
                          {dietaHoje ? (
                            <>
                              <p className="text-lg font-extrabold text-green-700">{dietaHoje.quantidadeRecomendada}kg</p>
                              <p className="text-xs text-gray-400">recomendado</p>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Sem dieta</span>
                          )}
                        </div>
                      )}
                    </div>

                    {!modoOrdem && (
                      <>
                        {/* Barra de progresso */}
                        <div className="mt-3 mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Tratos: {tratosHoje.length}/{lote.numTratosDia}</span>
                            {totalKgLancado > 0 && (
                              <span className="font-semibold text-green-700">{totalKgLancado}kg lançados</span>
                            )}
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${concluido ? 'bg-green-500' : 'bg-orange-400'}`}
                              style={{ width: `${progresso}%` }}
                            />
                          </div>
                        </div>

                        {/* Tratos registrados hoje */}
                        {tratosHoje.length > 0 && (
                          <div className="space-y-1 mb-3">
                            {tratosHoje.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
                              <div key={t.id} className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                                <span>Trato {t.numeroTrato} — {t.funcionarioNome}</span>
                                <span className="font-bold text-gray-700">{t.quantidadeEfetiva}kg</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Botão de ação */}
                        <button
                          onClick={() => setModalLote({ lote, dietaHoje, tratosHoje })}
                          className={`w-full font-bold py-3 rounded-xl text-sm active:opacity-80 transition
                            ${concluido
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-green-700 text-white'}`}
                        >
                          {concluido ? '✓ Ver / adicionar trato' : '🌾 Lançar trato'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal lançar trato */}
      {modalLote && usuario && (
        <ModalLancarTrato
          lote={modalLote.lote}
          tratosHoje={modalLote.tratosHoje}
          dietaHoje={modalLote.dietaHoje}
          usuario={usuario}
          onClose={() => setModalLote(null)}
          onSalvo={() => { setModalLote(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ─── Modal Lançar Trato ───────────────────────────────────────────────────────

function ModalLancarTrato({ lote, tratosHoje: tratosIniciais, dietaHoje, usuario, onClose, onSalvo }: {
  lote: Lote;
  tratosHoje: Trato[];
  dietaHoje: DietaDia | null;
  usuario: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const [tratos, setTratos] = useState<Trato[]>(tratosIniciais);
  const [fase, setFase] = useState<'trato' | 'cocho'>('trato');
  const [leituraCocho, setLeituraCocho] = useState<LeituraCocho | null>(null);

  const jaLancado = tratos.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const tratoNum = tratos.length + 1;
  const todosFeitos = tratos.length >= lote.numTratosDia;

  const sugestao = dietaHoje
    ? tratos.length === 0 && lote.numTratosDia > 1
      ? Math.ceil(dietaHoje.quantidadeRecomendada / lote.numTratosDia)
      : Math.max(0, dietaHoje.quantidadeRecomendada - jaLancado)
    : 0;

  const [quantidade, setQuantidade] = useState(sugestao > 0 ? String(sugestao) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Edição inline de trato existente
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');

  // Cocho
  const [cochoVal, setCochoVal] = useState('');
  const [salvandoCocho, setSalvandoCocho] = useState(false);
  const [tratoSalvoQtd, setTratoSalvoQtd] = useState(0);

  // Busca cocho existente ao montar
  useEffect(() => {
    getLeituraCocho(lote.id, hoje, lote.fazendaId)
      .then(lc => {
        setLeituraCocho(lc);
        if (lc !== null) setCochoVal(String(lc.valor));
      })
      .catch(() => {});
  }, []);

  async function salvarTratoModal() {
    const qtd = Math.ceil(Number(quantidade));
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade em kg.'); return; }
    if (todosFeitos) { setErro('Todos os tratos do dia já foram lançados.'); return; }
    setSalvando(true);
    try {
      const novoTrato: Trato = {
        id: `${lote.id}_${hoje}_${tratoNum}_${Date.now()}`,
        loteId: lote.id,
        fazendaId: lote.fazendaId,
        data: hoje,
        numeroTrato: tratoNum,
        quantidadeEfetiva: qtd,
        funcionarioId: usuario.uid,
        funcionarioNome: usuario.nome,
        criadoEm: new Date().toISOString(),
      };
      await salvarTrato(novoTrato);
      setTratos(prev => [...prev, novoTrato]);
      setTratoSalvoQtd(qtd);
      setFase('cocho');
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarEdicao(trato: Trato) {
    const qtd = Math.ceil(Number(editQtd));
    if (!qtd || qtd <= 0) { setErro('Informe uma quantidade válida.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const atualizado = { ...trato, quantidadeEfetiva: qtd };
      await salvarTrato(atualizado);
      setTratos(prev => prev.map(t => t.id === trato.id ? atualizado : t));
      setEditandoId(null);
    } catch {
      setErro('Erro ao editar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCochoModal(pular = false) {
    if (!pular) {
      const v = parseInt(cochoVal);
      if (isNaN(v) || v < 0 || v > 3) { setErro('Digite 0, 1, 2 ou 3.'); return; }
      setErro('');
      setSalvandoCocho(true);
      try {
        await salvarLeituraCocho({
          id: `${lote.id}_cocho_${hoje}`,
          loteId: lote.id,
          fazendaId: lote.fazendaId,
          data: hoje,
          valor: v as 0 | 1 | 2 | 3,
          funcionarioId: usuario.uid,
          funcionarioNome: usuario.nome,
          criadoEm: new Date().toISOString(),
        });
      } catch {
        setErro('Erro ao salvar cocho.');
        setSalvandoCocho(false);
        return;
      } finally {
        setSalvandoCocho(false);
      }
    }
    onSalvo();
  }

  const cochoNum = parseInt(cochoVal);
  const cochoValido = !isNaN(cochoNum) && cochoNum >= 0 && cochoNum <= 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg">

        {/* ── Fase: COCHO ───────────────────────────────────────────────────── */}
        {fase === 'cocho' ? (
          <>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-gray-800">📊 Leitura de cocho</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{lote.nome} · {lote.invernada}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 text-2xl p-1 leading-none">✕</button>
            </div>

            <div className="px-5 py-4">
              {/* Confirmação do trato */}
              <div className="bg-green-50 border border-green-300 rounded-2xl p-3 flex items-center gap-3 mb-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-bold text-green-700 text-sm">
                    Trato {tratos.length} lançado — {tratoSalvoQtd}kg
                  </p>
                  <p className="text-green-600 text-xs">Registre a leitura do cocho agora</p>
                </div>
              </div>

              <p className="text-sm font-bold text-gray-600 mb-1 text-center">Como está o cocho?</p>
              <p className="text-xs text-gray-400 text-center mb-3">
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
                <p className={`text-center font-bold text-sm mb-1 ${COCHO_CORES[cochoNum]}`}>
                  {cochoNum} – {COCHO_LABELS[cochoNum]}
                </p>
              )}

              {erro && <p className="text-red-500 text-sm text-center mt-1">{erro}</p>}
            </div>

            <div className="px-5 pb-6 space-y-2">
              <button
                onClick={() => salvarCochoModal(false)}
                disabled={!cochoValido || salvandoCocho}
                className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40 active:bg-green-800"
              >
                {salvandoCocho ? 'Salvando...' : '📊 Confirmar leitura'}
              </button>
              <button
                onClick={() => salvarCochoModal(true)}
                className="w-full text-gray-400 text-sm py-2"
              >
                Pular leitura de cocho
              </button>
            </div>
          </>
        ) : (
          /* ── Fase: TRATO ──────────────────────────────────────────────────── */
          <>
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">
                  {todosFeitos ? '✓ Tratos concluídos' : `🌾 Trato ${tratoNum} de ${lote.numTratosDia}`}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{lote.nome} · {lote.invernada}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 text-2xl p-1 leading-none">✕</button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {/* Resumo da dieta */}
              {dietaHoje && (
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400">Total do dia</p>
                    <p className="text-lg font-extrabold text-green-700">{dietaHoje.quantidadeRecomendada}kg</p>
                  </div>
                  {lote.numTratosDia > 1 && (
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">Por trato (~)</p>
                      <p className="text-lg font-extrabold text-blue-700">
                        {Math.ceil(dietaHoje.quantidadeRecomendada / lote.numTratosDia)}kg
                      </p>
                    </div>
                  )}
                  {jaLancado > 0 && (
                    <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">Já lançado</p>
                      <p className="text-lg font-extrabold text-gray-700">{jaLancado}kg</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tratos registrados com edição inline */}
              {tratos.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  <p className="text-xs font-bold text-gray-400">LANÇADOS HOJE</p>
                  {tratos.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
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
                            disabled={salvando}
                            className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:bg-green-700 disabled:opacity-60"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setEditandoId(null); setErro(''); }}
                            className="text-gray-400 text-xs px-2 py-1.5"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2 text-sm">
                          <span className="text-gray-500">Trato {t.numeroTrato} — {t.funcionarioNome}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700">{t.quantidadeEfetiva}kg</span>
                            <button
                              onClick={() => { setEditandoId(t.id); setEditQtd(String(t.quantidadeEfetiva)); setErro(''); }}
                              className="text-gray-300 active:text-gray-500 p-1"
                              title="Editar"
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
                </div>
              )}

              {!todosFeitos && (
                <>
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
                    autoFocus
                    className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-5xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50 mb-2"
                  />
                  <p className="text-xs text-center text-gray-400 mb-4">kg neste trato</p>

                  {dietaHoje && sugestao > 0 && (
                    <div className="flex gap-2 mb-4">
                      {lote.numTratosDia > 1 ? (
                        [
                          { label: '-10%', v: Math.ceil(sugestao * 0.9) },
                          { label: 'Sugerido', v: sugestao, destaque: true },
                          { label: '+10%', v: Math.ceil(sugestao * 1.1) },
                        ].map(({ label, v, destaque }) => (
                          <button
                            key={label}
                            onClick={() => setQuantidade(String(v))}
                            className={`flex-1 text-xs font-bold py-2.5 rounded-xl active:opacity-70 ${
                              destaque ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {label}
                            <br />
                            <span className={destaque ? 'text-green-600' : 'text-gray-400'}>{v}kg</span>
                          </button>
                        ))
                      ) : (
                        [0.8, 0.9, 1.0].map(f => {
                          const v = Math.ceil(dietaHoje.quantidadeRecomendada * f);
                          return (
                            <button
                              key={f}
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
                </>
              )}

              {erro && <p className="text-red-500 text-sm text-center mb-2">{erro}</p>}
            </div>

            <div className="px-5 pb-6">
              {todosFeitos ? (
                <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl">
                  Fechar
                </button>
              ) : (
                <button
                  onClick={salvarTratoModal}
                  disabled={salvando || !quantidade}
                  className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-60 active:bg-green-800"
                >
                  {salvando ? 'Salvando...' : '🌾 Confirmar trato'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
