import { useEffect } from 'react';
import { beep } from '../lib/sound';
import { haptic } from '../lib/haptics';
import { Icon } from './Icon';

interface Props {
  stopName: string;
  minutes: number;
  onStop: () => void;
}

/** Alarma "No te duermas": pantalla completa + sonido + vibración hasta que el usuario la apaga. */
export function WakeUpAlarm({ stopName, minutes, onStop }: Props) {
  useEffect(() => {
    const ring = () => { beep(880, 250); haptic.alarm(); };
    ring();
    const id = setInterval(ring, 1300);
    return () => { clearInterval(id); navigator.vibrate?.(0); };
  }, []);

  return (
    <div role="alertdialog" aria-labelledby="wake-title" className="fixed inset-0 z-[80] bg-alert-coral text-white flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center animate-wiggle">
        <Icon name="alarm" fill className="text-[72px]" />
      </div>
      <h2 id="wake-title" className="text-headline-lg mt-2">¡No te duermas!</h2>
      <p className="text-body-lg font-semibold">Tu parada <span className="underline">{stopName}</span> está a ~{minutes} min.</p>
      <button type="button" onClick={onStop} className="mt-6 w-full max-w-xs min-h-[56px] rounded-full bg-white text-alert-coral text-headline-sm font-bold active:scale-[0.985]">
        Ya estoy despierto
      </button>
    </div>
  );
}
