import { supabase } from '@/data/datasource/supabaseClient';
import { GeminiReviewSummarizer } from '@/data/remote/GeminiReviewSummarizer';
import { OsrmRoutingService } from '@/data/remote/OsrmRoutingService';
import { createApp } from './container';

/** Instancia única que usa la UI. Con Supabase configurado, los resúmenes de reseñas los hace Gemini; los caminos, OSRM. */
export const app = createApp(undefined, {
  summarizer: supabase && new GeminiReviewSummarizer(supabase),
  routing: new OsrmRoutingService(),
});
app.simulation.start();

export type { ApiResult } from './ApiResult';
export type { App } from './container';
