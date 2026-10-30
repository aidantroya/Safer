import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Icon } from './Icon';

type CamState = 'iniciando' | 'activa' | 'denegada' | 'sin_camara';

/**
 * Lector de QR con la cámara trasera. Llama a `onResult` una vez por código leído
 * (no repite el mismo código en 3 s). La cámara sólo funciona en https o localhost.
 */
export function QrScanner({ onResult, paused = false }: { onResult: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ text: string; at: number }>();
  const handler = useRef(onResult);
  handler.current = onResult;
  const [state, setState] = useState<CamState>('iniciando');

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let alive = true;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('sin_camara');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        return setState(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denegada' : 'sin_camara');
      }
      if (!alive || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setState('activa');

      timer = setInterval(() => {
        const v = video.current;
        const c = canvas.current;
        if (!v || !c || v.readyState < 2) return;
        // se lee una versión reducida del cuadro: más rápido y alcanza para un QR a la vista
        const scale = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
        if (!code?.data) return;
        const now = Date.now();
        if (last.current && last.current.text === code.data && now - last.current.at < 3000) return;
        last.current = { text: code.data, at: now };
        handler.current(code.data);
      }, 180);
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [paused]);

  return (
    <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-secondary/40 shadow-inner">
      <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" aria-label="Vista de la cámara" />
      <canvas ref={canvas} className="hidden" />

      {state === 'activa' && !paused && (
        <>
          <div className="absolute inset-[14%] rounded-2xl border-[3px] border-white/85 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
          <div className="absolute inset-x-[16%] h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-laser" />
        </>
      )}

      {state !== 'activa' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-2 text-white">
          <Icon name={state === 'iniciando' ? 'photo_camera' : 'no_photography'} className="text-[40px] opacity-90" />
          <p className="text-label-lg font-bold">
            {state === 'iniciando' ? 'Abriendo la cámara…' : state === 'denegada' ? 'Permiso de cámara denegado' : 'Cámara no disponible'}
          </p>
          {state !== 'iniciando' && (
            <p className="text-label-sm opacity-80">
              {state === 'denegada'
                ? 'Actívalo en la configuración del navegador o escribe el código del bus abajo.'
                : 'Abre la app por https en tu celular, o escribe el código del bus abajo.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
