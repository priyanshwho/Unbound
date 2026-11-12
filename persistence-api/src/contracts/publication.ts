import { z } from 'zod'

const scalar = z.union([z.string().max(240), z.number().finite()])

export const publicationSnapshotSchema = z.object({
  version: z.literal(1),
  dashboardId: z.string().uuid(),
  title: z.string().min(1).max(180),
  summary: z.string().max(4000).optional(),
  warnings: z.array(z.string().max(500)).max(32).optional(),
  kpis: z.array(z.object({ id: z.string().max(80), label: z.string().max(120), value: scalar, change: z.string().max(80).optional() }).strict()).max(12),
  charts: z.array(z.object({
    id: z.string().max(80),
    title: z.string().max(180),
    type: z.enum(['line', 'bar', 'horizontal_bar', 'pie', 'donut']),
    data: z.array(z.object({ label: z.string().max(240), value: scalar, series: z.string().max(120).optional() }).strict()).max(500),
  }).strict()).max(30),
  filters: z.array(z.object({ id: z.string().max(80), label: z.string().max(120), options: z.array(z.string().max(120)).max(100) }).strict()).max(12),
}).strict()

export type PublicationSnapshot = z.infer<typeof publicationSnapshotSchema>
