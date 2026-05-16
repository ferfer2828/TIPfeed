'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, salvarLote, inativarLote, getLotesInativos, getTratosByLote, getDietaFazenda } from '@/lib/firestore';
import Link from 'next/link';
import type { Lote } from '@/types';
import { format, differenceInDays, addDays } from 'date-fns';

export default function LotesPage() {
  const { usuario } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoLote, setEditandoLote] = useState<Lote | null>(null);
  const [loteParaEncerrar, setLoteParaEncerrar] = useState<Lote | null>(null);

  const [abaLotes, setAbaLotes] = useState<'ativos' | 'arquivo'>('ativos');
  const [lotesInativos, setLotesInativos] = useState<Lote[]>([]);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);

  async function carregar(tentativas = 3) {
    if (!usuario) return;
    setCarregando(true);
    for (let i = 0; i < tentativas; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, i * 1000));
        const l = await getLotes(usuario.fazendaId);
        setLotes(l);
        setCarregando(false);
        return;
      } catch (e) {
        console.error(`Tentativa ${i + 1}:`, e);
      }
    }
    setCarregando(false);
  }

  async function carregarArquivo() {
    if (!usuario) return;
    setCarregandoArquivo(true);
    try {
      const l = await getLotesInativos(usuario.fazendaId);
      setLotesInativos(l);
    } finally {
      setCarregandoArquivo(false);
    }
  }

  useEffect(() => { if (usuario) carregar(); }, [usuario]);

  async function moverOrdem(index: number, direcao: 'up' | 'down') {
    const novaLista = [...lotes];
    const destIndex = direcao === 'up' ? index - 1 : index + 1;
    if (destIndex < 0 || destIndex >= novaLista.length) return;
    const ordemA = novaLista[index].ordemDescarregamento;
    const ordemB = novaLista[destIndex].ordemDescarregamento;
    novaLista[index] = { ...novaLista[index], ordemDescarregamento: ordemB };
    novaLista[destIndex] = { ...novaLista[destIndex], ordemDescarregamento: ordemA };
    novaLista.sort((a, b) => a.ordemDescarregamento - b.ordemDescarregamento);
    setLotes(novaLista);
    await Promise.all([salvarLote(novaLista[index]), salvarLote(novaLista[destIndex])]);
  }

  async function encerrarLote(id: string) {
    await inativarLote(id);
    setLoteParaEncerrar(null);
    carregar();
  }

  function atualizarLoteLocal(loteAtualizado: Lote) {
    setLotes(prev => prev.map(l => l.id === loteAtualizado.id ? loteAtualizado : l));
  }

  const hoje = new Date();

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Lotes</h1>
        <p className="text-green-200 text-xs mt-0.5">Ordem de descarregamento</p>
      </div>

      {/* Abas Ativos / Arquivo */}
      <div className="flex bg-white border-b border-gray-100">
        <button onClick={() => setAbaLotes('ativos')}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${abaLotes === 'ativos' ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
          🐄 Ativos ({lotes.length})
        </button>
        <button onClick={() => { setAbaLotes('arquivo'); if (lotesInativos.length === 0) carregarArquivo(); }}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${abaLotes === 'arquivo' ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
          📁 Arquivo
        </button>
      </div>

      <div className="px-4 mt-4">
        {abaLotes === 'arquivo' ? (
          carregandoArquivo ? (
            <p className="text-center text-gray-400 py-10">Carregando...</p>
          ) : lotesInativos.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-gray-500 font-semibold">Nenhum lote encerrado</p>
              <p className="text-gray-400 text-sm mt-1">Lotes encerrados aparecem aqui.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {lotesInativos.map(lote => {
                const diasConf = differenceInDays(new Date(lote.atualizadoEm.slice(0, 10)), new Date(lote.dataInicio)) + 1;
                return (
                  <div key={lote.id} className="bg-white rounded-2xl shadow-sm p-4 opacity-75">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-700">{lote.nome}</p>
                        <p className="text-xs text-gray-400">{lote.invernada} · {lote.quantidadeBois} bois</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {format(new Date(lote.dataInicio + 'T12:00:00'), 'dd/MM/yy')} →{' '}
                          {format(new Date(lote.atualizadoEm), 'dd/MM/yy')} · {diasConf} dias
                        </p>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold flex-shrink-0">Encerrado</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400">Entrada</p>
                        <p className="text-sm font-bold text-gray-700">{lote.pesoEntrada}kg</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400">Est. saída</p>
                        <p className="text-sm font-bold text-gray-700">{lote.pesoEntrada + diasConf}kg</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400">Tratos/dia</p>
                        <p className="text-sm font-bold text-gray-700">{lote.numTratosDia}x</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : lotes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">🐄</p>
            <p className="text-gray-500 font-semibold mb-2">Nenhum lote ativo</p>
            <p className="text-gray-400 text-sm mb-4">Se acabou de cadastrar, aguarde e recarregue.</p>
            <button
              onClick={() => carregar(4)}
              className="bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm active:bg-green-800"
            >
              🔄 Recarregar
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {lotes.map((lote, i) => {
              const diasConfinamento = differenceInDays(hoje, new Date(lote.dataInicio)) + 1;
              const diasRestantes = differenceInDays(new Date(lote.previsaoAbate), hoje);
              const totalDias = differenceInDays(new Date(lote.previsaoAbate), new Date(lote.dataInicio));
              const progresso = Math.min(100, Math.max(0, (diasConfinamento / totalDias) * 100));

              return (
                <div key={lote.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            #{i + 1}
                          </span>
                          <Link href={`/gerente/lotes/${lote.id}`}>
                            <span className="font-bold text-gray-800">{lote.nome}</span>
                          </Link>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {lote.invernada} · {lote.quantidadeBois} bois · {lote.pesoEntrada}kg entrada
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Dia <span className="font-bold text-green-700">{diasConfinamento}</span> ·{' '}
                          {diasRestantes > 0 ? `${diasRestantes} dias p/ abate` : 'No prazo de abate'}{' '}
                          · {lote.numTratosDia}x/dia
                        </p>
                      </div>

                      {/* Botões de ordem */}
                      <div className="flex flex-col gap-1 ml-3">
                        <button
                          onClick={() => moverOrdem(i, 'up')}
                          disabled={i === 0}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg disabled:opacity-30 active:bg-gray-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 15l-6-6-6 6"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => moverOrdem(i, 'down')}
                          disabled={i === lotes.length - 1}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg disabled:opacity-30 active:bg-gray-200"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{format(new Date(lote.dataInicio), 'dd/MM')}</span>
                        <span>{Math.round(progresso)}% concluído</span>
                        <span>{format(new Date(lote.previsaoAbate), 'dd/MM')}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 mt-3">
                      <Link href={`/gerente/lotes/${lote.id}`} className="flex-1">
                        <button className="w-full text-xs bg-green-50 text-green-700 font-semibold py-2 rounded-xl active:bg-green-100">
                          Histórico
                        </button>
                      </Link>
                      <Link href={`/gerente/lotes/${lote.id}/dieta`} className="flex-1">
                        <button className="w-full text-xs bg-blue-50 text-blue-700 font-semibold py-2 rounded-xl active:bg-blue-100">
                          Dieta
                        </button>
                      </Link>
                      <button
                        onClick={() => setEditandoLote(lote)}
                        className="text-xs bg-gray-50 text-gray-700 font-semibold py-2 px-3 rounded-xl active:bg-gray-100"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => setLoteParaEncerrar(lote)}
                        className="text-xs bg-red-50 text-red-600 font-semibold py-2 px-3 rounded-xl active:bg-red-100"
                      >
                        Encerrar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {abaLotes === 'ativos' && (
          <Link href="/gerente/lotes/novo">
            <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl active:bg-green-800 mb-6">
              + Novo lote
            </button>
          </Link>
        )}
      </div>

      {/* Modal Editar Lote */}
      {editandoLote && (
        <ModalEditarLote
          lote={editandoLote}
          onClose={() => setEditandoLote(null)}
          onSalvo={(loteAtualizado) => {
            atualizarLoteLocal(loteAtualizado);
            setEditandoLote(null);
          }}
        />
      )}

      {/* Modal de encerramento enriquecido */}
      {loteParaEncerrar && usuario && (
        <ModalEncerrarLote
          lote={loteParaEncerrar}
          fazendaId={usuario.fazendaId}
          onEncerrar={encerrarLote}
          onClose={() => setLoteParaEncerrar(null)}
        />
      )}
    </div>
  );
}

// ─── Modal Encerrar Lote ───────────────────────────────────────────────────────

function ModalEncerrarLote({ lote, fazendaId, onEncerrar, onClose }: {
  lote: Lote;
  fazendaId: string;
  onEncerrar: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [encerrando, setEncerrando] = useState(false);
  const [totalKg, setTotalKg] = useState(0);
  const [custoTotal, setCustoTotal] = useState<number | null>(null);

  const diasConfinamento = differenceInDays(new Date(), new Date(lote.dataInicio)) + 1;
  const pesoEstimadoSaida = lote.pesoEntrada + diasConfinamento;
  const kgGanho = (pesoEstimadoSaida - lote.pesoEntrada) * lote.quantidadeBois;
  const arrobas = kgGanho / 15;

  useEffect(() => {
    async function carregar() {
      try {
        const [tratos, dietaFaz] = await Promise.all([
          getTratosByLote(lote.id, fazendaId),
          getDietaFazenda(fazendaId),
        ]);
        const total = tratos.reduce((s, t) => s + t.quantidadeEfetiva, 0);
        setTotalKg(total);
        if (dietaFaz && dietaFaz.composicao.length > 0) {
          const custoKg = dietaFaz.composicao.reduce((s, c) => s + c.precoKg * c.percentual / 100, 0);
          setCustoTotal(total * custoKg);
        }
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar() {
    setEncerrando(true);
    await onEncerrar(lote.id);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-lg">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">🏁 Encerrar lote</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl p-1 leading-none">✕</button>
        </div>

        <div className="px-5 py-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
            <p className="font-bold text-orange-700">{lote.nome}</p>
            <p className="text-xs text-orange-600">{lote.invernada} · {lote.quantidadeBois} bois</p>
          </div>

          {carregando ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Calculando resumo...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Dias de confinamento</p>
                <p className="text-xl font-extrabold text-gray-800">{diasConfinamento}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Total consumido</p>
                <p className="text-xl font-extrabold text-gray-800">
                  {totalKg >= 1000 ? `${(totalKg / 1000).toFixed(1)}t` : `${totalKg}kg`}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Peso est. saída</p>
                <p className="text-xl font-extrabold text-green-700">{pesoEstimadoSaida}kg/boi</p>
                <p className="text-xs text-gray-400">≈ {(pesoEstimadoSaida / 15).toFixed(1)}@</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${custoTotal ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-400">Custo total est.</p>
                <p className="text-xl font-extrabold text-blue-700">
                  {custoTotal
                    ? `R$ ${custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '—'}
                </p>
                {custoTotal && arrobas > 0 && (
                  <p className="text-xs text-gray-400">R$ {(custoTotal / arrobas).toFixed(0)}/@</p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mb-4">
            ⚠️ Esta ação não pode ser desfeita. O lote ficará no histórico.
          </p>
        </div>

        <div className="px-5 pb-6 flex gap-3">
          <button onClick={onClose} disabled={encerrando}
            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={carregando || encerrando}
            className="flex-1 bg-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-60 active:bg-red-700">
            {encerrando ? 'Encerrando...' : '🏁 Encerrar lote'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Editar Lote ─────────────────────────────────────────────────────────

function ModalEditarLote({ lote, onClose, onSalvo }: {
  lote: Lote;
  onClose: () => void;
  onSalvo: (loteAtualizado: Lote) => void;
}) {
  const [nome, setNome] = useState(lote.nome);
  const [invernada, setInvernada] = useState(lote.invernada);
  const [dataInicio, setDataInicio] = useState(lote.dataInicio);
  const [previsaoAbate, setPrevisaoAbate] = useState(lote.previsaoAbate);
  const [quantidadeBois, setQuantidadeBois] = useState(String(lote.quantidadeBois));
  const [pesoEntrada, setPesoEntrada] = useState(String(lote.pesoEntrada));
  const [numTratosDia, setNumTratosDia] = useState(String(lote.numTratosDia));
  const [trataDomingo, setTrataDomingo] = useState(lote.trataDomingo ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    if (!nome.trim() || !invernada.trim()) { setErro('Nome e invernada são obrigatórios.'); return; }
    if (!quantidadeBois || Number(quantidadeBois) <= 0) { setErro('Informe a quantidade de bois.'); return; }
    if (!pesoEntrada || Number(pesoEntrada) <= 0) { setErro('Informe o peso de entrada.'); return; }
    if (new Date(previsaoAbate) <= new Date(dataInicio)) { setErro('A data de abate deve ser após o início.'); return; }

    setSalvando(true);
    try {
      const loteAtualizado: Lote = {
        ...lote,
        nome: nome.trim(),
        invernada: invernada.trim(),
        dataInicio,
        previsaoAbate,
        quantidadeBois: Number(quantidadeBois),
        pesoEntrada: Number(pesoEntrada),
        numTratosDia: Number(numTratosDia),
        trataDomingo,
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLote(loteAtualizado);
      onSalvo(loteAtualizado);
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">Editar lote</h3>
            <p className="text-xs text-gray-400 mt-0.5">{lote.nome}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">✕</button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Identificação */}
          <div>
            <p className="text-xs font-bold text-green-700 tracking-widest mb-3">IDENTIFICAÇÃO</p>
            <div className="space-y-3">
              <Campo label="Nome do lote" value={nome} onChange={setNome} placeholder="Ex: Lote A – Nelore" />
              <Campo label="Invernada / Curral" value={invernada} onChange={setInvernada} placeholder="Ex: Curral 3" />
            </div>
          </div>

          {/* Datas */}
          <div>
            <p className="text-xs font-bold text-green-700 tracking-widest mb-3">DATAS</p>
            <div className="space-y-3">
              <Campo label="Data de início" type="date" value={dataInicio} onChange={setDataInicio} />
              <Campo label="Previsão de abate" type="date" value={previsaoAbate} onChange={setPrevisaoAbate} />
            </div>
          </div>

          {/* Dados do lote */}
          <div>
            <p className="text-xs font-bold text-green-700 tracking-widest mb-3">DADOS DO LOTE</p>
            <div className="space-y-3">
              <Campo label="Quantidade de bois" type="number" value={quantidadeBois} onChange={setQuantidadeBois} placeholder="Ex: 120" min="1" />
              <Campo label="Peso médio de entrada (kg)" type="number" value={pesoEntrada} onChange={setPesoEntrada} placeholder="Ex: 350" min="1" />

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tratos por dia</label>
                <div className="flex gap-2">
                  {['1', '2', '3'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumTratosDia(n)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                        numTratosDia === n
                          ? 'bg-green-700 text-white'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Trata no domingo?</label>
                <div className="flex gap-2">
                  {([true, false] as const).map(valor => (
                    <button key={String(valor)} type="button" onClick={() => setTrataDomingo(valor)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                        trataDomingo === valor
                          ? valor ? 'bg-green-700 text-white' : 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                      {valor ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
        </div>

        {/* Rodapé */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50 active:bg-green-800"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text', min }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}
