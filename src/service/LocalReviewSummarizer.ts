import type { ReviewDigest, ReviewDigestInput } from '@/domain/model';
import type { IReviewSummarizer } from '@/domain/repository';

/**
 * Resumen sin IA: las etiquetas más repetidas como palabras clave y el promedio de estrellas como puntaje.
 * Se usa cuando no hay Supabase/Gemini configurado o la llamada falla.
 */
export class LocalReviewSummarizer implements IReviewSummarizer {
  async summarize({ reviews }: ReviewDigestInput): Promise<ReviewDigest> {
    const counts = new Map<string, number>();
    reviews.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    const keywords = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
    const score = reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : 0;
    return {
      keywords,
      score,
      summary: reviews.length
        ? `Promedio de ${score} sobre 5 en ${reviews.length} reseñas.`
        : 'Todavía no hay reseñas.',
    };
  }
}
