import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Bus } from '@/domain/model';
import { Icon } from './Icon';

/** QR fijo de la unidad: se imprime y se pega en la puerta; el estudiante lo escanea al subir y al bajar. */
export function BusQrDialog({ bus, onClose }: { bus: Bus; onClose: () => void }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    void QRCode.toString(bus.unitCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [bus.unitCode]);

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="busqr-title" className="relative w-full max-w-sm bg-surface-card rounded-3xl p-6 shadow-level-3 border border-outline-variant/30 text-center animate-slideup">
        <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute right-3 top-3 w-10 h-10 rounded-full hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant">
          <Icon name="close" />
        </button>
        <h2 id="busqr-title" className="text-headline-sm font-bold text-on-surface">QR del Bus #{bus.number}</h2>
        <p className="text-body-sm text-on-surface-variant mt-1">Pégalo en la puerta. Los estudiantes lo escanean al subir y al bajar.</p>
        {/* siempre sobre blanco: el lector necesita contraste también en tema oscuro */}
        <div className="mt-4 mx-auto w-60 h-60 p-3 bg-white rounded-2xl text-slate-950 [&>svg]:w-full [&>svg]:h-full" role="img" aria-label={`Código QR del Bus ${bus.number}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 font-mono text-label-lg font-bold text-on-surface tracking-wide select-all">{bus.unitCode}</p>
        <p className="text-label-sm text-on-surface-variant">Código para escribir a mano si la cámara falla • Placa {bus.plate || '—'}</p>
        <button type="button" onClick={() => window.print()} className="mt-4 w-full h-11 rounded-full border border-outline-variant/50 text-primary text-label-lg font-bold flex items-center justify-center gap-2">
          <Icon name="print" className="text-[20px]" /> Imprimir
        </button>
      </div>
    </div>
  );
}
