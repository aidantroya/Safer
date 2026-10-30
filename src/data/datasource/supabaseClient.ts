/**
 * PUNTO DE ENTRADA PARA SUPABASE (todavía no conectado).
 *
 * Pasos cuando quieras pasar de memoria a base real:
 *   1. npm i @supabase/supabase-js
 *   2. Crea .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 *   3. Descomenta lo de abajo
 *   4. Crea data/repository/Supabase*Repository.ts que implementen las MISMAS interfaces
 *      de domain/repository y cámbialas en api/container.ts.
 *   Los servicios y la UI no se tocan.
 *
 * import { createClient } from '@supabase/supabase-js';
 * export const supabase = createClient(
 *   import.meta.env.VITE_SUPABASE_URL,
 *   import.meta.env.VITE_SUPABASE_ANON_KEY,
 * );
 */
export {};
