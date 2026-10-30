import { Icon } from './Icon';

/** Estrellas de calificación (sólo lectura). Redondea a la media estrella. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const half = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center text-amber-500" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name={half >= n ? 'star' : half >= n - 0.5 ? 'star_half' : 'star'}
          fill={half >= n - 0.5}
          className={half >= n - 0.5 ? '' : 'text-outline-variant'}
          style={{ fontSize: size }}
        />
      ))}
    </span>
  );
}
