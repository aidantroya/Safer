import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewDigest, ReviewDigestInput } from '@/domain/model';
import type { IReviewSummarizer } from '@/domain/repository';

/**
 * Resume con Gemini llamando a la Edge Function `summarize-reviews` (supabase/functions/).
 * La clave de Gemini vive como secreto en Supabase; nunca llega al navegador.
 */
export class GeminiReviewSummarizer implements IReviewSummarizer {
  constructor(private supabase: SupabaseClient) {}

  async summarize(input: ReviewDigestInput): Promise<ReviewDigest> {
    const { data, error } = await this.supabase.functions.invoke<ReviewDigest>('summarize-reviews', { body: input });
    if (error || !data) throw error ?? new Error('Respuesta vacía de summarize-reviews');
    if (!Array.isArray(data.keywords) || typeof data.score !== 'number') throw new Error('Respuesta inválida de summarize-reviews');
    return {
      keywords: data.keywords.filter((k) => typeof k === 'string').slice(0, 6),
      score: Math.min(5, Math.max(1, Math.round(data.score * 10) / 10)),
      summary: String(data.summary ?? ''),
    };
  }
}
