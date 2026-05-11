'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInsumos, salvarInsumo, getRecebimentos, salvarRecebimento,
  getCotacoesByInsumo, salvarCotacao,
} from '@/lib/firestore';
import { format } from 'date-fns';
import type { Insumo, RecebimentoInsumo, Cotacao, CategoriaInsumo } from '@/types';
import { CATEGORIAS_INSUMO } from '@/types';

type Aba = 'insumos' | 'cotacoes';
type Modal =
  | null
  | 'novoInsumo'
  | { tipo: 'editar'; insumo: Insumo }
  | { tipo: 'recebimento'; insumo: Insumo }
  | { tipo: 'historico'; insumo: Insumo }
  | { tipo: 'alerta'; insumo: Insumo }
  | { tipo: 'cotacao'; insumo: Insumo };

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
