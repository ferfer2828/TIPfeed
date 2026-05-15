'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLote, getTratosByLote, getLeiturasCochoByLote, getDietaDias, getDietaDiaByData, getTratosByLoteData, salvarTrato, salvarLote } from '@/lib/firestore';
import Link from 'next/link';
import { format, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, Trato, LeituraCocho, DietaDia } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const COCHO_LABELS = ['Limpo', 'Pouco', 'Médio', 'Cheio'];
const COCHO_COLORS = ['text-green-600 bg-green-50', 'text-yellow-600 bg-yellow-50', 'text-orange-600 bg-orange-50', 'text-red-600 bg-red-50'];

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useAuth();
  const [lote, setLote] = useState<Lote | null>(null);
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [leituras, setLeituras] = useState<LeituraCocho[]>([]);
  const [dietas, setDietas] = useState<DietaDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<'tratos' | 'cocho' | 'grafico'>('tratos');
  const [modalTrato, setModalTrato] = useState(false);
  const [modalRetroativo, setModalRetroativo] = useState(false);

  // Edição das informações do lote
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [editDataInicio, setEditDataInicio] = useState('');
  const [editPrevisaoAbate, setEditPrevisaoAbate] = useState('');
  const [editPesoEntrada, setEditPesoEntrada] = useState('');
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [erroInfo, setErroInfo] = useState('');

  const hoje = format(new Date(), 'yyyy-MM-dd');

  async function carregar() {
    if (!usuario) return;
    setCarregando(true);
    setErro('');
    try {
      const fid = usuario.fazendaId;
      const [l, t, lc, d] = await Promise.all([
        getLote(id), getTratosByLote(id, fid), getLeiturasCochoByLote(id, fid), getDietaDias(id, fid),
      ]);
      setLote(l); setTratos(t); setLeituras(lc); setDietas(d);
    } catch (e: any) {
      console.error('Erro ao carregar lote:', e);
      setErro(e?.message ?? 'Erro ao carregar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  // Aguarda o usuário estar autenticado antes de carregar
  useEffect(() => {
    if (usuario) carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, usuario]);

  function abrirEdicaoInfo() {
    if (!lote) return;
    setEditDataInicio(lote.dataInicio);
    setEditPrevisaoAbate(lote.previsaoAbate);
    setEditPesoEntrada(String(lote.pesoEntrada));
    setErroInfo('');
    setEditandoInfo(true);
  }

  async function salvarInfo() {
    if (!lote) return;
    const peso = Math.round(Number(editPesoEntrada));
    if (!editDataInicio || !editPrevisaoAbate || !peso || peso <= 0) {
      setErroInfo('Preencha todos os campos corretamente.');
      return;
    }
    if (editPrevisaoAbate <= editDataInicio) {
      setErroInfo('Data de saída deve ser posterior à data de entrada.');
      return;
    }
    setSalvandoInfo(true);
    setErroInfo('');
    try {
      await salvarLote({
        ...lote,
        dataInicio: editDataInicio,
        previsaoAbate: editPrevisaoAbate,
        pesoEntrada: peso,
        atualizadoEm: new Date().toISOString(),
      });
      setEditandoInfo(false);
      carregar();
    } catch {
      setErroInfo('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvandoInfo(false);
    }
  }

  if (carregando) return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <p className="text-gray-400">Carregando...</p>
    </div>
  );
  if (erro) return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4 px-8">
      <p className="text-red-500 text-sm text-center">Erro ao carregar lote.</p>
      <button onClick={carregar} className="bg-green-700 text-white font-bold px-6 py-3 rounded-xl">
        Tentar novamente
      </button>
    </div>
  );
  if (!lote) return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4 px-8">
      <p className="text-gray-400 text-sm text-center">Lote não encontrado.</p>
      <button onClick={() => router.back()} className="bg-green-700 text-white font-bold px-6 py-3 rounded-xl">
        Voltar
      </button>
    </div>
  );

  const hoje2 = new Date();
  const diasConfinamento = differenceInDays(hoje2, new Date(lote.dataInicio)) + 1;
  const diasRestantes = differenceInDays(new Date(lote.previsaoAbate), hoje2);
  const totalDias = differenceInDays(new Date(lote.previsaoAbate), new Date(lote.dataInicio));
  const progresso = Math.min(100, Math.max(0, (diasConfinamento / totalDias) * 100));
  const dietaHoje = dietas.find(d => d.data === hoje);
  const tratosPorData = tratos.reduce<Record<string, Trato[]>>((acc, t) => {
    if (!acc[t.data]) acc[t.data] = [];
    acc[t.data].push(t);
    return acc;
  }, {});
  const datas = Object.keys(tratosPorData).sort((a, b) => b.localeCompare(a));
  const tratosHoje = tratosPorData[hoje] ?? [];
  const totalKgHoje = tratosHoje.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const kgBoiDia = totalKgHoje > 0 && lote.quantidadeBois > 0
    ? ((totalKgHoje / lote.quantidadeBois / 7) * 6).toFixed(1)
    : null;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-green-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-extrabold">{lote.nome}</h1>
            <p className="text-green-200 text-xs">{lote.invernada} · {lote.quantidadeBois} bois</p>
          </div>
          <Link href={`/gerente/lotes/${id}/dieta`}>
            <button className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Dieta</button>
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center mb-3">
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-base font-extrabold">{diasConfinamento}</p>
            <p className="text-green-200 text-xs">Dias</p>
          </div>
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-base font-extrabold">{diasRestantes > 0 ? diasRestantes : 0}</p>
            <p className="text-green-200 text-xs">P/ abate</p>
          </div>
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-base font-extrabold">{dietaHoje ? `${dietaHoje.quantidadeRecomendada}kg` : '—'}</p>
            <p className="text-green-200 text-xs">Recomend.</p>
          </div>
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-base font-extrabold">{kgBoiDia ?? '—'}</p>
            <p className="text-green-200 text-xs">kg/b/dia</p>
          </div>
        </div>

        <div className="bg-green-600 rounded-xl p-3">
          <div className="flex justify-between text-xs text-green-200 mb-1.5">
            <span>{format(new Date(lote.dataInicio), 'dd/MM/yy')}</span>
            <span>{Math.round(progresso)}% concluído</span>
            <span>{format(new Date(lote.previsaoAbate), 'dd/MM/yy')}</span>
          </div>
          <div className="h-2 bg-green-500 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      </div>

      {/* Card de informações do lote */}
      <div className="px-4 pt-4">
        {editandoInfo ? (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <p className="text-xs font-bold text-gray-500 mb-3">EDITAR INFORMAÇÕES DO LOTE</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Data de entrada</label>
                <input
                  type="date"
                  value={editDataInicio}
                  onChange={e => setEditDataInicio(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Data prevista de saída</label>
                <input
                  type="date"
                  value={editPrevisaoAbate}
                  onChange={e => setEditPrevisaoAbate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Peso de entrada (kg)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editPesoEntrada}
                    onChange={e => setEditPesoEntrada(e.target.value)}
                    placeholder="450"
                    min="1"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-gray-400 text-sm">kg</span>
                </div>
              </div>
            </div>
            {erroInfo && <p className="text-red-500 text-xs mt-2">{erroInfo}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditandoInfo(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm active:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={salvarInfo}
                disabled={salvandoInfo}
                className="flex-1 bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 active:bg-green-800"
              >
                {salvandoInfo ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="flex justify-between items-center mb-2.5">
              <p className="text-xs font-bold text-gray-400">INFORMAÇÕES DO LOTE</p>
              <button
                onClick={abrirEdicaoInfo}
                className="flex items-center gap-1 text-green-700 text-xs font-semibold active:opacity-70"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <p className="text-xs text-gray-400">Data de entrada</p>
                <p className="font-semibold text-gray-700 text-sm">
                  {format(new Date(lote.dataInicio + 'T12:00:00'), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Prev. saída</p>
                <p className="font-semibold text-gray-700 text-sm">
                  {format(new Date(lote.previsaoAbate + 'T12:00:00'), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Peso de entrada</p>
                <p className="font-semibold text-gray-700 text-sm">{lote.pesoEntrada} kg</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Peso est. hoje</p>
                <p className="font-semibold text-green-700 text-sm">
                  {lote.pesoEntrada + (diasConfinamento - 1)} kg
                </p>
                <p className="text-xs text-gray-400">+1 kg/dia</p>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">Peso prev. no abate</p>
                <p className="text-xs text-gray-400">
                  {lote.pesoEntrada} kg + {totalDias} dias
                </p>
              </div>
              <p className="font-extrabold text-blue-700 text-lg">
                {lote.pesoEntrada + totalDias} kg
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botões de trato */}
      <div className="px-4 flex gap-2">
        <button
          onClick={() => setModalTrato(true)}
          className="flex-1 bg-green-700 text-white font-bold py-3.5 rounded-2xl active:bg-green-800 flex items-center justify-center gap-2"
        >
          🌾 Lançar trato hoje
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{tratosHoje.length}/{lote.numTratosDia}</span>
        </button>
        <button
          onClick={() => setModalRetroativo(true)}
          className="bg-white border border-gray-200 text-gray-600 font-bold py-3.5 px-4 rounded-2xl active:bg-gray-50 text-sm"
          title="Lançar trato de data anterior"
        >
          📝
        </button>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-200 mt-4">
        {([['tratos', '🌾 Tratos'], ['cocho', '📊 Cocho'], ['grafico', '📈 Gráfico']] as const).map(([a, label]) => (
          <button key={a} onClick={() => setAba(a)}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition ${aba === a ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {aba === 'grafico' ? (
          <GraficoTrato tratos={tratos} dietas={dietas} lote={lote} />
        ) : aba === 'tratos' ? (
          datas.length === 0 ? <p className="text-center text-gray-400 py-10">Nenhum trato registrado</p> : (
            <div className="space-y-4">
              {datas.map(data => {
                const ts = tratosPorData[data];
                const totalKg = ts.reduce((s, t) => s + t.quantidadeEfetiva, 0);
                const dietaDia = dietas.find(d => d.data === data);
                const diff = dietaDia ? totalKg - dietaDia.quantidadeRecomendada : null;
                const kgBD = lote.quantidadeBois > 0
                  ? ((totalKg / lote.quantidadeBois / 7) * 6).toFixed(1)
                  : null;
                return (
                  <div key={data} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <p className="font-bold text-gray-700 text-sm">
                        {format(new Date(data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="text-right">
                        <p className="font-bold text-green-700">{totalKg}kg</p>
                        {kgBD && (
                          <p className="text-xs text-green-600 font-semibold">{kgBD} kg/b/dia</p>
                        )}
                        {diff !== null && (
                          <p className={`text-xs ${diff >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                            {diff >= 0 ? '+' : ''}{diff}kg vs dieta
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {ts.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
                        <div key={t.id} className="flex justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <span>Trato {t.numeroTrato} — {t.funcionarioNome}</span>
                          <span className="font-semibold">{t.quantidadeEfetiva}kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          leituras.length === 0 ? <p className="text-center text-gray-400 py-10">Nenhuma leitura de cocho</p> : (
            <div className="space-y-2">
              {leituras.map(l => (
                <div key={l.id} className="bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-700 text-sm">
                      {format(new Date(l.data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{l.funcionarioNome}</p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${COCHO_COLORS[l.valor]}`}>
                    {COCHO_LABELS[l.valor]}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal lançar trato hoje */}
      {modalTrato && usuario && (
        <ModalLancarTrato
          lote={lote}
          tratosHoje={tratosHoje}
          dietaHoje={dietaHoje ?? null}
          usuario={usuario}
          onClose={() => setModalTrato(false)}
          onSalvo={() => { setModalTrato(false); carregar(); }}
        />
      )}

      {/* Modal lançar trato retroativo */}
      {modalRetroativo && usuario && (
        <ModalTratoRetroativo
          lote={lote}
          tratos={tratos}
          dietas={dietas}
          usuario={usuario}
          onClose={() => setModalRetroativo(false)}
          onSalvo={() => { setModalRetroativo(false); carregar(); }}
        />
      )}
    </div>
  );
}

// ─── Modal Lançar Trato ───────────────────────────────────────────────────────

function ModalLancarTrato({ lote, tratosHoje, dietaHoje, usuario, onClose, onSalvo }: {
  lote: Lote;
  tratosHoje: Trato[];
  dietaHoje: DietaDia | null;
  usuario: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const jaLancado = tratosHoje.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const tratoNum = tratosHoje.length + 1;
  const todosFeitos = tratosHoje.length >= lote.numTratosDia;

  const sugestao = dietaHoje ? Math.max(0, dietaHoje.quantidadeRecomendada - jaLancado) : 0;
  const [quantidade, setQuantidade] = useState(sugestao > 0 ? String(sugestao) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade.'); return; }
    if (todosFeitos) { setErro('Todos os tratos do dia já foram lançados.'); return; }
    setSalvando(true);
    try {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      await salvarTrato({
        id: `${lote.id}_${hoje}_${tratoNum}_${Date.now()}`,
        loteId: lote.id,
        fazendaId: lote.fazendaId,
        data: hoje,
        numeroTrato: tratoNum,
        quantidadeEfetiva: qtd,
        funcionarioId: usuario.uid,
        funcionarioNome: usuario.nome,
        criadoEm: new Date().toISOString(),
      });
      onSalvo();
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">
            {todosFeitos ? 'Tratos concluídos' : `Lançar Trato ${tratoNum}/${lote.numTratosDia}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 text-2xl p-1">✕</button>
        </div>

        <div className="px-5 py-4">
          {dietaHoje && (
            <div className="bg-green-50 rounded-xl p-3 mb-4 flex justify-between">
              <span className="text-sm text-gray-600">Recomendado hoje</span>
              <span className="font-bold text-green-700">{dietaHoje.quantidadeRecomendada}kg</span>
            </div>
          )}
          {tratosHoje.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {tratosHoje.map(t => (
                <div key={t.id} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-500">Trato {t.numeroTrato} — {t.funcionarioNome}</span>
                  <span className="font-bold">{t.quantidadeEfetiva}kg</span>
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
                className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-4xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50 mb-2"
              />
              <p className="text-xs text-center text-gray-400 mb-4">kg lançados neste trato</p>
              {dietaHoje && (
                <div className="flex gap-2 mb-4">
                  {[0.8, 0.9, 1.0].map(f => {
                    const v = Math.round(dietaHoje.quantidadeRecomendada * f);
                    return (
                      <button key={f} onClick={() => setQuantidade(String(v))}
                        className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2.5 rounded-xl active:bg-gray-200">
                        {Math.round(f * 100)}%<br /><span className="text-gray-400">{v}kg</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {erro && <p className="text-red-500 text-sm text-center mb-3">{erro}</p>}
            </>
          )}
        </div>

        <div className="px-5 pb-6">
          {todosFeitos ? (
            <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl">Fechar</button>
          ) : (
            <button onClick={salvar} disabled={salvando}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:bg-green-800">
              {salvando ? 'Salvando...' : '🌾 Confirmar trato'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal Trato Retroativo (wizard guiado por dia) ───────────────────────────

function ModalTratoRetroativo({ lote, tratos, dietas, usuario, onClose, onSalvo }: {
  lote: Lote;
  tratos: Trato[];
  dietas: DietaDia[];
  usuario: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const ontem = format(addDays(new Date(), -1), 'yyyy-MM-dd');

  // Calcula uma vez quais datas têm tratos faltando (do início até ontem)
  const pendingDates = useMemo(() => {
    const start = new Date(lote.dataInicio + 'T12:00:00');
    const end   = new Date(ontem + 'T12:00:00');
    if (end < start) return [];
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const n = tratos.filter(t => t.data === dateStr).length;
      if (n < lote.numTratosDia) days.push(dateStr);
    }
    return days;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentIdx, setCurrentIdx]   = useState(0);
  const [localTratos, setLocalTratos] = useState<Trato[]>([]);
  const [quantidade, setQuantidade]   = useState('');
  const [salvando, setSalvando]       = useState(false);
  const [erro, setErro]               = useState('');
  const [totalSalvos, setTotalSalvos] = useState(0);
  const [finalizado, setFinalizado]   = useState(false);

  // Tela: tudo em dia
  if (pendingDates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-6">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-bold text-gray-800 text-lg mb-1">Tudo em dia!</p>
          <p className="text-gray-400 text-sm mb-5">Não há tratos pendentes nos dias anteriores.</p>
          <button onClick={onClose} className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl">Fechar</button>
        </div>
      </div>
    );
  }

  // Tela: concluído
  if (finalizado) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-6">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-bold text-gray-800 text-lg mb-1">
            {totalSalvos} {totalSalvos === 1 ? 'trato salvo' : 'tratos salvos'}!
          </p>
          <p className="text-gray-400 text-sm mb-5">Histórico atualizado com sucesso.</p>
          <button onClick={onSalvo} className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl">Fechar</button>
        </div>
      </div>
    );
  }

  const currentDate      = pendingDates[currentIdx];
  const allTratosNaData  = [...tratos, ...localTratos]
    .filter(t => t.data === currentDate)
    .sort((a, b) => a.numeroTrato - b.numeroTrato);
  const totalJaLancado   = allTratosNaData.reduce((s, t) => s + t.quantidadeEfetiva, 0);
  const proximoNum       = allTratosNaData.length + 1;
  const diaCompleto      = allTratosNaData.length >= lote.numTratosDia;
  const dietaDia         = dietas.find(d => d.data === currentDate) ?? null;
  const isUltimoPendente = currentIdx === pendingDates.length - 1;
  const progresso        = Math.round((currentIdx / pendingDates.length) * 100);

  function avancar() {
    setQuantidade('');
    setErro('');
    if (isUltimoPendente) {
      if (totalSalvos > 0) setFinalizado(true);
      else onClose();
    } else {
      setCurrentIdx(i => i + 1);
    }
  }

  async function confirmar() {
    const qtd = Math.ceil(Number(quantidade));
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade em kg.'); return; }
    setSalvando(true);
    setErro('');

    const novoTrato: Trato = {
      id: `${lote.id}_${currentDate}_${proximoNum}_${Date.now()}`,
      loteId: lote.id,
      fazendaId: lote.fazendaId,
      data: currentDate,
      numeroTrato: proximoNum,
      quantidadeEfetiva: qtd,
      funcionarioId: usuario.uid,
      funcionarioNome: usuario.nome,
      criadoEm: new Date().toISOString(),
    };

    // Otimista: atualiza UI imediatamente
    setLocalTratos(prev => [...prev, novoTrato]);
    setTotalSalvos(s => s + 1);
    setQuantidade('');
    setSalvando(false);

    // Se dia ficou completo após este trato → avança automaticamente
    const novoTotal = allTratosNaData.length + 1;
    if (novoTotal >= lote.numTratosDia) {
      setTimeout(avancar, 300); // pequena pausa para o usuário ver o registro
    }

    // Salva em background
    salvarTrato(novoTrato).catch(e => console.error('Trato salvo localmente:', e));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[200]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">📝 Tratos passados</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {lote.nome} · {currentIdx + 1} de {pendingDates.length} dia{pendingDates.length !== 1 ? 's' : ''} pendente{pendingDates.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => { if (totalSalvos > 0) onSalvo(); else onClose(); }}
            className="text-gray-400 text-2xl p-1 leading-none"
          >✕</button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1.5 bg-gray-100 flex-shrink-0">
          <div className="h-full bg-green-500 transition-all duration-300 rounded-r-full" style={{ width: `${progresso}%` }} />
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* Data em destaque */}
          <div className="text-center pb-1">
            <p className="text-3xl font-extrabold text-gray-800">
              {format(new Date(currentDate + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(currentDate + 'T12:00:00'), 'yyyy')}
              {lote.numTratosDia > 1 && !diaCompleto && ` · Trato ${proximoNum} de ${lote.numTratosDia}`}
            </p>
          </div>

          {/* Tratos já salvos no dia */}
          {allTratosNaData.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-xs font-bold text-green-600 mb-2">✓ JÁ LANÇADOS NESTE DIA</p>
              <div className="space-y-1">
                {allTratosNaData.map(t => (
                  <div key={t.id} className="flex justify-between text-sm text-gray-700">
                    <span className="text-gray-500">Trato {t.numeroTrato}</span>
                    <span className="font-bold">{t.quantidadeEfetiva} kg</span>
                  </div>
                ))}
                {lote.numTratosDia > 1 && (
                  <div className="border-t border-green-200 mt-1.5 pt-1.5 flex justify-between text-xs">
                    <span className="text-gray-400">Total do dia</span>
                    <span className="font-bold text-green-700">{totalJaLancado} kg</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {diaCompleto ? (
            // Dia já completo — avança automaticamente (não deveria aparecer, mas como fallback)
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-semibold text-sm">
                ✓ Todos os {lote.numTratosDia} tratos deste dia já foram registrados
              </p>
            </div>
          ) : (
            <>
              {/* Chip da dieta */}
              {dietaDia && (
                <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm text-gray-500">Dieta prevista</span>
                  <span className="font-bold text-blue-700">{dietaDia.quantidadeRecomendada} kg</span>
                </div>
              )}

              {/* Input grande de quantidade */}
              <input
                type="number"
                inputMode="numeric"
                value={quantidade}
                onChange={e => { setQuantidade(e.target.value); setErro(''); }}
                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setQuantidade(String(Math.ceil(v))); }}
                placeholder="0"
                min="1"
                autoFocus
                className="w-full border-2 border-green-500 rounded-2xl px-4 py-5 text-5xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-4 focus:ring-green-200 bg-green-50"
              />
              <p className="text-xs text-center text-gray-400 -mt-2">kg neste trato</p>

              {/* Atalhos de % */}
              {dietaDia && (() => {
                const base = lote.numTratosDia > 1
                  ? Math.max(0, dietaDia.quantidadeRecomendada - totalJaLancado)
                  : dietaDia.quantidadeRecomendada;
                if (base <= 0) return null;
                return (
                  <div className="flex gap-2">
                    {[0.8, 0.9, 1.0].map(f => {
                      const v = Math.ceil(base * f);
                      return (
                        <button
                          key={f}
                          onClick={() => setQuantidade(String(v))}
                          className={`flex-1 text-xs font-bold py-2.5 rounded-xl active:opacity-70 ${
                            f === 1.0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {Math.round(f * 100)}%<br />
                          <span className="font-normal text-gray-400">{v} kg</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
        </div>

        {/* Rodapé */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 space-y-2">
          {!diaCompleto && (
            <button
              onClick={confirmar}
              disabled={salvando || !quantidade}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 active:bg-green-800"
            >
              {salvando ? 'Salvando...' : isUltimoPendente ? '✓ Confirmar e finalizar' : '✓ Confirmar →'}
            </button>
          )}
          <button
            onClick={avancar}
            className="w-full text-gray-400 text-sm py-2 active:text-gray-600"
          >
            {isUltimoPendente ? 'Pular e fechar' : 'Pular este dia →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gráfico Realizado × Previsto ─────────────────────────────────────────────

function GraficoTrato({ tratos, dietas, lote }: {
  tratos: Trato[];
  dietas: DietaDia[];
  lote: Lote;
}) {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  // Intervalo de datas: início do lote até hoje (máximo até previsão)
  const dataFim = hoje <= lote.previsaoAbate ? hoje : lote.previsaoAbate;
  const start = new Date(lote.dataInicio + 'T12:00:00');
  const end = new Date(dataFim + 'T12:00:00');
  const totalDias = differenceInDays(end, start) + 1;
  const MAX_DIAS = 45;
  const showDias = Math.min(totalDias, MAX_DIAS);
  const fromDate = showDias < totalDias ? addDays(end, -(showDias - 1)) : start;

  // Mapas para lookup rápido
  const dietaMap = new Map(dietas.map(d => [d.data, d.quantidadeRecomendada]));
  const tratosMap = new Map<string, number>();
  for (const t of tratos) {
    tratosMap.set(t.data, (tratosMap.get(t.data) ?? 0) + t.quantidadeEfetiva);
  }

  // Pontos do gráfico
  const pontos = Array.from({ length: showDias }, (_, i) => {
    const d = addDays(fromDate, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    return {
      date: dateStr,
      previsto: dietaMap.get(dateStr) ?? null as number | null,
      realizado: tratosMap.get(dateStr) ?? null as number | null,
    };
  });

  const allVals = pontos.flatMap(p => [p.previsto ?? 0, p.realizado ?? 0]).filter(v => v > 0);
  if (allVals.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="text-3xl mb-2">📈</p>
        <p className="text-gray-400 font-semibold">Nenhum dado registrado ainda</p>
        <p className="text-gray-400 text-sm mt-1">Lance tratos para ver o gráfico</p>
      </div>
    );
  }

  // Escala Y — arredonda para múltiplo "bonito"
  const rawMax = Math.max(...allVals);
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxY = Math.ceil((rawMax * 1.15) / (mag / 2)) * (mag / 2);

  // Dimensões SVG
  const W = 340, H = 180;
  const ML = 40, MR = 10, MT = 12, MB = 26;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const n = pontos.length;

  const toX = (i: number) => ML + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const toY = (v: number) => MT + (1 - v / maxY) * plotH;

  // Constrói path SVG para uma série (lacunas em null)
  function buildPath(key: 'previsto' | 'realizado') {
    let d = '';
    let started = false;
    for (let i = 0; i < pontos.length; i++) {
      const v = pontos[i][key];
      if (v === null) { started = false; continue; }
      const x = toX(i).toFixed(1), y = toY(v).toFixed(1);
      d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    }
    return d;
  }

  // Área preenchida sob a linha "realizado"
  function buildFill() {
    const pts = pontos
      .map((p, i) => p.realizado !== null ? { x: toX(i), y: toY(p.realizado) } : null)
      .filter((p): p is { x: number; y: number } => p !== null);
    if (pts.length < 2) return '';
    const base = toY(0).toFixed(1);
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
    return d;
  }

  // Rótulos eixo Y (3 valores)
  const yLabels = [0, maxY / 2, maxY].map(v => ({ val: v, y: toY(v) }));
  const fmtY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}t` : String(Math.round(v));

  // Rótulos eixo X (máx 3, sem repetição)
  const xIdxs = [...new Set([0, Math.round((n - 1) / 2), n - 1])];
  const xLabels = xIdxs.map(i => ({
    i, x: toX(i),
    label: format(new Date(pontos[i].date + 'T12:00:00'), 'dd/MM'),
  }));

  // Paths calculados uma vez
  const pathRealizado = buildPath('realizado');
  const pathPrevisto = buildPath('previsto');
  const fillRealizado = buildFill();

  // Estatísticas resumo
  const realizadoVals = pontos.filter(p => p.realizado !== null).map(p => p.realizado!);
  const previsoVals = pontos.filter(p => p.previsto !== null).map(p => p.previsto!);
  const mediaRealizado = realizadoVals.length
    ? Math.round(realizadoVals.reduce((a, b) => a + b, 0) / realizadoVals.length) : null;
  const mediaPrevisto = previsoVals.length
    ? Math.round(previsoVals.reduce((a, b) => a + b, 0) / previsoVals.length) : null;
  const aderencia = mediaRealizado && mediaPrevisto
    ? Math.round((mediaRealizado / mediaPrevisto) * 100) : null;
  const totalRealizado = realizadoVals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {/* Gráfico */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-gray-400 tracking-wide">KG/DIA — REALIZADO × PREVISTO</p>
          {showDias < totalDias && (
            <p className="text-xs text-gray-400">Últimos {showDias} dias</p>
          )}
        </div>

        {/* Legenda */}
        <div className="flex gap-5 mb-3">
          <div className="flex items-center gap-1.5">
            <svg width="20" height="8">
              <path d="M0 4 L20 4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-gray-500">Realizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="8">
              <path d="M0 4 L20 4" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            <span className="text-xs text-gray-500">Previsto (dieta)</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Linhas de grade + rótulos Y */}
          {yLabels.map(({ val, y }) => (
            <g key={val}>
              <line x1={ML} y1={y.toFixed(1)} x2={W - MR} y2={y.toFixed(1)}
                stroke={val === 0 ? '#e5e7eb' : '#f3f4f6'} strokeWidth="1" />
              <text x={ML - 4} y={(y + 3.5).toFixed(1)} textAnchor="end" fontSize="9" fill="#9ca3af">
                {fmtY(val)}
              </text>
            </g>
          ))}

          {/* Rótulos X */}
          {xLabels.map(({ i, x, label }) => (
            <text key={i} x={x.toFixed(1)} y={H - 5} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {label}
            </text>
          ))}

          {/* Área realizado */}
          {fillRealizado && (
            <path d={fillRealizado} fill="#16a34a" fillOpacity="0.08" />
          )}

          {/* Linha previsto (tracejada) */}
          {pathPrevisto && (
            <path d={pathPrevisto} fill="none" stroke="#3b82f6"
              strokeWidth="1.5" strokeDasharray="4 2" opacity="0.8" />
          )}

          {/* Linha realizado */}
          {pathRealizado && (
            <path d={pathRealizado} fill="none" stroke="#16a34a"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Pontos */}
          {pontos.map((p, i) => (
            <g key={p.date}>
              {p.previsto !== null && (
                <circle cx={toX(i).toFixed(1)} cy={toY(p.previsto).toFixed(1)}
                  r="2.5" fill="white" stroke="#3b82f6" strokeWidth="1.5" />
              )}
              {p.realizado !== null && (
                <circle cx={toX(i).toFixed(1)} cy={toY(p.realizado).toFixed(1)}
                  r="3.5" fill="#16a34a" />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400">Média realizado/dia</p>
          <p className="font-extrabold text-green-700 text-2xl mt-0.5">{mediaRealizado ?? '—'}</p>
          <p className="text-xs text-gray-400">kg</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400">Média previsto/dia</p>
          <p className="font-extrabold text-blue-600 text-2xl mt-0.5">{mediaPrevisto ?? '—'}</p>
          <p className="text-xs text-gray-400">kg</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <p className="text-xs text-gray-400">Total realizado</p>
          <p className="font-extrabold text-gray-800 text-2xl mt-0.5">
            {totalRealizado >= 1000 ? `${(totalRealizado / 1000).toFixed(1)}t` : `${totalRealizado}`}
          </p>
          <p className="text-xs text-gray-400">no período</p>
        </div>
        <div className={`rounded-2xl shadow-sm p-3 text-center ${
          aderencia === null ? 'bg-white' :
          aderencia >= 90 ? 'bg-green-50' :
          aderencia >= 70 ? 'bg-yellow-50' : 'bg-red-50'
        }`}>
          <p className="text-xs text-gray-400">Aderência à dieta</p>
          <p className={`font-extrabold text-2xl mt-0.5 ${
            aderencia === null ? 'text-gray-400' :
            aderencia >= 90 ? 'text-green-700' :
            aderencia >= 70 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {aderencia !== null ? `${aderencia}%` : '—'}
          </p>
          <p className="text-xs text-gray-400">
            {aderencia !== null ? (aderencia >= 90 ? 'Ótimo' : aderencia >= 70 ? 'Regular' : 'Abaixo') : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
