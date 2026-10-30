import { useEffect, useRef } from 'react';

/** Ejecuta `fn` ahora y luego cada `ms`. Evita solapes si una llamada tarda más que el intervalo. */
export function usePolling(fn: () => Promise<void> | void, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let busy = false;
    const tick = async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        await ref.current();
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ms, enabled]);
}
