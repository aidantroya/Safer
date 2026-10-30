/** Resumen de las reseñas de un conductor: palabras clave y un puntaje general (1 a 5). */
export interface ReviewInsight {
  driverId: string;
  keywords: string[];
  score: number;
  summary: string;
  /** 'gemini' si lo generó la IA; 'local' si se calculó sin IA (sin conexión o sin clave). */
  source: 'gemini' | 'local';
  reviewCount: number;
}

/** Lo que se le manda al resumidor: sólo el contenido de las reseñas, sin datos del estudiante. */
export interface ReviewDigestInput {
  driverName: string;
  reviews: { rating: number; tags: string[]; comment: string }[];
}

export type ReviewDigest = Pick<ReviewInsight, 'keywords' | 'score' | 'summary'>;
