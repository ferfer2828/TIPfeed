'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const tabs = [
  { href: '/peao', label: 'Início', icon: HomeIcon },
  { href: '/peao/historico', label: 'Histórico', icon: HistoricoIcon },
];

export default function PeaoLayout({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!carregando && (!usuario || usuario.perfil !== 'peao')) {
      router.replace('/login');
    }
  }, [usuario, carregando, router]);

  if (carregando || !usuario) {
    return (
      <div className="flex h-full items-center justify-center bg-green-800">
        <p className="text-white text-lg">Carregando...</p>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === '/peao') return pathname === '/peao';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto pb-16">
        {children}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition
                ${active ? 'text-green-700' : 'text-gray-400'}`}
            >
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#15803d' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function HistoricoIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#15803d' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
}
