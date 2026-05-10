'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getLote, getDietaDias, salvarDietaDias } from '@/lib/firestore';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lote, DietaDia } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function DietaPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    }>
      <DietaPage />
    </Suspense>
  );
}

function DietaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNovo = searchParams.get('novo') === '1';
  const { usuario } = useAuth();

  const [lote, setLote] = useState<Lote | null>(null);
  const [dias, setDias] = useState<{ data: string; dia: number; kg: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [aplicarTodos, setAplicarTodos] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([getLote(id), getDietaDias(id)]).then(([l, dietas]) => {
      if (!l) return;
      setLote(l);

      const totalDias = differenceInDays(new Date(l.previsaoAbate), new Date(l.dataInicio)) + 1;
      const diasGerados: { data: string; dia: number; kg: string }[] = [];

      for (let i = 0; i < totalDias; i++) {
        const data = format(addDays(new Date(l.dataInicio), i), 'yyyy-MM-dd');
        const dietaExistente = dietas.find(d => d.data === data);
        diasGerados.push({
          data,
          dia: i + 1,
          kg: dietaExistente ? String(dietaExistente.quantidadeRecomendada) : '',
        });
      }
      setDias(diasGerados);
    }).finally(() => setCarregando(false));
  }, [id]);

  function setKg(index: number, valor: string) {
    setDias(prev => prev.map((d, i) => i === index ? { ...d, kg: valor } : d));
  }

  function aplicarATodos() {
    const valor = Number(aplicarTodos);
    if (!valor || valor <= 0) return;
    setDias(prev => prev.map(d => ({ ...d, kg: aplicarTodos })));
    setAplicarTodos('');
  }

  async function salvar() {
    if (!lote || !usuario) return;
    setErro('');
    const incompletos = dias.filter(d => !d.kg || Number(d.kg) <= 0);
    if (incompletos.length > 0) {
      setErro(`Preencha todos os dias (${incompletos.length} dias sem valor).`);
      return;
    }
    setSalvando(true);
    try {
      const dietaDias: DietaDia[] = dias.map(d => ({
        id: `${id}_dia${d.dia}`,
        loteId: id,
        fazendaId: lote.fazendaId,
        dia: d.dia,
        data: d.data,
        quantidadeRecomendada: Number(d.kg),
      }));
      await salvarDietaDias(dietaDias);
      setSalvo(true);
      setTimeout(() => {
        if (isNovo) router.replace('/gerente/lotes');
        else router.back();
      }, 1000);
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  const hoje = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-1">
          {!isNovo && (
            <button onClick={() => router.back()} className="text-green-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-white text-xl font-extrabold">
              {isNovo ? 'Configurar Dieta' : 'Editar Dieta'}
            </h1>
            <p className="text-green-200 text-xs">{lote?.nome} · {dias.length} dias</p>
          </div>
        </div>
        {isNovo && (
          <p className="text-green-200 text-sm mt-2">
            Defina a quantidade recomendada (kg) para cada dia do confinamento.
          </p>
        )}
      </div>

      {/* Aplicar a todos */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <p className="text-xs font-bold text-gray-500 mb-2">ATALHO — Aplicar mesmo valor a todos os dias</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={aplicarTodos}
            onChange={e => setAplicarTodos(e.target.value)}
            placeholder="Ex: 1200"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={aplicarATodos}
            disabled={!aplicarTodos}
            className="bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40 active:bg-green-800"
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* Grid de dias */}
      <div className="divide-y divide-gray-100">
        {dias.map((d, i) => {
          const isHoje = d.data === hoje;
          const isPast = d.data < hoje;
          return (
            <div
              key={d.data}
              className={`flex items-center gap-3 px-4 py-3 ${isHoje ? 'bg-green-50' : 'bg-white'}`}
            >
              <div className="w-14 text-center">
                <p className={`text-sm font-bold ${isHoje ? 'text-green-700' : isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                  Dia {d.dia}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(d.data + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                </p>
                {isHoje && <span className="text-xs text-green-600 font-bold">Hoje</span>}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  value={d.kg}
                  onChange={e => setKg(i, e.target.value)}
                  placeholder="0"
                  min="0"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-green-500
                    ${isHoje ? 'border-green-400 bg-white' : 'border-gray-200 bg-white'}`}
                />
                <span className="text-gray-400 text-sm">kg</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 pb-safe">
        {erro && <p className="text-red-500 text-sm text-center mb-2">{erro}</p>}
        {salvo && <p className="text-green-600 text-sm text-center mb-2 font-semibold">✓ Dieta salva!</p>}
        <button
          onClick={salvar}
          disabled={salvando || salvo}
          className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:bg-green-800"
        >
          {salvando ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar dieta'}
        </button>
      </div>
    </div>
  );
}
