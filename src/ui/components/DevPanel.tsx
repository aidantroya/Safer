import { useState } from 'react';
import { app } from '@/api';
import { Icon } from './Icon';
import { useToasts } from './Toasts';

interface Props {
  routeId: string;
  boardIndex?: number;
  dropIndex?: number;
  onChanged?: () => void;
}

/** Panel de demostración: controla la simulación para poder presentar sin buses reales. */
export function DevPanel({ routeId, boardIndex = 3, dropIndex = 5, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(app.admin.getSimulationSpeed());
  const { toast } = useToasts();

  const setSim = (n: number) => { app.admin.demoSetSpeed(n); setSpeed(n); };
  const run = async (fn: () => Promise<void> | void, msg: string) => {
    await fn();
    toast('Demo', msg);
    onChanged?.();
  };

  return (
    <>
      <button type="button" aria-label="Abrir panel de demostración" onClick={() => setOpen(true)} className="fixed right-3 top-16 z-[55] opacity-70 w-11 h-11 rounded-full bg-on-surface text-white shadow-level-3 flex items-center justify-center active:scale-95">
        <Icon name="tune" className="text-[22px]" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Panel de demostración" className="animate-slideup relative w-full max-w-md bg-white rounded-t-[28px] p-5 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-headline-sm font-bold">Panel de demostración</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center"><Icon name="close" /></button>
            </div>
            <p className="text-body-sm text-text-muted mb-4">Simula el GPS del bus. En producción esto lo reemplaza la app del conductor.</p>

            <p className="text-label-md font-semibold text-text-muted mb-1.5">Velocidad de la simulación</p>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {[{ l: 'Pausa', v: 0 }, { l: '×1', v: 1 }, { l: '×5', v: 5 }, { l: '×10', v: 10 }, { l: '×30', v: 30 }].map((o) => (
                <button key={o.v} type="button" aria-pressed={speed === o.v} onClick={() => setSim(o.v)} className={`min-h-[44px] rounded-xl text-label-lg ${speed === o.v ? 'bg-primary-container text-white' : 'bg-surface-container-low text-text-main'}`}>{o.l}</button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" className="min-h-[48px] rounded-2xl border border-outline-variant text-label-lg active:bg-surface-container-low" onClick={() => run(() => app.admin.demoMoveTripNearStop(routeId, boardIndex, 500), 'Bus a 500 m de tu parada')}>
                Acercar el bus a mi parada de subida
              </button>
              <button type="button" className="min-h-[48px] rounded-2xl border border-outline-variant text-label-lg active:bg-surface-container-low" onClick={() => run(() => app.admin.demoMoveTripNearStop(routeId, dropIndex, 1500), 'Bus a 1,5 km de tu bajada')}>
                Acercar el bus a mi bajada (probar alarma)
              </button>
              <button type="button" className="min-h-[48px] rounded-2xl border border-outline-variant text-label-lg active:bg-surface-container-low" onClick={() => run(() => app.admin.demoFillBus(routeId, 3), 'Bus con 3 asientos libres')}>
                Dejar el bus casi lleno
              </button>
              <button type="button" className="min-h-[48px] rounded-2xl bg-alert-coral/10 text-alert-coral text-label-lg active:bg-alert-coral/20" onClick={() => run(() => app.admin.demoReset(), 'Datos reiniciados')}>
                Reiniciar la demo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
