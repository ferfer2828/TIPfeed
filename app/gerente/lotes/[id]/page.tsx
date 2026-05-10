'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLote, getTratosByLote, getLeiturasCochoByLote, getDietaDias } from '@/lib/firestore';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, Trato, LeituraCocho, DietaDia } from '@/types';

const COCHO_LABELS = ['Limpo', 'Pouco', 'Médio', 'Cheio'];
const COCHO_COLORS = ['text-green-600 bg-green-50', 'text-yellow-600 bg-yellow-50', 'text-orange-600 bg-orange-50', 'text-red-600 bg-red-50'];

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<Lote | null>(null);
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [leituras, setLeituras] = useState<LeituraCocho[]>([]);
  const [dietas, setDietas] = useState<DietaDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<'tratos' | 'cocho'>('tratos');

  useEffect(() => {
    Promise.all([
      getLote(id),
      getTratosByLote(id),
      getLeiturasCochoByLote(id),
      getDietaDias(id),
    ]).then(([l, t, lc, d]) => {
      setLote(l);
      setTratos(t);
      setLeituras(lc);
      setDietas(d);
    }).finally(() => setCarregando(false));
  }, [id]);

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Lote não encontrado.</p>
      </div>
    );
  }

  const hoje = new Date();
  const diasConfinamento = differenceInDays(hoje, new Date(lote.dataInicio)) + 1;
  const diasRestantes = differenceInDays(new Date(lote.previsaoAbate), hoje);
  const totalDias = differenceInDays(new Date(lote.previsaoAbate), new Date(lote.dataInicio));
  const progresso = Math.min(100, Math.max(0, (diasConfinamento / totalDias) * 100));

  // Dieta de hoje
  const dietaHoje = dietas.find(d => d.data === format(hoje, 'yyyy-MM-dd'));

  // Agrupar tratos por data
  const tratosPorData = tratos.reduce<Record<string, Trato[]>>((acc, t) => {
    if (!acc[t.data]) acc[t.data] = [];
    acc[t.data].push(t);
    return acc;
  }, {});

  const datas = Object.keys(tratosPorData).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-green-200">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-extrabold">{lote.nome}</h1>
            <p className="text-green-200 text-xs">{lote.invernada} · {lote.quantidadeBois} bois</p>
          </div>
          <Link href={`/gerente/lotes/${id}/dieta`}>
            <button className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:bg-green-500">
              Dieta
            </button>
          </Link>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-lg font-extrabold">{diasConfinamento}</p>
            <p className="text-green-200 text-xs">Dias</p>
          </div>
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-lg font-extrabold">{diasRestantes > 0 ? diasRestantes : 0}</p>
            <p className="text-green-200 text-xs">P/ abate</p>
          </div>
          <div className="bg-green-600 rounded-xl p-2">
            <p className="text-white text-lg font-extrabold">{dietaHoje ? `${dietaHoje.quantidadeRecomendada}kg` : '—'}</p>
            <p className="text-green-200 text-xs">Recomend. hoje</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="bg-green-600 rounded-xl p-3">
          <div className="flex justify-between text-xs text-green-200 mb-1.5">
            <span>{format(new Date(lote.dataInicio), 'dd/MM/yy')}</span>
            <span>{Math.round(progresso)}% do confinamento</span>
            <span>{format(new Date(lote.previsaoAbate), 'dd/MM/yy')}</span>
          </div>
          <div className="h-2 bg-green-500 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-200">
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
        {aba === 'tratos' ? (
          datas.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Nenhum trato registrado</p>
          ) : (
            <div className="space-y-4">
              {datas.map(data => {
                const ts = tratosPorData[data];
                const totalKg = ts.reduce((s, t) => s + t.quantidadeEfetiva, 0);
                const dietaDia = dietas.find(d => d.data === data);
                const diff = dietaDia ? totalKg - dietaDia.quantidadeRecomendada : null;
                return (
                  <div key={data} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <p className="font-bold text-gray-700 text-sm">
                        {format(new Date(data + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="text-right">
                        <p className="font-bold text-green-700">{totalKg}kg</p>
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
          leituras.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Nenhuma leitura de cocho</p>
          ) : (
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
    </div>
  );
}
