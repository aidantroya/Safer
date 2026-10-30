import { createApp } from './container';

/** Instancia única que usa la UI. */
export const app = createApp();
app.simulation.start();

export type { ApiResult } from './ApiResult';
export type { App } from './container';
