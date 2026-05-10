'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Usuario } from '@/types';

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  carregando: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Tenta buscar o perfil no Firestore com timeout de 8 segundos
          const snap = await Promise.race([
            getDoc(doc(db, 'usuarios', firebaseUser.uid)),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 8000)
            ),
          ]) as any;

          if (snap && snap.exists()) {
            setUsuario(snap.data() as Usuario);
          } else {
            // Documento não encontrado — aguarda um pouco e tenta de novo
            await new Promise(r => setTimeout(r, 2000));
            const snap2 = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
            if (snap2.exists()) {
              setUsuario(snap2.data() as Usuario);
            } else {
              setUsuario(null);
            }
          }
        } catch {
          // Se falhar, aguarda e tenta mais uma vez
          try {
            await new Promise(r => setTimeout(r, 3000));
            const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
            if (snap.exists()) {
              setUsuario(snap.data() as Usuario);
            } else {
              setUsuario(null);
            }
          } catch {
            setUsuario(null);
          }
        }
      } else {
        setUsuario(null);
      }
      setCarregando(false);
    });
    return unsub;
  }, []);

  async function signOut() {
    await firebaseSignOut(auth);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
