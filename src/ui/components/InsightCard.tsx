import type { ReviewInsight } from '@/domain/model';
import { Icon } from './Icon';
import { Stars } from './Stars';

/** Palabras clave + puntaje general de un conductor (generado por Gemini o calculado localmente). */
export function InsightCard({ insight, title, compact = false }: { insight: ReviewInsight; title?: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'bg-surface-card rounded-2xl p-space-md shadow-level-1 border border-outline-variant/30'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="text-title-md font-bold text-on-surface truncate">{title}</h3>}
          <span
            className={`inline-flex items-center gap-1 text-label-sm font-semibold ${insight.source === 'gemini' ? 'text-primary' : 'text-on-surface-variant'}`}
            title={insight.source === 'gemini' ? 'Resumen generado con Gemini' : 'Sin IA: etiquetas más repetidas y promedio de estrellas'}
          >
            <Icon name={insight.source === 'gemini' ? 'auto_awesome' : 'calculate'} className="text-[16px]" />
            {insight.source === 'gemini' ? 'Resumen con IA' : 'Resumen automático'} • {insight.reviewCount} reseñas
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-headline-md font-extrabold text-on-surface tabular leading-none">{insight.score.toFixed(1)}</div>
          <Stars value={insight.score} size={13} />
        </div>
      </div>
      {insight.keywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {insight.keywords.map((k) => (
            <span key={k} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-label-sm font-semibold">{k}</span>
          ))}
        </div>
      )}
      {insight.summary && <p className="mt-2 text-body-sm text-on-surface-variant">{insight.summary}</p>}
    </div>
  );
}
