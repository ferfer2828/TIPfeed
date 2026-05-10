'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { usuario, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (!usuario) router.replace('/login');
    else if (usuario.perfil === 'gerente') router.replace('/gerente');
    else router.replace('/peao');
  }, [usuario, carregando, router]);

  return (
    <div className="flex h-full items-center justify-center bg-green-800">
      <div className="text-center">
        <div className="text-6xl mb-4">🐄</div>
        <p className="text-white text-xl font-bold">Trato Bovino</p>
      </div>
    </div>
  );
}
