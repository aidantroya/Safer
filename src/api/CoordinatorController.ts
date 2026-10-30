import type { ReviewInsight } from '@/domain/model';
import type { PlanItem, PlanningService, WeekPlan } from '@/service/PlanningService';
import type { ReviewInsightService } from '@/service/ReviewInsightService';
import { run, type ApiResult } from './ApiResult';

/** Lo que puede hacer Coordinación: ver y editar la programación semanal de conductores y buses. */
export class CoordinatorController {
  constructor(private planning: PlanningService, private insights: ReviewInsightService) {}

  getWeekPlan(): Promise<ApiResult<WeekPlan>> {
    return run(() => this.planning.getWeek());
  }
  saveDay(weekday: number, items: PlanItem[]): Promise<ApiResult<void>> {
    return run(() => this.planning.saveDay(weekday, items));
  }
  /** Palabras clave y puntaje general del conductor según sus reseñas. */
  getDriverInsight(driverId: string): Promise<ApiResult<ReviewInsight | undefined>> {
    return run(() => this.insights.forDriver(driverId));
  }
  saveWeek(days: PlanItem[][]): Promise<ApiResult<void>> {
    return run(() => this.planning.saveWeek(days));
  }
}
