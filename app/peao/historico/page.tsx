'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLotes, getTratosByLote, getLeiturasCochoByLote } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, Trato, LeituraCocho } from '@/types';

const COCHO_LABELS = ['Limpo', 'Pouco', 'Médio', 'Cheio'];
const COCHO_COLORS = ['text-green-700 bg-green-50', 'text-yellow-700 bg-yellow-50', 'text-orange-700 bg-orange-50', 'text-red-700 bg-red-50'];

export default function HistoricoPage() {
  const { usuario } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<Lote | null>(null);
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [leituras, setLeituras] = useState<LeituraCocho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<'tratos' | 'cocho'>('tratos');

  useEffect(() => {
    if (!usuario) return;
    getLotes(usuario.fazendaId).then(l => {
      setLotes(l);
      if (l.length > 0) selecionarLote(l[0]);
      else setCarregando(false);
    });
  }, [usuario]);

  async function selecionarLote(lote: Lote) {
    setCarregando(true);
    setLoteSelecionado(lote);
    const [t, lc] = await Promise.all([
      getTratosByLote(lote.id),
      getLeiturasCochoByLote(lote.id),
    ]);
    // Filtrar apenas tratos do próprio peão
    const meusTratos = t.filter(tr => tr.funcionarioId === usuario?.uid);
    setTratos(meusTratos);
    setLeituras(lc.filter(l => l.funcionarioId === usuario?.uid));
    setCarregando(false);
  }

  // Agrupar tratos por data
  const tratosPorData = tratos.reduce<Record<string, Trato[]>>((acc, t) => {
    if (!acc[t.data]) acc[t.data] = [];
    acc[t.data].push(t);
    return acc;
  }, {});
  const datas = Object.keys(tratosPorData).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Histórico</h1>
        <p className="text-green-200 text-xs mt-0.5">Seus lançamentos</p>
      </div>

      {/* Seletor de lote */}
      {lotes.length > 1 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {lotes.map(lote => (
              <button
                key={lote.id}
                onClick={() => selecionarLote(lote)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  loteSelecionado?.id === lote.id
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {lote.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-100">
        {(['tratos', 'cocho'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-1 py-3 text-sm font-bold transition border-b-2 ${
              aba === a ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'
            }`}
          >
            {a === 'tratos' ? '🌾 Tratos' : '📊 Cocho'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {carregando ? (
          <p className="text-center text-gray-400 py-10">Carregando...</p>
        ) : lotes.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Nenhum lote ativo</p>
        ) : aba === 'tratos' ? (
          datas.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Nenhum trato lançado</p>
          ) : (
            <div className="space-y-4">
              {datas.slice(0, 30).map(data => {
                const ts = tratosPorData[data];
                const totalKg = ts.reduce((s, t) => s + t.quantidadeEfetiva, 0);
                return (
                  <div key={data} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-bold text-gray-700">
                        {format(new Date(data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="font-bold text-green-700">{totalKg}kg</p>
                    </div>
                    <div className="space-y-1.5">
                      {ts.sort((a, b) => a.numeroTrato - b.numeroTrato).map(t => (
                        <div key={t.id} className="flex justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <span>Trato {t.numeroTrato}</span>
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
          leituras.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Nenhuma leitura de cocho</p>
          ) : (
            <div className="space-y-2">
              {leituras.slice(0, 30).map(l => (
                <div key={l.id} className="bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center">
                  <p className="font-bold text-gray-700 text-sm">
                    {format(new Date(l.data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${COCHO_COLORS[l.valor]}`}>
                    {COCHO_LABELS[l.valor]}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
