'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getInsumos, salvarInsumo, getRecebimentos, salvarRecebimento } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Insumo, RecebimentoInsumo } from '@/types';

type Modal = null | 'novoInsumo' | { tipo: 'recebimento'; insumo: Insumo } | { tipo: 'historico'; insumo: Insumo };

export default function InsumosPage() {
  const { usuario } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<Modal>(null);

  async function carregar() {
    if (!usuario) return;
    const i = await getInsumos(usuario.fazendaId);
    setInsumos(i);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [usuario]);

  async function toggleAlerta(insumo: Insumo) {
    const atualizado: Insumo = {
      ...insumo,
      alertaAtivo: !insumo.alertaAtivo,
      atualizadoEm: new Date().toISOString(),
    };
    await salvarInsumo(atualizado);
    carregar();
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Insumos</h1>
        <p className="text-green-200 text-xs mt-0.5">Estoque e alertas</p>
      </div>

      <div className="px-4 py-4">
        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : insumos.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">Nenhum insumo cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {insumos.map(insumo => (
              <div key={insumo.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{insumo.nome}</p>
                    <p className="text-xs text-gray-400">{insumo.unidade}</p>
                    {insumo.alertaAtivo && (
                      <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                        <p className="text-xs text-red-600">⚠️ {insumo.mensagemAlerta}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAlerta(insumo)}
                    className={`ml-3 px-3 py-1.5 rounded-xl text-xs font-bold transition
                      ${insumo.alertaAtivo
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'}`}
                  >
                    {insumo.alertaAtivo ? '🔔 ON' : '🔕 OFF'}
                  </button>
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
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setModal('novoInsumo')}
          className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl active:bg-green-800 mb-6"
        >
          + Novo insumo
        </button>
      </div>

      {modal === 'novoInsumo' && (
        <ModalNovoInsumo
          fazendaId={usuario!.fazendaId}
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
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const id = `${fazendaId}_ins_${Date.now()}`;
      await salvarInsumo({
        id, fazendaId, nome: nome.trim(), unidade,
        alertaAtivo, mensagemAlerta: mensagem.trim(),
        atualizadoEm: new Date().toISOString(),
      });
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalBase titulo="Novo Insumo" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Nome do insumo" value={nome} onChange={setNome} placeholder="Ex: Milho triturado" />
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
        <button
          onClick={salvar}
          disabled={salvando || !nome.trim()}
          className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
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

function ModalHistorico({ insumo, onClose }: { insumo: Insumo; onClose: () => void }) {
  const [recebimentos, setRecebimentos] = useState<RecebimentoInsumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    getRecebimentos(insumo.id).then(r => { setRecebimentos(r); setCarregando(false); });
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ModalBase({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-800">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none p-1">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 pb-8">
          {children}
        </div>
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
