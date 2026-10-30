import type { Review } from '@/domain/model';
import type { IReviewRepository } from '@/domain/repository';
import { DomainError } from './errors';

export const RATING_LABELS: Record<number, string> = {
  1: 'Poco satisfactorio (1/5)',
  2: 'Regular (2/5)',
  3: 'Bueno (3/5)',
  4: 'Muy bueno (4/5)',
  5: '¡Excelente servicio! (5/5)',
};

export const POSITIVE_TAGS = [
  { id: 'puntualidad', emoji: '⏱️', label: 'Puntualidad' },
  { id: 'conduccion', emoji: '🚌', label: 'Conducción suave' },
  { id: 'aire', emoji: '❄️', label: 'Aire acondicionado' },
  { id: 'limpia', emoji: '✨', label: 'Unidad limpia' },
];

export const NEGATIVE_TAGS = [
  { id: 'retraso', emoji: '🐢', label: 'Llegó tarde' },
  { id: 'lleno', emoji: '🚏', label: 'Iba muy lleno' },
  { id: 'brusca', emoji: '⚠️', label: 'Conducción brusca' },
  { id: 'sucia', emoji: '🧹', label: 'Unidad sucia' },
];

export class ReviewService {
  constructor(private reviews: IReviewRepository, private now: () => number = () => Date.now()) {}

  async submit(input: { tripId: string; passengerId: string; rating: number; tags: string[]; comment: string }): Promise<Review> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new DomainError('BAD_RATING', 'La calificación debe ser de 1 a 5.');
    }
    if (await this.reviews.findByTripAndPassenger(input.tripId, input.passengerId)) {
      throw new DomainError('DUPLICATE', 'Ya calificaste este viaje.');
    }
    const review: Review = {
      id: `rev-${this.now()}`,
      tripId: input.tripId,
      passengerId: input.passengerId,
      rating: input.rating,
      tags: input.tags,
      comment: input.comment.trim().slice(0, 300),
      createdAt: this.now(),
    };
    await this.reviews.save(review);
    return review;
  }

  has(tripId: string, passengerId: string): Promise<Review | undefined> {
    return this.reviews.findByTripAndPassenger(tripId, passengerId);
  }
}
