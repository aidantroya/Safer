import type { ReviewInsight } from '@/domain/model';
import type { IReviewSummarizer, IUserRepository } from '@/domain/repository';
import { NEGATIVE_TAGS, POSITIVE_TAGS } from './ReviewService';
import type { RouteCatalogService } from './RouteCatalogService';

const TAG_LABELS = new Map([...POSITIVE_TAGS, ...NEGATIVE_TAGS].map((t) => [t.id, t.label]));

/**
 * Palabras clave y puntaje general de cada conductor a partir de sus reseñas.
 * Usa la IA si está disponible y cae al cálculo local si falla. Guarda el resultado
 * mientras no lleguen reseñas nuevas, para no llamar a Gemini en cada pantalla.
 */
export class ReviewInsightService {
  private cache = new Map<string, { count: number; insight: Promise<ReviewInsight> }>();

  constructor(
    private catalog: RouteCatalogService,
    private users: IUserRepository,
    private summarizer: IReviewSummarizer,
    private fallback: IReviewSummarizer,
  ) {}

  async forDriver(driverId: string): Promise<ReviewInsight | undefined> {
    const reviews = await this.catalog.reviewsFor(driverId);
    if (!reviews.length) return undefined;
    const cached = this.cache.get(driverId);
    if (cached && cached.count === reviews.length) return cached.insight;

    const driver = await this.users.findById(driverId);
    const input = {
      driverName: driver?.fullName ?? 'Conductor',
      reviews: reviews.map((r) => ({ rating: r.rating, tags: r.tags.map((t) => TAG_LABELS.get(t) ?? t), comment: r.comment })),
    };
    const insight = this.summarizer
      .summarize(input)
      .then((d) => ({ ...d, source: this.summarizer === this.fallback ? ('local' as const) : ('gemini' as const) }))
      .catch(async (e) => {
        if (this.summarizer !== this.fallback) console.warn('Resumen con IA no disponible, uso el cálculo local:', e);
        return { ...(await this.fallback.summarize(input)), source: 'local' as const };
      })
      .then((d) => ({ ...d, driverId, reviewCount: reviews.length }));

    this.cache.set(driverId, { count: reviews.length, insight });
    return insight;
  }
}
