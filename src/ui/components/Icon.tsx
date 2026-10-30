import type { CSSProperties } from 'react';

interface Props {
  name: string;
  /** Relleno sólido del símbolo (FILL 1). */
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Material Symbols Outlined (fuente local vía paquete material-symbols, funciona sin internet). */
export function Icon({ name, fill = false, className = '', style }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`, ...style }}
    >
      {name}
    </span>
  );
}
