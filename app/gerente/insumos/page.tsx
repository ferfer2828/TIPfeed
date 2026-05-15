'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInsumos, salvarInsumo, excluirInsumo, getRecebimentos, salvarRecebimento,
  getCotacoesByInsumo, salvarCotacao,
  getDietaFazenda, salvarDietaFazenda, getLotes, getDietaDias,
} from '@/lib/firestore';
import { format, differenceInDays } from 'date-fns';
import type { Insumo, RecebimentoInsumo, Cotacao, CategoriaInsumo, ComposicaoItem, DietaFazenda, Lote, DietaDia } from '@/types';
import { CATEGORIAS_INSUMO } from '@/types';

type Aba = 'insumos' | 'cotacoes' | 'dieta';
type Modal =
  | null
  | 'novoInsumo'
  | { tipo: 'editar'; insumo: Insumo }
  | { tipo: 'recebimento'; insumo: Insumo }
  | { tipo: 'historico'; insumo: Insumo }
  | { tipo: 'alerta'; insumo: Insumo }
  | { tipo: 'cotacao'; insumo: Insumo }
  | { tipo: 'excluir'; insumo: Insumo };

function categoriaInfo(cat?: CategoriaInsumo) {
  return CATEGORIAS_INSUMO.find(c => c.valor === cat) ?? CATEGORIAS_INSUMO[3];
}

