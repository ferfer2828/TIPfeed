'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { criarConvite, listarPeoes, listarConvites } from '@/lib/convites';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EquipePage() {
  const { usuario } = useAuth();
  const [peoes, setPeoes] = useState<any[]>([]);
  const [convites, setConvites] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [aba, setAba] = useState<'peoes' | 'convites'>('peoes');

  async function carregar() {
    if (!usuario) return;
    const [p, c] = await Promise.all([
      listarPeoes(usuario.fazendaId),
      listarConvites(usuario.fazendaId),
    ]);
    setPeoes(p);
    setConvites(c);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [usuario]);

  async function gerarConvite() {
    if (!usuario) return;
    setGerando(true);
    try {
      const fazendaNome = 'Fazenda'; // buscado via contexto
      const codigo = await criarConvite(usuario.fazendaId, fazendaNome, usuario.uid);
      setCodigoGerado(codigo);
      carregar();
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
            Gere um código de 6 dígitos e passe ao peão. Válido por 7 dias.
          </p>
          <button
            onClick={gerarConvite}
            disabled={gerando}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-60 active:bg-green-800"
          >
            {gerando ? 'Gerando...' : '+ Gerar código de convite'}
          </button>

          {codigoGerado && (
            <div className="mt-4 bg-green-50 border-2 border-green-400 rounded-2xl p-4 text-center">
              <p className="text-xs text-green-600 font-semibold mb-2">CÓDIGO GERADO</p>
              <p className="text-5xl font-extrabold text-green-700 tracking-widest">
                {codigoGerado}
              </p>
              <p className="text-xs text-green-600 mt-2">
                Passe este código para o peão se cadastrar no app
              </p>
              <button
                onClick={() => setCodigoGerado(null)}
                className="mt-3 text-xs text-gray-400 underline"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex bg-white rounded-2xl p-1 mb-4 shadow-sm">
          <button
            onClick={() => setAba('peoes')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${aba === 'peoes' ? 'bg-green-700 text-white' : 'text-gray-400'}`}
          >
            Peões ({peoes.length})
          </button>
          <button
            onClick={() => setAba('convites')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${aba === 'convites' ? 'bg-green-700 text-white' : 'text-gray-400'}`}
          >
            Convites ({convites.length})
          </button>
        </div>

        {carregando ? (
          <p className="text-center text-gray-400 py-6">Carregando...</p>
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
                    <div className="flex justify-between items-center">
                      <p className="font-extrabold text-gray-800 text-xl tracking-widest">{c.codigo}</p>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        status === 'ativo' ? 'bg-green-100 text-green-700' :
                        status === 'usado' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {status === 'ativo' ? '✓ Ativo' : status === 'usado' ? '✓ Usado' : '✕ Expirado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Criado em {format(new Date(c.criadoEm), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                    {!c.usado && !expirado && (
                      <p className="text-xs text-orange-500 mt-0.5">
                        Expira em {format(new Date(c.expiresAt), "dd/MM/yyyy")}
                      </p>
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
