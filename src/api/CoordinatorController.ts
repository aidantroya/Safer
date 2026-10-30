import type { PlanItem, PlanningService, WeekPlan } from '@/service/PlanningService';
import { run, type ApiResult } from './ApiResult';

/** Lo que puede hacer Coordinación: ver y editar la programación semanal de conductores y buses. */
export class CoordinatorController {
  constructor(private planning: PlanningService) {}

  getWeekPlan(): Promise<ApiResult<WeekPlan>> {
    return run(() => this.planning.getWeek());
  }
  saveDay(weekday: number, items: PlanItem[]): Promise<ApiResult<void>> {
    return run(() => this.planning.saveDay(weekday, items));
  }
  saveWeek(days: PlanItem[][]): Promise<ApiResult<void>> {
    return run(() => this.planning.saveWeek(days));
  }
}
