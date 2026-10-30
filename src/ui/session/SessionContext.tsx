import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@/domain/model';
import { app } from '@/api';

interface SessionValue {
  user: User | undefined;
  ready: boolean;
  loginPassenger: (email: string, password: string) => Promise<string | undefined>;
  loginDriver: (email: string, password: string) => Promise<{ user?: User; error?: string }>;
  loginCoordinator: (email: string, password: string) => Promise<string | undefined>;
  logout: () => void;
}

const Ctx = createContext<SessionValue | undefined>(undefined);
const KEY = 'bustrack.session.userId';
export const TRIP_KEY = 'bustrack.driver.tripId';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem(KEY);
    if (!id) return setReady(true);
    void app.auth.getUser(id).then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const finish = useCallback((res: Awaited<ReturnType<typeof app.auth.loginPassenger>>) => {
    if (!res.ok) return res.error;
    sessionStorage.setItem(KEY, res.data.id);
    setUser(res.data);
    return undefined;
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      loginPassenger: async (e, p) => finish(await app.auth.loginPassenger(e, p)),
      loginDriver: async (e, p) => {
        const res = await app.auth.loginDriver(e, p);
        const error = finish(res);
        return error ? { error } : { user: res.ok ? res.data : undefined };
      },
      loginCoordinator: async (e, p) => finish(await app.auth.loginCoordinator(e, p)),
      logout: () => {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(TRIP_KEY);
        setUser(undefined);
      },
    }),
    [user, ready, finish],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fuera de SessionProvider');
  return v;
}
