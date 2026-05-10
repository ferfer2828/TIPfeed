'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getInsumos, salvarInsumo } from '@/lib/firestore';
import type { Insumo } from '@/types';

export default function PeaoInsumosPage() {
  const { usuario } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAlerta, setModalAlerta] = useState<Insumo | null>(null);

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

  useEffect(() => { if (usuario) carregar(); }, [usuario]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Insumos</h1>
        <p className="text-green-200 text-xs mt-0.5">Avise o gerente quando o estoque estiver baixo</p>
      </div>

      <div className="px-4 py-4">
        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : insumos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 font-semibold">Nenhum insumo cadastrado</p>
            <p className="text-gray-400 text-sm mt-1">O gerente ainda não cadastrou insumos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insumos.map(insumo => (
              <div key={insumo.id} className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${insumo.alertaAtivo ? 'border-red-400' : 'border-transparent'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{insumo.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{insumo.unidade}</p>
                    {insumo.alertaAtivo && insumo.mensagemAlerta && (
                      <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                        <p className="text-xs text-red-600">⚠️ {insumo.mensagemAlerta}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setModalAlerta(insumo)}
                    className={`ml-3 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-bold transition active:opacity-70
                      ${insumo.alertaAtivo ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    <span className="text-lg">{insumo.alertaAtivo ? '🔔' : '🔕'}</span>
                    <span>{insumo.alertaAtivo ? 'Alerta ON' : 'Sem alerta'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAlerta && (
        <ModalAlerta
          insumo={modalAlerta}
          onClose={() => setModalAlerta(null)}
          onSalvo={() => { setModalAlerta(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ─── Modal Alerta ──────────────────────────────────────────────────────────────

function ModalAlerta({ insumo, onClose, onSalvo }: {
  insumo: Insumo;
  onClose: () => void;
  onSalvo: () => void;
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
    } catch (e) {
      console.error('Erro ao salvar alerta:', e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100]">
      <div className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">Alerta de estoque</h3>
            <p className="text-xs text-gray-400 mt-0.5">{insumo.nome}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">✕</button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm font-bold text-gray-700">Estoque baixo</p>
              <p className="text-xs text-gray-400 mt-0.5">Avisar o gerente que o estoque está baixo</p>
            </div>
            <button
              onClick={() => setAlertaAtivo(!alertaAtivo)}
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${alertaAtivo ? 'bg-red-500' : 'bg-gray-300'} relative`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertaAtivo ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Mensagem do aviso{!alertaAtivo && <span className="text-gray-300"> (opcional)</span>}
            </label>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              placeholder="Ex: Milho está acabando, precisa pedir mais"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Aviso info */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600">
              💡 O aviso aparece no painel do gerente e na lista de insumos dele.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:bg-green-800"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
