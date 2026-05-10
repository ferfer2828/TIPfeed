'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SplashScreen from './components/SplashScreen';

export default function Home() {
  const { usuario, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (!usuario) router.replace('/login');
    else if (usuario.perfil === 'gerente') router.replace('/gerente');
    else router.replace('/peao');
  }, [usuario, carregando, router]);

  return <SplashScreen />;
}
