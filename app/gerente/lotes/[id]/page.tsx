'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLote, getTratosByLote, getLeiturasCochoByLote, getDietaDias, getDietaDiaByData, getTratosByLoteData, salvarTrato, salvarLote } from '@/lib/firestore';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
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
  const [aba, setAba] = useState<'tratos' | 'cocho'>('tratos');
  const [modalTrato, setModalTrato] = useState(false);

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
          </div>
        )}
      </div>

      {/* Botão lançar trato */}
      <div className="px-4">
        <button
          onClick={() => setModalTrato(true)}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-2xl active:bg-green-800 flex items-center justify-center gap-2"
        >
          🌾 Lançar trato hoje
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{tratosHoje.length}/{lote.numTratosDia}</span>
        </button>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-200 mt-4">
        {(['tratos', 'cocho'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${aba === a ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
            {a === 'tratos' ? '🌾 Tratos' : '📊 Cocho'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {aba === 'tratos' ? (
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

      {/* Modal lançar trato */}
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
