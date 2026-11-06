import { z } from 'zod';

/** KPIs del panel principal (`RF-DASH-1.1`). */
export const kpisResponseSchema = z.object({
  total_lineas: z.number().int(),
  lineas_activas: z.number().int(),
  count_personal: z.number().int(),
  count_geovictoria: z.number().int(),
});