export default function InsumosPage() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>('insumos');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<Modal>(null);

  async function carregar() {
    if (!usuario) return;
    try {
      const i = await getInsumos(usuario.fazendaId);
      setInsumos(i);
    } catch (e) {
      console.error('Erro ao carregar insumos:', e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [usuario]);

  // Group insumos by category for cotações tab
  const porCategoria = CATEGORIAS_INSUMO.map(cat => ({
    ...cat,
    lista: insumos.filter(i => (i.categoria ?? 'outros') === cat.valor),
  })).filter(g => g.lista.length > 0);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-0">
        <h1 className="text-white text-xl font-extrabold">Insumos</h1>
        {/* Tabs */}
        <div className="flex mt-3">
          {([
            { key: 'insumos', label: 'Estoque' },
            { key: 'cotacoes', label: 'Cotações' },
            { key: 'dieta', label: '🌿 Dieta' },
          ] as { key: Aba; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                aba === t.key
                  ? 'border-white text-white'
                  : 'border-transparent text-green-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : aba === 'insumos' ? (
          /* ─── Aba Estoque ─── */
          <>
            {insumos.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 mb-4">Nenhum insumo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {insumos.map(insumo => {
                  const cat = categoriaInfo(insumo.categoria);
                  return (
                    <div key={insumo.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 truncate">{insumo.nome}</p>
                            <p className="text-xs text-gray-400">{cat.label} · {insumo.unidade}</p>
                            {insumo.alertaAtivo && (
                              <div className="mt-1 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5">
                                <p className="text-xs text-red-600 truncate">⚠️ {insumo.mensagemAlerta}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 ml-2 flex-shrink-0">
                          {/* Editar */}
                          <button
                            onClick={() => setModal({ tipo: 'editar', insumo })}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-xl active:bg-gray-200"
                            title="Editar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          {/* Alerta */}
                          <button
                            onClick={() => setModal({ tipo: 'alerta', insumo })}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl active:opacity-70 text-sm
                              ${insumo.alertaAtivo ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}
                            title="Alerta"
                          >
                            {insumo.alertaAtivo ? '🔔' : '🔕'}
                          </button>
                          {/* Excluir */}
                          <button
                            onClick={() => setModal({ tipo: 'excluir', insumo })}
                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-xl active:bg-red-100"
                            title="Excluir"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setModal({ tipo: 'recebimento', insumo })}
                          className="flex-1 bg-green-50 text-green-700 font-semibold text-xs py-2.5 rounded-xl active:bg-green-100"
                        >
                          + Recebimento
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'historico', insumo })}
                          className="flex-1 bg-gray-50 text-gray-600 font-semibold text-xs py-2.5 rounded-xl active:bg-gray-100"
                        >
                          Histórico
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'cotacao', insumo })}
                          className="flex-1 bg-blue-50 text-blue-700 font-semibold text-xs py-2.5 rounded-xl active:bg-blue-100"
                        >
                          💲 Cotação
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setModal('novoInsumo')}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl active:bg-green-800 mb-6"
            >
              + Novo insumo
            </button>
          </>
        ) : aba === 'dieta' ? (
          /* ─── Aba Dieta da Fazenda ─── */
          <AbaDietaFazenda insumos={insumos} fazendaId={usuario!.fazendaId} />
        ) : (
          /* ─── Aba Cotações ─── */
          <>
            {insumos.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400">Cadastre insumos primeiro</p>
              </div>
            ) : porCategoria.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400">Nenhum insumo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-5 mb-6">
                {porCategoria.map(grupo => (
                  <div key={grupo.valor}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xl">{grupo.icon}</span>
                      <p className="text-xs font-bold text-gray-500 tracking-widest uppercase">{grupo.label}</p>
                    </div>
                    <div className="space-y-2">
                      {grupo.lista.map(insumo => (
                        <button
                          key={insumo.id}
                          onClick={() => setModal({ tipo: 'cotacao', insumo })}
                          className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between active:bg-gray-50 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{grupo.icon}</span>
                            <div>
                              <p className="font-bold text-gray-800">{insumo.nome}</p>
                              <p className="text-xs text-gray-400">por {insumo.unidade}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-blue-600 font-semibold">Ver preços →</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modais */}
      {modal === 'novoInsumo' && (
        <ModalNovoInsumo
          fazendaId={usuario!.fazendaId}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(); }}
        />
      )}

      {modal !== null && typeof modal === 'object' && modal.tipo === 'editar' && (
        <ModalEditarInsumo
          insumo={modal.insumo}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(); }}
        />
      )}

      {modal !== null && typeof modal === 'object' && modal.tipo === 'recebimento' && (
        <ModalRecebimento
          insumo={modal.insumo}
          fazendaId={usuario!.fazendaId}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(); }}
        />
      )}

      {modal !== null && typeof modal === 'object' && modal.tipo === 'historico' && (
        <ModalHistorico
          insumo={modal.insumo}
          fazendaId={usuario!.fazendaId}
          onClose={() => setModal(null)}
        />
      )}

      {modal !== null && typeof modal === 'object' && modal.tipo === 'alerta' && (
        <ModalAlerta
          insumo={modal.insumo}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(); }}
        />
      )}

      {modal !== null && typeof modal === 'object' && modal.tipo === 'cotacao' && (
        <ModalCotacao
          insumo={modal.insumo}
          fazendaId={usuario!.fazendaId}
          onClose={() => setModal(null)}
        />
      )}

      {/* Modal Confirmação Exclusão */}
      {modal !== null && typeof modal === 'object' && modal.tipo === 'excluir' && (
        <ModalConfirmarExclusao
          insumo={modal.insumo}
          onClose={() => setModal(null)}
          onExcluido={() => {
            setInsumos(prev => prev.filter(i => i.id !== (modal as { tipo: 'excluir'; insumo: Insumo }).insumo.id));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal Confirmar Exclusão ──────────────────────────────────────────────────

function ModalConfirmarExclusao({ insumo, onClose, onExcluido }: {
  insumo: Insumo;
  onClose: () => void;
  onExcluido: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar() {
    setExcluindo(true);
    setErro('');
    try {
      await excluirInsumo(insumo);
      onExcluido();
    } catch {
      setErro('Erro ao excluir. Tente novamente.');
      setExcluindo(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3 className="font-bold text-gray-800 text-lg text-center mb-1">Excluir insumo?</h3>
        <p className="text-gray-500 text-sm text-center mb-1">
          <span className="font-semibold text-gray-700">{insumo.nome}</span> será removido permanentemente.
        </p>
        <p className="text-gray-400 text-xs text-center mb-5">
          Histórico de recebimentos e cotações não será afetado.
        </p>
        {erro && <p className="text-red-500 text-sm text-center mb-3">{erro}</p>}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={excluindo}
            className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl active:bg-gray-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={excluindo}
            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl active:bg-red-700 disabled:opacity-50"
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Novo Insumo ─────────────────────────────────────────────────────────

function ModalNovoInsumo({ fazendaId, onClose, onSalvo }: {
  fazendaId: string; onClose: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [categoria, setCategoria] = useState<CategoriaInsumo>('outros');
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const id = `${fazendaId}_ins_${Date.now()}`;
      await salvarInsumo({
        id, fazendaId, nome: nome.trim(), unidade, categoria,
        alertaAtivo, mensagemAlerta: mensagem.trim(),
        atualizadoEm: new Date().toISOString(),
      });
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase
      titulo="Novo Insumo"
      onClose={onClose}
      rodape={
        <button
          onClick={salvar}
          disabled={salvando || !nome.trim()}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      }
    >
      <Campo label="Nome do insumo" value={nome} onChange={setNome} placeholder="Ex: Milho triturado" />

      {/* Categoria */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Categoria</label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIAS_INSUMO.map(c => (
            <button
              key={c.valor}
              onClick={() => setCategoria(c.valor as CategoriaInsumo)}
              className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                categoria === c.valor ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Unidade */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Unidade</label>
        <div className="flex gap-2">
          {['kg', 'ton', 'sc', 'L', 'un'].map(u => (
            <button
              key={u}
              onClick={() => setUnidade(u)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${unidade === u ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-semibold text-gray-700">Alerta ativo</span>
        <button
          onClick={() => setAlertaAtivo(!alertaAtivo)}
          className={`w-12 h-6 rounded-full transition-colors ${alertaAtivo ? 'bg-green-600' : 'bg-gray-300'} relative`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertaAtivo ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {alertaAtivo && (
        <Campo label="Mensagem do alerta" value={mensagem} onChange={setMensagem} placeholder="Ex: Estoque baixo" />
      )}
    </ModalBase>
  );
}

// ─── Modal Editar Insumo ───────────────────────────────────────────────────────

function ModalEditarInsumo({ insumo, onClose, onSalvo }: {
  insumo: Insumo; onClose: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState(insumo.nome);
  const [unidade, setUnidade] = useState(insumo.unidade);
  const [categoria, setCategoria] = useState<CategoriaInsumo>(insumo.categoria ?? 'outros');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await salvarInsumo({
        ...insumo,
        nome: nome.trim(),
        unidade,
        categoria,
        atualizadoEm: new Date().toISOString(),
      });
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase
      titulo="Editar Insumo"
      onClose={onClose}
      rodape={
        <button
          onClick={salvar}
          disabled={salvando || !nome.trim()}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      }
    >
      <Campo label="Nome do insumo" value={nome} onChange={setNome} placeholder="Ex: Milho triturado" />

      {/* Categoria */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Categoria</label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIAS_INSUMO.map(c => (
            <button
              key={c.valor}
              onClick={() => setCategoria(c.valor as CategoriaInsumo)}
              className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                categoria === c.valor ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Unidade */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Unidade</label>
        <div className="flex gap-2">
          {['kg', 'ton', 'sc', 'L', 'un'].map(u => (
            <button
              key={u}
              onClick={() => setUnidade(u)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${unidade === u ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </ModalBase>
  );
}

// ─── Modal Recebimento ─────────────────────────────────────────────────────────

function ModalRecebimento({ insumo, fazendaId, onClose, onSalvo }: {
  insumo: Insumo; fazendaId: string; onClose: () => void; onSalvo: () => void;
}) {
  const [quantidade, setQuantidade] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!quantidade || Number(quantidade) <= 0) return;
    setSalvando(true);
    try {
      const id = `${insumo.id}_rec_${Date.now()}`;
      const rec: RecebimentoInsumo = {
        id, insumoId: insumo.id, fazendaId,
        quantidade: Number(quantidade), data, observacao: obs.trim(),
        criadoEm: new Date().toISOString(),
      };
      await salvarRecebimento(rec);
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase titulo={`Recebimento — ${insumo.nome}`} onClose={onClose}>
      <div className="space-y-3">
        <Campo label={`Quantidade (${insumo.unidade})`} type="number" value={quantidade} onChange={setQuantidade} placeholder="Ex: 5000" />
        <Campo label="Data" type="date" value={data} onChange={setData} />
        <Campo label="Observação (opcional)" value={obs} onChange={setObs} placeholder="Ex: Nota fiscal 1234" />
        <button
          onClick={salvar}
          disabled={salvando || !quantidade}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : 'Registrar'}
        </button>
      </div>
    </ModalBase>
  );
}

// ─── Modal Histórico ───────────────────────────────────────────────────────────

function ModalHistorico({ insumo, fazendaId, onClose }: { insumo: Insumo; fazendaId: string; onClose: () => void }) {
  const [recebimentos, setRecebimentos] = useState<RecebimentoInsumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getRecebimentos(insumo.id, fazendaId).then(r => { setRecebimentos(r); setCarregando(false); });
  }, [insumo.id]);

  return (
    <ModalBase titulo={`Histórico — ${insumo.nome}`} onClose={onClose}>
      {carregando ? (
        <p className="text-center text-gray-400">Carregando...</p>
      ) : recebimentos.length === 0 ? (
        <p className="text-center text-gray-400">Nenhum recebimento registrado</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {recebimentos.map(r => (
            <div key={r.id} className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-gray-700">
                  {format(new Date(r.data + 'T12:00:00'), "dd/MM/yyyy")}
                </p>
                {r.observacao && <p className="text-xs text-gray-400 mt-0.5">{r.observacao}</p>}
              </div>
              <p className="font-bold text-green-700 text-sm">{r.quantidade} {insumo.unidade}</p>
            </div>
          ))}
        </div>
      )}
    </ModalBase>
  );
}

// ─── Modal Alerta ─────────────────────────────────────────────────────────────

function ModalAlerta({ insumo, onClose, onSalvo }: {
  insumo: Insumo; onClose: () => void; onSalvo: () => void;
}) {
  const [alertaAtivo, setAlertaAtivo] = useState(insumo.alertaAtivo);
  const [mensagem, setMensagem] = useState(insumo.mensagemAlerta || '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarInsumo({
        ...insumo,
        alertaAtivo,
        mensagemAlerta: mensagem.trim(),
        atualizadoEm: new Date().toISOString(),
      });
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase
      titulo="Alerta de estoque"
      onClose={onClose}
      rodape={
        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      }
    >
      <p className="text-xs text-gray-400 -mt-1">{insumo.nome}</p>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
        <div>
          <p className="text-sm font-bold text-gray-700">Alerta ativo</p>
          <p className="text-xs text-gray-400 mt-0.5">Aparece no painel como urgência</p>
        </div>
        <button
          onClick={() => setAlertaAtivo(!alertaAtivo)}
          className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${alertaAtivo ? 'bg-red-500' : 'bg-gray-300'} relative`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertaAtivo ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Mensagem do alerta</label>
        <textarea
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
          placeholder="Ex: Estoque de milho baixo, providenciar pedido"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
    </ModalBase>
  );
}

// ─── Modal Cotação ─────────────────────────────────────────────────────────────

function ModalCotacao({ insumo, fazendaId, onClose }: {
  insumo: Insumo; fazendaId: string; onClose: () => void;
}) {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ID da cotação sendo editada (null = nova cotação)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [preco, setPreco] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const cat = categoriaInfo(insumo.categoria);

  useEffect(() => {
    getCotacoesByInsumo(insumo.id, fazendaId)
      .then(c => setCotacoes(c))
      .catch(e => console.error(e))
      .finally(() => setCarregando(false));
  }, [insumo.id]);

  function iniciarEdicao(c: Cotacao) {
    setEditandoId(c.id);
    setPreco(String(c.precoUnitario));
    setFornecedor(c.fornecedor ?? '');
    setData(c.data);
    setSalvo(false);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setPreco('');
    setFornecedor('');
    setData(format(new Date(), 'yyyy-MM-dd'));
    setSalvo(false);
  }

  async function salvar() {
    if (!preco || Number(preco) <= 0) return;
    setSalvando(true);
    try {
      // Se editandoId !== null → edita a cotação existente (mesmo ID = overwrite)
      // Se null → cria nova cotação com ID novo
      const cotacao: Cotacao = {
        id: editandoId ?? `${insumo.id}_cot_${Date.now()}`,
        insumoId: insumo.id,
        fazendaId,
        precoUnitario: Number(preco),
        fornecedor: fornecedor.trim(),
        data,
        criadoEm: editandoId
          ? (cotacoes.find(c => c.id === editandoId)?.criadoEm ?? new Date().toISOString())
          : new Date().toISOString(),
      };
      await salvarCotacao(cotacao);

      // Atualiza lista local
      setCotacoes(prev => {
        const semEsta = prev.filter(c => c.id !== cotacao.id);
        return [cotacao, ...semEsta].sort((a, b) => b.data.localeCompare(a.data));
      });

      setSalvo(true);
      setTimeout(() => {
        setSalvo(false);
        cancelarEdicao();
      }, 1500);
    } finally {
      setSalvando(false);
    }
  }

  const modoEdicao = editandoId !== null;

  return (
    <ModalBase titulo={`Cotações — ${insumo.nome}`} onClose={onClose}>
      {/* Header da categoria */}
      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 -mt-1">
        <span className="text-xl">{cat.icon}</span>
        <div>
          <p className="text-xs font-bold text-gray-600">{cat.label}</p>
          <p className="text-xs text-gray-400">por {insumo.unidade}</p>
        </div>
      </div>

      {/* Formulário nova / edição */}
      <div className={`rounded-xl p-3 space-y-2 ${modoEdicao ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50'}`}>
        <div className="flex items-center justify-between mb-1">
          <p className={`text-xs font-bold ${modoEdicao ? 'text-amber-700' : 'text-blue-700'}`}>
            {modoEdicao ? '✏️ Editando cotação' : 'Nova cotação'}
          </p>
          {modoEdicao && (
            <button
              onClick={cancelarEdicao}
              className="text-xs text-gray-400 underline active:text-gray-600"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Preço (R$/{insumo.unidade})</label>
            <input
              type="number"
              value={preco}
              onChange={e => setPreco(e.target.value)}
              placeholder="0,00"
              step="0.01"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white focus:ring-2 ${
                modoEdicao ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-blue-500'
              }`}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white focus:ring-2 ${
                modoEdicao ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-blue-500'
              }`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fornecedor (opcional)</label>
          <input
            type="text"
            value={fornecedor}
            onChange={e => setFornecedor(e.target.value)}
            placeholder="Ex: Agropecuária XYZ"
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white focus:ring-2 ${
              modoEdicao ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-blue-500'
            }`}
          />
        </div>
        <button
          onClick={salvar}
          disabled={salvando || !preco || Number(preco) <= 0}
          className={`w-full font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition ${
            salvo
              ? 'bg-green-600 text-white'
              : modoEdicao
              ? 'bg-amber-500 text-white active:bg-amber-600'
              : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          {salvo ? '✅ Salvo!' : salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Registrar cotação'}
        </button>
      </div>

      {/* Histórico de cotações */}
      <div>
        <p className="text-xs font-bold text-gray-500 mb-2">
          Histórico de preços
          {cotacoes.length > 0 && <span className="font-normal text-gray-400"> · toque para editar</span>}
        </p>
        {carregando ? (
          <p className="text-center text-gray-400 text-sm py-2">Carregando...</p>
        ) : cotacoes.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-2">Nenhuma cotação registrada</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {cotacoes.map((c, idx) => {
              const estaEditando = editandoId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => estaEditando ? cancelarEdicao() : iniciarEdicao(c)}
                  className={`w-full text-left rounded-xl p-3 flex justify-between items-center transition active:scale-[0.98] ${
                    estaEditando
                      ? 'bg-amber-100 border-2 border-amber-400'
                      : idx === 0
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 border border-transparent'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-gray-700">
                      {format(new Date(c.data + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                    {c.fornecedor && <p className="text-xs text-gray-400">{c.fornecedor}</p>}
                    {estaEditando
                      ? <p className="text-xs text-amber-600 font-semibold">Editando...</p>
                      : idx === 0
                      ? <p className="text-xs text-blue-600 font-semibold">Mais recente</p>
                      : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-700 text-base">
                      R$ {c.precoUnitario.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">/{insumo.unidade}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// ─── Aba Dieta da Fazenda ─────────────────────────────────────────────────────

function AbaDietaFazenda({ insumos, fazendaId }: { insumos: Insumo[]; fazendaId: string }) {
  const [ganhoDiario, setGanhoDiario] = useState('0.8');
  const [composicao, setComposicao] = useState<ComposicaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  // Lotes e DietaDias para previsão
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [dietasDias, setDietasDias] = useState<Record<string, DietaDia[]>>({});

  // Formulário de novo item
  const [novoInsumoId, setNovoInsumoId] = useState('');
  const [novoPercentual, setNovoPercentual] = useState('');
  const [novoPrecoKg, setNovoPrecoKg] = useState('');
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);

  const hoje = new Date();

  useEffect(() => {
    Promise.all([
      getDietaFazenda(fazendaId),
      getLotes(fazendaId),
    ]).then(async ([d, lots]) => {
      if (d) {
        setGanhoDiario(String(d.ganhoDiarioEsperado));
        setComposicao(d.composicao);
      }
      setLotes(lots);
      // Carrega DietaDias de cada lote para cálculo de custo total
      const entradas = await Promise.all(
        lots.map(async lote => {
          try {
            const dias = await getDietaDias(lote.id, fazendaId);
            return { id: lote.id, dias };
          } catch { return { id: lote.id, dias: [] }; }
        })
      );
      const dict: Record<string, DietaDia[]> = {};
      entradas.forEach(({ id, dias }) => { dict[id] = dias; });
      setDietasDias(dict);
    }).catch(e => console.error(e))
      .finally(() => setCarregando(false));
  }, [fazendaId]);

  const totalPercentual = composicao.reduce((s, c) => s + c.percentual, 0);
  // Custo por kg de ração mista = Σ (% / 100) × preço/kg de cada ingrediente
  const custoRacaoKg = composicao.reduce((s, c) => s + (c.percentual / 100) * c.precoKg, 0);

  function adicionarItem() {
    const insumo = insumos.find(i => i.id === novoInsumoId);
    if (!insumo || !novoPercentual || !novoPrecoKg) return;
    const item: ComposicaoItem = {
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      percentual: Number(novoPercentual),
      precoKg: Number(novoPrecoKg),
      unidade: insumo.unidade,
    };
    setComposicao(prev => {
      const semDuplicata = prev.filter(c => c.insumoId !== item.insumoId);
      return editandoIdx !== null
        ? semDuplicata.splice(editandoIdx, 0, item) && semDuplicata
        : [...semDuplicata, item];
    });
    setNovoInsumoId('');
    setNovoPercentual('');
    setNovoPrecoKg('');
    setEditandoIdx(null);
  }

  function iniciarEdicaoItem(idx: number) {
    const item = composicao[idx];
    setNovoInsumoId(item.insumoId);
    setNovoPercentual(String(item.percentual));
    setNovoPrecoKg(String(item.precoKg));
    setEditandoIdx(idx);
  }

  function removerItem(idx: number) {
    setComposicao(prev => prev.filter((_, i) => i !== idx));
    if (editandoIdx === idx) { setNovoInsumoId(''); setNovoPercentual(''); setNovoPrecoKg(''); setEditandoIdx(null); }
  }

  async function salvar() {
    setErro('');
    if (!ganhoDiario || Number(ganhoDiario) <= 0) { setErro('Informe o ganho diário esperado.'); return; }
    setSalvando(true);
    try {
      // Sanitiza para garantir que não há undefined/NaN (Firestore rejeita esses valores)
      const composicaoSalva = composicao.map(c => ({
        insumoId:    c.insumoId   ?? '',
        insumoNome:  c.insumoNome ?? '',
        percentual:  Number.isFinite(Number(c.percentual)) ? Number(c.percentual) : 0,
        precoKg:     Number.isFinite(Number(c.precoKg))    ? Number(c.precoKg)    : 0,
        unidade:     c.unidade    ?? '',
      }));
      const d: DietaFazenda = {
        id: fazendaId,
        fazendaId,
        ganhoDiarioEsperado: Number(ganhoDiario),
        composicao: composicaoSalva,
        atualizadoEm: new Date().toISOString(),
      };
      await salvarDietaFazenda(d);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      console.error('Erro ao salvar dieta da fazenda:', e);
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      setErro(`Erro: ${msg}`);
    }
    finally { setSalvando(false); }
  }

  if (carregando) {
    return <p className="text-center text-gray-400 py-10">Carregando...</p>;
  }

  const ganho = Number(ganhoDiario) || 0;
  const percentualOk = Math.abs(totalPercentual - 100) < 0.5;

  return (
    <div className="space-y-4 pb-6">

      {/* ── Ganho diário esperado ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-bold text-green-700 tracking-widest mb-3">GANHO DIÁRIO ESPERADO</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={ganhoDiario}
            onChange={e => setGanhoDiario(e.target.value)}
            step="0.05"
            min="0"
            placeholder="Ex: 0.8"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-2xl font-extrabold text-green-700 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm text-gray-500 flex-shrink-0">kg/animal<br/>por dia</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Usado para calcular a previsão de peso atual e final de cada lote
        </p>
      </div>

      {/* ── Composição da ração ── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-green-700 tracking-widest">COMPOSIÇÃO DA RAÇÃO</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            percentualOk ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {totalPercentual.toFixed(1)}% de 100%
          </span>
        </div>

        {composicao.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Nenhum ingrediente ainda</p>
        ) : (
          <div className="space-y-2 mb-4">
            {composicao.map((item, idx) => {
              const custoContrib = (item.percentual / 100) * item.precoKg;
              return (
                <div key={item.insumoId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">{item.insumoNome}</p>
                    <p className="text-xs text-gray-400">
                      R$ {item.precoKg.toFixed(3)}/{item.unidade === 'kg' ? 'kg' : `kg (informado)`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-sm font-bold text-green-700">{item.percentual}%</p>
                    <p className="text-xs text-gray-400">≈ R${custoContrib.toFixed(3)}/kg ração</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => iniciarEdicaoItem(idx)}
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg active:bg-gray-200"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => removerItem(idx)}
                      className="w-7 h-7 flex items-center justify-center bg-red-50 rounded-lg active:bg-red-100 text-red-400"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulário adicionar/editar */}
        <div className={`rounded-xl p-3 space-y-2 ${editandoIdx !== null ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
          <p className="text-xs font-semibold text-gray-500">
            {editandoIdx !== null ? `✏️ Editando: ${composicao[editandoIdx]?.insumoNome}` : 'Adicionar ingrediente'}
          </p>
          <select
            value={novoInsumoId}
            onChange={e => setNovoInsumoId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Selecionar insumo...</option>
            {insumos
              .filter(i => !composicao.find(c => c.insumoId === i.id) || composicao[editandoIdx ?? -1]?.insumoId === i.id)
              .map(i => (
                <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
              ))}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">% na ração</label>
              <input
                type="number"
                value={novoPercentual}
                onChange={e => setNovoPercentual(e.target.value)}
                placeholder="Ex: 60"
                min="0" max="100" step="0.5"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">
                R$/kg{novoInsumoId && insumos.find(i => i.id === novoInsumoId)?.unidade !== 'kg'
                  ? ` (converta de ${insumos.find(i => i.id === novoInsumoId)?.unidade})`
                  : ''}
              </label>
              <input
                type="number"
                value={novoPrecoKg}
                onChange={e => setNovoPrecoKg(e.target.value)}
                placeholder="Ex: 0.85"
                min="0" step="0.001"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          {/* Dica de conversão */}
          {novoInsumoId && (() => {
            const u = insumos.find(i => i.id === novoInsumoId)?.unidade;
            if (u === 'ton') return <p className="text-xs text-blue-500">💡 Tonelada: R$/ton ÷ 1000 = R$/kg</p>;
            if (u === 'sc') return <p className="text-xs text-blue-500">💡 Saca 60kg: R$/sc ÷ 60 = R$/kg</p>;
            return null;
          })()}
          <div className="flex gap-2">
            <button
              onClick={adicionarItem}
              disabled={!novoInsumoId || !novoPercentual || !novoPrecoKg}
              className="flex-1 bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 active:bg-green-800"
            >
              {editandoIdx !== null ? 'Atualizar' : '+ Adicionar'}
            </button>
            {editandoIdx !== null && (
              <button
                onClick={() => { setEditandoIdx(null); setNovoInsumoId(''); setNovoPercentual(''); setNovoPrecoKg(''); }}
                className="px-4 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Custo calculado da ração ── */}
      {composicao.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-green-700 tracking-widest mb-3">CUSTO DA RAÇÃO</p>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">Custo por kg de ração mista</p>
            <p className="text-2xl font-extrabold text-green-700">
              R$ {custoRacaoKg.toFixed(3)}<span className="text-sm font-normal text-gray-400">/kg</span>
            </p>
          </div>
          {!percentualOk && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
              <p className="text-xs text-orange-700">
                ⚠️ Composição soma {totalPercentual.toFixed(1)}% — ajuste para somar 100% para custo preciso
              </p>
            </div>
          )}
          {/* Detalhamento por ingrediente */}
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-semibold text-gray-400">Custo por ingrediente</p>
            {composicao.map(item => (
              <div key={item.insumoId} className="flex justify-between text-xs">
                <span className="text-gray-600">{item.insumoNome} ({item.percentual}%)</span>
                <span className="font-semibold text-gray-700">
                  R$ {((item.percentual / 100) * item.precoKg).toFixed(3)}/kg ração
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Previsão por lote ── */}
      {lotes.length > 0 && ganho > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-green-700 tracking-widest mb-3">PREVISÃO POR LOTE</p>
          <div className="space-y-4">
            {lotes.map(lote => {
              const diasConfinamento = differenceInDays(hoje, new Date(lote.dataInicio)) + 1;
              const totalDias = differenceInDays(new Date(lote.previsaoAbate), new Date(lote.dataInicio)) + 1;
              const diasRestantes = Math.max(0, totalDias - diasConfinamento);

              const pesoAtual = Math.round(lote.pesoEntrada + (diasConfinamento * ganho));
              const pesoFinal = Math.round(lote.pesoEntrada + (totalDias * ganho));
              const ganhoTotal = pesoFinal - lote.pesoEntrada;

              const diasDieta = dietasDias[lote.id] ?? [];
              const totalKgDieta = diasDieta.reduce((s, d) => s + d.quantidadeRecomendada, 0);
              const custoTotalDieta = totalKgDieta * custoRacaoKg;
              const custoTotalFormatado = custoTotalDieta.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              const custoPorBoi = lote.quantidadeBois > 0 ? (custoTotalDieta / lote.quantidadeBois) : 0;

              return (
                <div key={lote.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-gray-800 text-sm">{lote.nome}</p>
                    <p className="text-xs text-gray-400">{lote.quantidadeBois} bois</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-400">Peso atual est.</p>
                      <p className="text-lg font-extrabold text-gray-800">{pesoAtual} kg</p>
                      <p className="text-xs text-green-600">Dia {diasConfinamento}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-400">Peso final est.</p>
                      <p className="text-lg font-extrabold text-green-700">{pesoFinal} kg</p>
                      <p className="text-xs text-gray-400">+{ganhoTotal} kg/boi</p>
                    </div>
                    {custoRacaoKg > 0 && totalKgDieta > 0 && (
                      <>
                        <div className="bg-white rounded-xl p-2.5 text-center">
                          <p className="text-xs text-gray-400">Custo dieta total</p>
                          <p className="text-base font-extrabold text-blue-700">R$ {custoTotalFormatado}</p>
                          <p className="text-xs text-gray-400">{totalKgDieta.toLocaleString('pt-BR')} kg ração</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 text-center">
                          <p className="text-xs text-gray-400">Custo por boi</p>
                          <p className="text-base font-extrabold text-blue-700">
                            R$ {custoPorBoi.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-400">{diasRestantes} dias restantes</p>
                        </div>
                      </>
                    )}
                    {custoRacaoKg > 0 && totalKgDieta === 0 && (
                      <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-center">
                        <p className="text-xs text-yellow-700">Configure a dieta do lote para ver custos</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botão salvar */}
      {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
      <button
        onClick={salvar}
        disabled={salvando}
        className={`w-full font-bold py-4 rounded-2xl transition disabled:opacity-50 ${
          salvo ? 'bg-green-500 text-white' : 'bg-green-700 text-white active:bg-green-800'
        }`}
      >
        {salvo ? '✅ Configurações salvas!' : salvando ? 'Salvando...' : 'Salvar configurações da dieta'}
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ModalBase({ titulo, onClose, children, rodape }: {
  titulo: string; onClose: () => void; children: React.ReactNode; rodape?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-800">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {children}
        </div>
        {rodape && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}
