import { useState } from 'react';
import { app } from '@/api';
import type { PendingReview } from '@/service/PassengerService';
import { NEGATIVE_TAGS, POSITIVE_TAGS, RATING_LABELS } from '@/service/ReviewService';
import { haptic } from '../lib/haptics';
import { Icon } from './Icon';
import { useToasts } from './Toasts';

interface Props {
  review: PendingReview;
  userId: string;
  onDone: () => void;
}

/** Pantalla "Calificación del viaje" (bottom sheet). Se abre sola al llegar o cuando el conductor cierra el viaje. */
export function ReviewSheet({ review, userId, onDone }: Props) {
  const { toast } = useToasts();
  const [rating, setRating] = useState(0); // a propósito sin preselección: una estrella por defecto sesga el promedio
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [pop, setPop] = useState(0);
  const [busy, setBusy] = useState(false);

  const tagList = rating > 0 && rating <= 3 ? NEGATIVE_TAGS : POSITIVE_TAGS;
  const tagTitle = rating > 0 && rating <= 3 ? '¿Qué podemos mejorar?' : '¿Qué destacó positivamente?';

  const send = async () => {
    setBusy(true);
    const res = await app.passenger.submitReview({ tripId: review.tripId, passengerId: userId, rating, tags, comment });
    setBusy(false);
    if (!res.ok) return toast('No se pudo enviar', res.error, 'warn');
    haptic.success();
    toast('¡Gracias por tu feedback!', undefined, 'ok');
    onDone();
  };

  const skip = () => {
    app.passenger.skipReview(review.tripId, userId);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={skip} />
      <div role="dialog" aria-modal="true" aria-label="Califica tu viaje" className="animate-slideup relative w-full max-w-xl bg-surface-card rounded-t-[32px] shadow-2xl max-h-[92vh] overflow-y-auto border border-outline-variant/30">
        <div className="w-full flex justify-center pt-3 pb-1"><div className="w-12 h-1.5 bg-slate-300 rounded-full" /></div>
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-4 shadow-sm ring-4 ring-secondary-container/40">
            <Icon name="check_circle" fill className="text-3xl" />
          </div>
          <h1 className="text-headline-md text-text-main mb-1.5">¡Has llegado a tu destino!</h1>
          <p className="text-body-md text-text-muted max-w-md mb-3">
            ¿Cómo calificarías tu viaje en la <span className="font-semibold text-text-main">{review.routeName}</span>?
          </p>
          <div className="inline-flex items-center gap-2 bg-surface-container-low px-3.5 py-1.5 rounded-full border border-outline-variant/40 mb-6">
            <Icon name="directions_bus" className="text-primary text-base" />
            <span className="text-label-sm text-on-surface-variant font-medium">
              Bus #{review.busNumber} • Chofer: {review.driverName} • {review.minutes} min de trayecto
            </span>
          </div>

          <div className="w-full flex flex-col items-center bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-5">
            <div role="radiogroup" aria-label="Calificación con estrellas" className="flex items-center justify-center gap-1 sm:gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                  onClick={() => { setRating(n); setTags([]); setPop(n); haptic.light(); }}
                  className={`w-11 h-11 flex items-center justify-center rounded-xl hover:bg-amber-50 active:scale-95 transition-all ${n <= rating ? 'text-amber-500' : 'text-slate-300'} ${pop === n ? 'star-pop' : ''}`}
                  onAnimationEnd={() => setPop(0)}
                >
                  <Icon name="star" fill={n <= rating} className="text-4xl" />
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/30 text-on-secondary-container text-label-lg">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span>{rating ? RATING_LABELS[rating] : 'Toca una estrella'}</span>
            </div>

            {rating > 0 && (
              <div className="w-full mt-5">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2.5 text-left">{tagTitle}</p>
                <div className="flex flex-wrap gap-2 justify-start">
                  {tagList.map((t) => {
                    const on = tags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTags(on ? tags.filter((x) => x !== t.id) : [...tags, t.id])}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-label-sm transition-all duration-150 active:scale-95 ${
                          on ? 'border-secondary-container bg-secondary-container/20 text-on-secondary-container' : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span aria-hidden="true">{t.emoji}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="w-full mt-4 text-left">
              <label htmlFor="feedback-comment" className="block text-xs font-medium text-text-muted mb-1.5">Comentarios adicionales</label>
              <textarea
                id="feedback-comment" rows={3} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Deja un comentario sobre el conductor o la unidad (opcional)..."
                className="w-full rounded-2xl bg-surface-bg border border-outline-variant/60 p-3.5 text-body-md text-text-main placeholder:text-text-muted focus:bg-white focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all outline-none resize-none"
              />
            </div>
          </div>

          <div className="w-full space-y-2">
            <button
              type="button" disabled={rating === 0 || busy} onClick={send}
              className="w-full h-14 rounded-full bg-primary-container hover:bg-primary text-on-primary text-headline-sm flex items-center justify-center gap-2 shadow-lg shadow-primary-container/25 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Enviar Calificación</span>
              <Icon name="send" className="text-xl" />
            </button>
            <button type="button" onClick={skip} className="w-full py-3 rounded-full text-text-muted hover:text-text-main text-label-lg active:scale-[0.985] transition-all hover:bg-surface-container-low">
              Omitir por ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
