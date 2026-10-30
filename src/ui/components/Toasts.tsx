import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type ToastKind = 'ok' | 'info' | 'warn';
interface ToastItem { id: number; title: string; body?: string; kind: ToastKind }
interface ToastApi { toast: (title: string, body?: string, kind?: ToastKind) => void; history: ToastItem[] }

const Ctx = createContext<ToastApi | undefined>(undefined);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<ToastItem[]>([]);
  const [history, setHistory] = useState<ToastItem[]>([]);

  const toast = useCallback((title: string, body?: string, kind: ToastKind = 'info') => {
    const item = { id: ++seq, title, body, kind };
    setVisible((v) => [...v, item]);
    setHistory((h) => [item, ...h].slice(0, 20));
    setTimeout(() => setVisible((v) => v.filter((x) => x.id !== item.id)), 4200);
  }, []);

  const value = useMemo(() => ({ toast, history }), [toast, history]);
  const icon: Record<ToastKind, string> = { ok: 'task_alt', info: 'notifications_active', warn: 'warning' };
  const tone: Record<ToastKind, string> = {
    ok: 'bg-secondary-container text-on-secondary-container',
    info: 'bg-on-surface text-surface-card',
    warn: 'bg-alert-coral text-white',
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed top-4 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {visible.map((t) => (
          <div key={t.id} className={`animate-slideup max-w-sm w-full rounded-2xl shadow-level-3 px-4 py-3 flex items-start gap-3 ${tone[t.kind]}`}>
            <Icon name={icon[t.kind]} fill className="text-[22px] mt-0.5" />
            <div className="min-w-0">
              <p className="font-label-lg text-label-lg font-bold">{t.title}</p>
              {t.body && <p className="text-label-sm opacity-90">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToasts(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToasts fuera de ToastProvider');
  return v;
}
