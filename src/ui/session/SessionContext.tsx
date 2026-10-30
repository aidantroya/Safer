import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@/domain/model';
import { app } from '@/api';
import { resetCoordinatorApi } from '@/api/coordinatorApi';
import { supabase } from '@/data/datasource/supabaseClient';
import { SupabaseAuth, type RemoteSession } from '@/data/remote/SupabaseAuth';

interface SessionValue {
  user: User | undefined;
  ready: boolean;
  /** 'supabase' si la sesión es una cuenta real de Supabase Auth; 'demo' si es de los datos en memoria. */
  backend: 'demo' | 'supabase';
  /** Con cuenta real: si la base le reconoce el rol de Coordinación (puede guardar el plan). */
  isCoordinator: boolean;
  loginPassenger: (email: string, password: string) => Promise<string | undefined>;
  loginDriver: (email: string, password: string) => Promise<{ user?: User; error?: string }>;
  loginCoordinator: (email: string, password: string) => Promise<string | undefined>;
  /** Login real (Supabase Auth). Devuelve el error o undefined. */
  loginRemote: (identifier: string, password: string) => Promise<string | undefined>;
  /** Registro real. 'confirmar_correo' si Supabase pide confirmar antes de entrar. */
  signUpRemote: (fullName: string, email: string, password: string) => Promise<string | 'confirmar_correo' | undefined>;
  logout: () => void;
}

const Ctx = createContext<SessionValue | undefined>(undefined);
const KEY = 'bustrack.session.userId';
const REMOTE_KEY = 'bustrack.session.remote';
export const TRIP_KEY = 'bustrack.driver.tripId';

const remoteAuth = supabase && new SupabaseAuth(supabase);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState<RemoteSession>();

  useEffect(() => {
    if (sessionStorage.getItem(REMOTE_KEY) && remoteAuth) {
      void remoteAuth.restore().then((s) => {
        setRemote(s);
        setUser(s?.user);
        setReady(true);
      }, () => setReady(true));
      return;
    }
    const id = sessionStorage.getItem(KEY);
    if (!id) return setReady(true);
    void app.auth.getUser(id).then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const finish = useCallback((res: Awaited<ReturnType<typeof app.auth.loginPassenger>>) => {
    if (!res.ok) return res.error;
    sessionStorage.removeItem(REMOTE_KEY);
    sessionStorage.setItem(KEY, res.data.id);
    setRemote(undefined);
    setUser(res.data);
    return undefined;
  }, []);

  const startRemote = useCallback((s: RemoteSession) => {
    resetCoordinatorApi();
    sessionStorage.removeItem(KEY);
    sessionStorage.setItem(REMOTE_KEY, '1');
    setRemote(s);
    setUser(s.user);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      backend: remote ? 'supabase' : 'demo',
      isCoordinator: remote?.isCoordinator ?? false,
      loginPassenger: async (e, p) => finish(await app.auth.loginPassenger(e, p)),
      loginDriver: async (e, p) => {
        const res = await app.auth.loginDriver(e, p);
        const error = finish(res);
        return error ? { error } : { user: res.ok ? res.data : undefined };
      },
      loginCoordinator: async (e, p) => finish(await app.auth.loginCoordinator(e, p)),
      loginRemote: async (identifier, password) => {
        if (!remoteAuth) return 'Supabase no está configurado (.env.local).';
        try {
          startRemote(await remoteAuth.signIn(identifier, password));
          return undefined;
        } catch (e) {
          return e instanceof Error ? e.message : 'No se pudo iniciar sesión.';
        }
      },
      signUpRemote: async (fullName, email, password) => {
        if (!remoteAuth) return 'Supabase no está configurado (.env.local).';
        try {
          const s = await remoteAuth.signUp(fullName, email, password);
          if (s === 'confirmar_correo') return s;
          startRemote(s);
          return undefined;
        } catch (e) {
          return e instanceof Error ? e.message : 'No se pudo crear la cuenta.';
        }
      },
      logout: () => {
        if (remote) void remoteAuth?.signOut();
        resetCoordinatorApi();
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(REMOTE_KEY);
        sessionStorage.removeItem(TRIP_KEY);
        setRemote(undefined);
        setUser(undefined);
      },
    }),
    [user, ready, remote, finish, startRemote],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fuera de SessionProvider');
  return v;
}
