import type { DrizzleDb } from "../../core/database/connection.js";
import { createAnalyticsRepository } from "./analytics.repository.js";
import { createAnalyticsService } from "./analytics.service.js";
import { createAnalyticsController } from "./analytics.controller.js";

export function createAnalyticsModule(db: DrizzleDb) {
  const analyticsRepo = createAnalyticsRepository(db);
  const service = createAnalyticsService({ analyticsRepo });
  return { controller: createAnalyticsController(service) };
}
