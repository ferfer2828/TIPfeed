'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getLote, getDietaDias, salvarDietaDias } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays, differenceInDays } from 'date-fns';
import type { Lote, DietaDia } from '@/types';

export default function DietaPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-gray-400">Carregando...</p></div>}>
      <DietaPage />
    </Suspense>
  );
}

interface DiaDieta {
  data: string;
  dia: number;
  kg: string;
  editado: boolean;
}

// Se trataDomingo === true → sem fator, trata 7 dias/semana
// Se trataDomingo === false → usa ×7÷6 para compensar o domingo sem trato
function calcularPeriodo(
  pesoEntrada: number,
  quantidadeBois: number,
  periodo: number,
  trataDomingo: boolean,
): number {
  const fator = trataDomingo ? 1 : 7 / 6;
  const base = pesoEntrada * 0.01 * fator * quantidadeBois;
  const acrescimo = (periodo - 1) * 0.5 * quantidadeBois;
  return Math.round((base + acrescimo) * 10) / 10;
}

function isDomingo(dateStr: string): boolean {
  return new Date(dateStr + 'T12:00:00').getDay() === 0;
}

function DietaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNovo = searchParams.get('novo') === '1';
  const { usuario } = useAuth();

  const [lote, setLote] = useState<Lote | null>(null);
  const [dias, setDias] = useState<DiaDieta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'periodos' | 'dias'>('periodos');

  const [periodos, setPeriodos] = useState<{ kg: string }[]>([]);

  function processarLote(l: Lote, dietasExistentes: DietaDia[]) {
    setLote(l);
    const trata = l.trataDomingo ?? false;
    const totalDias = differenceInDays(new Date(l.previsaoAbate), new Date(l.dataInicio)) + 1;
    const numPeriodos = Math.ceil(totalDias / 15);
    const diasGerados: DiaDieta[] = [];
    for (let i = 0; i < totalDias; i++) {
      const data = format(addDays(new Date(l.dataInicio), i), 'yyyy-MM-dd');
      const existente = dietasExistentes.find(d => d.data === data);
      const ehDom = !trata && isDomingo(data);
      diasGerados.push({
        data, dia: i + 1,
        kg: existente ? String(existente.quantidadeRecomendada) : ehDom ? '0' : '',
        editado: !!existente,
      });
    }
    setDias(diasGerados);
    const perGerados = Array.from({ length: numPeriodos }, (_, i) => {
      const diaInicioPeriodo = i * 15 + 1;
      return {
        kg: diaInicioPeriodo <= 30
          ? String(calcularPeriodo(l.pesoEntrada, l.quantidadeBois, i + 1, trata))
          : '',
      };
    });
    setPeriodos(perGerados);
    setCarregando(false);
  }

  async function carregarDieta() {
    try {
      const raw = sessionStorage.getItem('loteRecem');
      if (raw) {
        const loteCache = JSON.parse(raw) as Lote;
        if (loteCache.id === id) {
          sessionStorage.removeItem('loteRecem');
          processarLote(loteCache, []);
          return;
        }
      }
    } catch {}

    for (let tentativa = 0; tentativa < 4; tentativa++) {
      if (tentativa > 0) await new Promise(r => setTimeout(r, tentativa * 800));
      try {
        const [l, dietas] = await Promise.all([getLote(id), getDietaDias(id, usuario!.fazendaId)]);
        if (!l) continue;
        processarLote(l, dietas);
        return;
      } catch (e) {
        console.error(`Tentativa ${tentativa + 1}:`, e);
      }
    }
    setCarregando(false);
  }

  useEffect(() => {
    if (!usuario) return;
    carregarDieta();
  }, [id, usuario]);

  // Aplica os valores de período a cada dia, zerando domingos quando necessário
  function aplicarPeriodos() {
    if (!lote) return;
    const trata = lote.trataDomingo ?? false;
    setDias(prev => prev.map(d => {
      if (!trata && isDomingo(d.data)) return { ...d, kg: '0', editado: false };
      const periodo = Math.ceil(d.dia / 15);
      const p = periodos[periodo - 1];
      return { ...d, kg: p?.kg ?? d.kg, editado: false };
    }));
  }

  function setKgDia(index: number, valor: string) {
    setDias(prev => prev.map((d, i) => i === index ? { ...d, kg: valor, editado: true } : d));
  }

  function setPeriodoKg(index: number, valor: string) {
    setPeriodos(prev => prev.map((p, i) => i === index ? { kg: valor } : p));
  }

  function recalcular() {
    if (!lote) return;
    const trata = lote.trataDomingo ?? false;
    const novos = periodos.map((_, i) => {
      const diaInicioPeriodo = i * 15 + 1;
      return {
        kg: diaInicioPeriodo <= 30
          ? String(calcularPeriodo(lote.pesoEntrada, lote.quantidadeBois, i + 1, trata))
          : '',
      };
    });
    setPeriodos(novos);
  }

  async function salvar() {
    if (!lote) return;
    setErro('');
    const diasPreenchidos = dias.filter(d => d.kg && Number(d.kg) >= 0 && d.kg !== '');
    const diasComValor = diasPreenchidos.filter(d => Number(d.kg) > 0);
    if (diasComValor.length === 0) {
      setErro('Preencha pelo menos um período antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      // Salva todos os preenchidos — inclusive domingos com 0
      const dietaDias: DietaDia[] = diasPreenchidos.map(d => ({
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
      }, 800);
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <p className="text-gray-400">Carregando dieta...</p>
    </div>
  );
  if (!lote) return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-50 gap-4 px-8 text-center">
      <p className="text-4xl">⚠️</p>
      <p className="text-gray-600 font-semibold">Não foi possível carregar o lote.</p>
      <p className="text-gray-400 text-sm">Verifique sua conexão e tente novamente.</p>
      <button
        onClick={() => { setCarregando(true); carregarDieta(); }}
        className="bg-green-700 text-white font-bold px-8 py-3 rounded-xl"
      >
        Tentar novamente
      </button>
      <button onClick={() => router.back()} className="text-gray-400 text-sm underline mt-2">
        Voltar
      </button>
    </div>
  );

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const totalDias = dias.length;
  const numPeriodos = Math.ceil(totalDias / 15);
  const preenchidos = dias.filter(d => d.kg && Number(d.kg) > 0).length;
  const trata = lote.trataDomingo ?? false;

  // Quantos domingos existem no período total (para info)
  const numDomingos = dias.filter(d => isDomingo(d.data)).length;

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-700 px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          {!isNovo && (
            <button onClick={() => router.back()} className="text-green-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-white text-xl font-extrabold">{isNovo ? 'Configurar Dieta' : 'Editar Dieta'}</h1>
            <p className="text-green-200 text-xs">{lote.nome} · {totalDias} dias · {preenchidos}/{totalDias} preenchidos</p>
          </div>
        </div>
        {/* Badge domingo */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
          trata
            ? 'bg-green-600 text-green-100'
            : 'bg-orange-500/80 text-white'
        }`}>
          {trata ? '✅ Trata 7 dias/semana' : `☀️ Não trata domingo · ${numDomingos} domingos = 0 kg`}
        </div>
      </div>

      {/* Abas */}
      <div className="flex bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={() => setAbaAtiva('periodos')}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${abaAtiva === 'periodos' ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
          📐 Por Período
        </button>
        <button onClick={() => setAbaAtiva('dias')}
          className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${abaAtiva === 'dias' ? 'text-green-700 border-green-700' : 'text-gray-400 border-transparent'}`}>
          📅 Dia a Dia
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {abaAtiva === 'periodos' ? (
          <div className="px-4 py-4 space-y-4">
            {/* Fórmula */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-1">📐 FÓRMULA AUTOMÁTICA</p>
              {trata ? (
                <p className="text-xs text-blue-600 leading-relaxed">
                  Período 1: <strong>peso × 1% × bois</strong>{'\n'}
                  Cada período +15 dias adiciona <strong>+0,5 kg por boi/dia</strong>
                </p>
              ) : (
                <p className="text-xs text-blue-600 leading-relaxed">
                  Período 1: <strong>peso × 1% × (7÷6) × bois</strong>{'\n'}
                  Fator ×7÷6 compensa o domingo zerado · cada período +15 dias adiciona <strong>+0,5 kg por boi/dia</strong>
                </p>
              )}
              <div className="mt-2 bg-blue-100 rounded-xl p-2 text-xs text-blue-700">
                Base calculada:{' '}
                <strong>
                  {(lote.pesoEntrada * 0.01 * (trata ? 1 : 7 / 6)).toFixed(2)} kg/boi
                </strong>
                {' '}× {lote.quantidadeBois} bois ={' '}
                <strong>{calcularPeriodo(lote.pesoEntrada, lote.quantidadeBois, 1, trata)} kg/dia</strong>
              </div>
              <button onClick={recalcular}
                className="mt-3 w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-xl active:bg-blue-700">
                🔄 Recalcular pela fórmula
              </button>
            </div>

            {/* Períodos */}
            <div className="space-y-3">
              {Array.from({ length: numPeriodos }, (_, i) => {
                const diaInicio = i * 15 + 1;
                const diaFim = Math.min((i + 1) * 15, totalDias);
                const dataInicio = format(addDays(new Date(lote.dataInicio), diaInicio - 1), 'dd/MM');
                const dataFim = format(addDays(new Date(lote.dataInicio), diaFim - 1), 'dd/MM');
                const isManual = diaInicio > 30;
                const v = parseFloat(periodos[i]?.kg ?? '');
                return (
                  <div key={i} className={`rounded-2xl shadow-sm p-4 ${isManual ? 'bg-orange-50 border border-orange-200' : 'bg-white'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Período {i + 1}</p>
                        <p className="text-xs text-gray-400">Dias {diaInicio}–{diaFim} · {dataInicio} a {dataFim}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        isManual ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {isManual ? '✍️ Manual' : `${diaFim - diaInicio + 1} dias`}
                      </span>
                    </div>
                    {isManual && (
                      <p className="text-xs text-orange-600 mb-2">
                        Período após dia 30 — preencha manualmente conforme evolução do lote.
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={periodos[i]?.kg ?? ''}
                        onChange={e => setPeriodoKg(i, e.target.value)}
                        placeholder={isManual ? 'Preencher' : '0'}
                        min="0"
                        className={`flex-1 border-2 rounded-xl px-3 py-3 text-xl font-extrabold text-center focus:outline-none focus:ring-2 ${
                          isManual
                            ? 'border-orange-300 text-orange-700 bg-white focus:ring-orange-200'
                            : 'border-green-400 text-green-700 bg-green-50 focus:ring-green-300'
                        }`}
                      />
                      <span className="text-gray-400 font-semibold">kg/dia</span>
                    </div>
                    {!isNaN(v) && v > 0 && lote.quantidadeBois > 0 && (
                      <p className={`text-xs font-semibold text-center mt-2 ${isManual ? 'text-orange-600' : 'text-green-600'}`}>
                        ≈ {trata
                          ? (v / lote.quantidadeBois).toFixed(1)
                          : (v / lote.quantidadeBois / 7 * 6).toFixed(1)
                        } kg/boi/dia
                        {!trata && <span className="text-gray-400 font-normal"> (dias úteis)</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={aplicarPeriodos}
              className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl active:bg-green-800">
              ✓ Aplicar períodos a todos os dias
            </button>
          </div>
        ) : (
          <div>
            {/* Atalho rápido */}
            <div className="px-4 py-3 bg-white border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 mb-2">APLICAR UM VALOR A TODOS OS DIAS{!trata ? ' (exceto domingos)' : ''}</p>
              <div className="flex gap-2">
                <input id="atalho" type="number" placeholder="Ex: 1200"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={() => {
                  const val = (document.getElementById('atalho') as HTMLInputElement)?.value;
                  if (val && Number(val) > 0) {
                    setDias(prev => prev.map(d => {
                      if (!trata && isDomingo(d.data)) return d; // mantém 0 no domingo
                      return { ...d, kg: val, editado: true };
                    }));
                  }
                }} className="bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm active:bg-green-800">
                  Aplicar
                </button>
              </div>
            </div>

            {/* Lista dia a dia */}
            <div className="divide-y divide-gray-100">
              {dias.map((d, i) => {
                const isHoje = d.data === hoje;
                const isPast = d.data < hoje;
                const periodo = Math.ceil(d.dia / 15);
                const inicioPeriodo = d.dia % 15 === 1;
                const ehDom = !trata && isDomingo(d.data);
                return (
                  <div key={d.data}>
                    {inicioPeriodo && (
                      <div className="bg-gray-100 px-4 py-1.5">
                        <p className="text-xs font-bold text-gray-500">PERÍODO {periodo} — Dias {(periodo - 1) * 15 + 1}–{Math.min(periodo * 15, totalDias)}</p>
                      </div>
                    )}
                    {ehDom ? (
                      /* Linha de domingo bloqueada */
                      <div className="flex items-center gap-3 px-4 py-3 bg-orange-50/50 opacity-70">
                        <div className="w-16 text-center flex-shrink-0">
                          <p className="text-sm font-bold text-orange-400">Dia {d.dia}</p>
                          <p className="text-xs text-gray-400">{format(new Date(d.data + 'T12:00:00'), 'dd/MM')}</p>
                          <span className="text-xs text-orange-500 font-bold">Dom</span>
                        </div>
                        <div className="flex-1 bg-orange-100 border border-orange-200 rounded-xl px-3 py-2.5 text-center">
                          <span className="text-orange-500 text-xs font-bold">☀️ Sem trato — 0 kg</span>
                        </div>
                      </div>
                    ) : (
                      /* Linha normal */
                      <div className={`flex items-center gap-3 px-4 py-3 ${isHoje ? 'bg-green-50' : 'bg-white'}`}>
                        <div className="w-16 text-center flex-shrink-0">
                          <p className={`text-sm font-bold ${isHoje ? 'text-green-700' : isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                            Dia {d.dia}
                          </p>
                          <p className="text-xs text-gray-400">{format(new Date(d.data + 'T12:00:00'), 'dd/MM')}</p>
                          {isHoje && <span className="text-xs text-green-600 font-bold">Hoje</span>}
                        </div>
                        <input
                          type="number"
                          value={d.kg}
                          onChange={e => setKgDia(i, e.target.value)}
                          placeholder="0"
                          min="0"
                          className={`flex-1 border rounded-xl px-3 py-2.5 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-green-500
                            ${d.editado ? 'border-blue-300 bg-blue-50' : isHoje ? 'border-green-400 bg-white' : 'border-gray-200 bg-white'}`}
                        />
                        <div className="flex-shrink-0 text-right w-14">
                          <span className="text-gray-400 text-sm block">kg</span>
                          {(() => {
                            const v = parseFloat(d.kg);
                            if (!isNaN(v) && v > 0 && lote.quantidadeBois > 0) {
                              const kgBoi = trata
                                ? v / lote.quantidadeBois
                                : v / lote.quantidadeBois / 7 * 6;
                              return (
                                <span className="text-green-600 text-xs font-semibold leading-tight">
                                  {kgBoi.toFixed(1)}<br/>
                                  <span className="text-gray-400 font-normal">kg/b/d</span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé fixo */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
        {erro && <p className="text-red-500 text-sm text-center mb-2">{erro}</p>}
        {salvo && <p className="text-green-600 text-sm text-center mb-2 font-semibold">✓ Dieta salva!</p>}
        {!salvo && !salvando && preenchidos < totalDias && (
          <p className="text-xs text-gray-400 text-center mb-2">
            {preenchidos} de {totalDias} dias preenchidos · os demais serão ajustados conforme leitura de cocho
          </p>
        )}
        <button onClick={salvar} disabled={salvando || salvo || preenchidos === 0}
          className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-60 active:bg-green-800">
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : preenchidos === 0 ? 'Preencha ao menos um período' : `Salvar dieta (${preenchidos} dias)`}
        </button>
      </div>
    </div>
  );
}
