'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes } from '@/lib/firestore';
import { exportarLote, exportarGeral } from '@/lib/export';
import type { Lote } from '@/types';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { differenceInDays } from 'date-fns';

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    getLotes(usuario.fazendaId).then(l => { setLotes(l); setCarregando(false); });
  }, [usuario]);

  async function exportarLoteIndividual(lote: Lote) {
    setExportando(lote.id);
    try {
      await exportarLote(lote, usuario!.fazendaId);
    } catch (e) {
      alert('Erro ao exportar. Tente novamente.');
    } finally {
      setExportando(null);
    }
  }

  async function exportarRelatorioGeral() {
    if (!usuario) return;
    setExportando('geral');
    try {
      await exportarGeral(usuario.fazendaId);
    } catch {
      alert('Erro ao exportar. Tente novamente.');
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Relatórios</h1>
        <p className="text-green-200 text-xs mt-0.5">Exportar dados para Excel</p>
      </div>

      <div className="px-4 py-4">
        {/* Exportação geral */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">📊</div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">Relatório Geral</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Todos os lotes, tratos e leituras de cocho em uma planilha.
              </p>
            </div>
          </div>
          <button
            onClick={exportarRelatorioGeral}
            disabled={exportando === 'geral' || carregando}
            className="w-full mt-3 bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-60 active:bg-green-800"
          >
            {exportando === 'geral' ? 'Exportando...' : '⬇ Baixar Excel Geral'}
          </button>
        </div>

        {/* Por lote */}
        <p className="text-xs font-bold text-gray-500 mb-2 px-1">EXPORTAR POR LOTE</p>
        {carregando ? (
          <p className="text-center text-gray-400 py-6">Carregando...</p>
        ) : lotes.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center">
            <p className="text-gray-400">Nenhum lote ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lotes.map(lote => {
              const diasConfinamento = differenceInDays(new Date(), new Date(lote.dataInicio)) + 1;
              return (
                <div key={lote.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-800">{lote.nome}</p>
                      <p className="text-xs text-gray-400">
                        {lote.invernada} · {lote.quantidadeBois} bois · Dia {diasConfinamento}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(lote.dataInicio), 'dd/MM/yy')} → {format(new Date(lote.previsaoAbate), 'dd/MM/yy')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => exportarLoteIndividual(lote)}
                    disabled={exportando === lote.id}
                    className="w-full bg-blue-50 text-blue-700 font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 active:bg-blue-100"
                  >
                    {exportando === lote.id ? 'Exportando...' : '⬇ Exportar este lote'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
