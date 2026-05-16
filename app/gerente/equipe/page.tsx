'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { criarConvite, listarPeoes, listarConvites, getNomeFazenda } from '@/lib/convites';
import { getFazenda, salvarFazenda } from '@/lib/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Fazenda } from '@/types';

export default function EquipePage() {
  const { usuario } = useAuth();
  const [peoes, setPeoes] = useState<any[]>([]);
  const [convites, setConvites] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [erroConvite, setErroConvite] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [aba, setAba] = useState<'peoes' | 'convites' | 'fazenda'>('peoes');

  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [editNomeFazenda, setEditNomeFazenda] = useState('');
  const [editLocalizacao, setEditLocalizacao] = useState('');
  const [salvandoFazenda, setSalvandoFazenda] = useState(false);
  const [salvoFazenda, setSalvoFazenda] = useState(false);
  const [erroFazenda, setErroFazenda] = useState('');

  async function carregar() {
    if (!usuario) return;
    try {
      const [p, c, faz] = await Promise.all([
        listarPeoes(usuario.fazendaId),
        listarConvites(usuario.fazendaId),
        getFazenda(usuario.fazendaId),
      ]);
      setPeoes(p);
      setConvites(c);
      if (faz) {
        setFazenda(faz);
        setEditNomeFazenda(faz.nome);
        setEditLocalizacao(faz.localizacao ?? '');
      }
    } catch (e) {
      console.error('Erro ao carregar equipe:', e);
    } finally {
      setCarregando(false);
    }
  }

  async function salvarConfigFazenda() {
    if (!usuario || !editNomeFazenda.trim()) return;
    setSalvandoFazenda(true);
    setErroFazenda('');
    try {
      const faz: Fazenda = {
        id: usuario.fazendaId,
        nome: editNomeFazenda.trim(),
        localizacao: editLocalizacao.trim() || undefined,
        donoUid: usuario.uid,
        criadoEm: fazenda?.criadoEm ?? new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarFazenda(faz);
      setFazenda(faz);
      setSalvoFazenda(true);
      setTimeout(() => setSalvoFazenda(false), 2500);
    } catch {
      setErroFazenda('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvandoFazenda(false);
    }
  }

  useEffect(() => { carregar(); }, [usuario]);

  function linkConvite(codigo: string) {
    return `${window.location.origin}/convite/${codigo}`;
  }

  async function copiarLink(codigo: string, idRef?: string) {
    try {
      await navigator.clipboard.writeText(linkConvite(codigo));
      if (idRef) {
        setCopiadoId(idRef);
        setTimeout(() => setCopiadoId(null), 2000);
      } else {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch {
      // fallback silencioso
    }
  }

  async function gerarConvite() {
    if (!usuario) return;
    setGerando(true);
    setErroConvite('');
    try {
      const fazendaNome = await getNomeFazenda(usuario.fazendaId);
      const codigo = await criarConvite(usuario.fazendaId, fazendaNome, usuario.uid);
      setCodigoGerado(codigo);
      carregar();
    } catch (e: any) {
      setErroConvite(e?.message ?? 'Erro ao gerar convite. Tente novamente.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-extrabold">Equipe</h1>
        <p className="text-green-200 text-xs mt-0.5">Peões e convites</p>
      </div>

      {/* Gerar convite */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="font-bold text-gray-800 mb-1">Convidar peão</h2>
          <p className="text-xs text-gray-400 mb-3">
            Gere um link e compartilhe com o peão. Válido por 7 dias.
          </p>
          <button
            onClick={gerarConvite}
            disabled={gerando}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-60 active:bg-green-800"
          >
            {gerando ? 'Gerando...' : '+ Gerar link de convite'}
          </button>

          {erroConvite && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-600 font-semibold">⚠️ {erroConvite}</p>
            </div>
          )}

          {codigoGerado && (
            <div className="mt-4 bg-green-50 border-2 border-green-400 rounded-2xl p-4">
              <p className="text-xs text-green-600 font-semibold mb-2 text-center">🔗 LINK GERADO</p>
              <p className="text-xs text-gray-600 break-all bg-white border border-green-200 rounded-xl px-3 py-2 mb-3 font-mono">
                {linkConvite(codigoGerado)}
              </p>
              <button
                onClick={() => copiarLink(codigoGerado)}
                className="w-full bg-green-700 text-white font-bold py-2.5 rounded-xl active:bg-green-800 text-sm"
              >
                {copiado ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <p className="text-xs text-green-600 mt-2 text-center">
                Envie este link ao peão para ele se cadastrar
              </p>
              <button
                onClick={() => setCodigoGerado(null)}
                className="mt-2 w-full text-xs text-gray-400 underline"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex bg-white rounded-2xl p-1 mb-4 shadow-sm">
          <button onClick={() => setAba('peoes')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${aba === 'peoes' ? 'bg-green-700 text-white' : 'text-gray-400'}`}>
            Peões ({peoes.length})
          </button>
          <button onClick={() => setAba('convites')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${aba === 'convites' ? 'bg-green-700 text-white' : 'text-gray-400'}`}>
            Convites ({convites.length})
          </button>
          <button onClick={() => setAba('fazenda')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${aba === 'fazenda' ? 'bg-green-700 text-white' : 'text-gray-400'}`}>
            🏡 Fazenda
          </button>
        </div>

        {carregando ? (
          <p className="text-center text-gray-400 py-6">Carregando...</p>
        ) : aba === 'fazenda' ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-green-700 tracking-widest mb-3">DADOS DA FAZENDA</p>
              <div className="space-y-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">Nome da fazenda</label>
                  <input
                    type="text"
                    value={editNomeFazenda}
                    onChange={e => setEditNomeFazenda(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Fazenda Santa Maria"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">Localização (opcional)</label>
                  <input
                    type="text"
                    value={editLocalizacao}
                    onChange={e => setEditLocalizacao(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Ribeirão Preto - SP"
                  />
                </div>
              </div>
              {erroFazenda && <p className="text-red-500 text-xs mb-2">{erroFazenda}</p>}
              {salvoFazenda && <p className="text-green-600 text-xs mb-2 font-semibold">✓ Fazenda atualizada!</p>}
              <button
                onClick={salvarConfigFazenda}
                disabled={salvandoFazenda || !editNomeFazenda.trim()}
                className="w-full bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:bg-green-800 text-sm"
              >
                {salvandoFazenda ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
            {fazenda && (
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-400">ID da fazenda: <span className="font-mono text-gray-500">{fazenda.id.slice(0, 12)}…</span></p>
              </div>
            )}
          </div>
        ) : aba === 'peoes' ? (
          peoes.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">👨‍🌾</p>
              <p className="text-gray-400">Nenhum peão cadastrado ainda.</p>
              <p className="text-gray-400 text-sm">Gere um convite acima.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {peoes.map(p => (
                <div key={p.uid} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-lg">
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">{p.nome}</p>
                    <p className="text-xs text-gray-400">{p.email}</p>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Peão</span>
                </div>
              ))}
            </div>
          )
        ) : (
          convites.length === 0 ? (
            <p className="text-center text-gray-400 py-6">Nenhum convite gerado.</p>
          ) : (
            <div className="space-y-2">
              {convites.map(c => {
                const expirado = new Date() > new Date(c.expiresAt);
                const status = c.usado ? 'usado' : expirado ? 'expirado' : 'ativo';
                return (
                  <div key={c.codigo} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-gray-700 text-xs tracking-widest font-mono">{c.codigo}</p>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        status === 'ativo' ? 'bg-green-100 text-green-700' :
                        status === 'usado' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {status === 'ativo' ? '✓ Ativo' : status === 'usado' ? '✓ Usado' : '✕ Expirado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Criado em {format(new Date(c.criadoEm), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                    {!c.usado && !expirado && (
                      <>
                        <p className="text-xs text-orange-500 mt-0.5">
                          Expira em {format(new Date(c.expiresAt), "dd/MM/yyyy")}
                        </p>
                        <button
                          onClick={() => copiarLink(c.codigo, c.codigo)}
                          className="mt-2 w-full border border-green-600 text-green-700 text-xs font-bold py-2 rounded-xl active:bg-green-50"
                        >
                          {copiadoId === c.codigo ? '✓ Copiado!' : '📋 Copiar link'}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
