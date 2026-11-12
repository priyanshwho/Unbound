import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client.js'
import { dashboards, dashboardVersions, workspaces } from '../db/schema.js'
import { requireServiceToken } from '../middleware/serviceAuth.js'

const dashboardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(180),
  spec: z.record(z.string(), z.unknown()),
})

export async function registerPrivateDashboardRoutes(app: FastifyInstance) {
  app.get('/v1/private/dashboards', { preHandler: requireServiceToken }, async () => {
    const db = getDatabase()
    return db.select().from(dashboards).orderBy(desc(dashboards.updatedAt))
  })

  app.get('/v1/private/dashboards/:dashboardId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ dashboardId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ detail: 'Dashboard identifier is invalid.' })
    const db = getDatabase()
    const dashboard = await db.select().from(dashboards).where(eq(dashboards.id, params.data.dashboardId)).limit(1)
    if (!dashboard[0]) return reply.code(404).send({ detail: 'Dashboard not found.' })
    const versions = await db.select().from(dashboardVersions).where(eq(dashboardVersions.dashboardId, params.data.dashboardId)).orderBy(desc(dashboardVersions.revision))
    return { ...dashboard[0], versions }
  })

  app.put('/v1/private/dashboards/:dashboardId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ dashboardId: z.string().uuid() }).safeParse(request.params)
    const body = dashboardSchema.safeParse(request.body)
    if (!params.success || !body.success || params.data.dashboardId !== body.data.id) {
      return reply.code(400).send({ detail: 'Dashboard data is invalid.' })
    }
    const db = getDatabase()
    await db.insert(workspaces).values({ id: 'local' }).onConflictDoNothing()
    const existing = await db.select({ revision: dashboards.revision }).from(dashboards).where(eq(dashboards.id, body.data.id)).limit(1)
    const revision = (existing[0]?.revision ?? 0) + 1
    const now = new Date()
    await db.insert(dashboards).values({ ...body.data, revision, updatedAt: now }).onConflictDoUpdate({
      target: dashboards.id,
      set: { title: body.data.title, spec: body.data.spec, revision, updatedAt: now },
    })
    await db.insert(dashboardVersions).values({ id: crypto.randomUUID(), dashboardId: body.data.id, revision, spec: body.data.spec, createdAt: now })
    return reply.code(existing[0] ? 200 : 201).send({ id: body.data.id, revision })
  })
}
