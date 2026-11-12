import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, eq, isNull, or, gt } from 'drizzle-orm'
import { getDatabase } from '../db/client.js'
import { dashboards, publications } from '../db/schema.js'
import { requireServiceToken } from '../middleware/serviceAuth.js'
import { publicationSnapshotSchema } from '../contracts/publication.js'

const publicationSchema = z.object({
  shareId: z.string().uuid(),
  dashboardId: z.string().uuid(),
  revision: z.number().int().positive(),
  visibility: z.enum(['public', 'unlisted']),
  snapshot: publicationSnapshotSchema,
  expiresAt: z.string().datetime().nullable().optional(),
})

export async function registerPublicationRoutes(app: FastifyInstance) {
  app.post('/v1/private/publications', { preHandler: requireServiceToken }, async (request, reply) => {
    const body = publicationSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ detail: 'Publication data is invalid.' })
    const db = getDatabase()
    const dashboard = await db.select({ revision: dashboards.revision }).from(dashboards).where(eq(dashboards.id, body.data.dashboardId)).limit(1)
    if (!dashboard[0] || dashboard[0].revision !== body.data.revision) {
      return reply.code(409).send({ detail: 'Save the current dashboard revision before publishing it.' })
    }
    await db.insert(publications).values({
      shareId: body.data.shareId,
      dashboardId: body.data.dashboardId,
      revision: body.data.revision,
      visibility: body.data.visibility,
      snapshot: body.data.snapshot,
      expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
    })
    return reply.code(201).send({ shareId: body.data.shareId, visibility: body.data.visibility })
  })

  app.delete('/v1/private/publications/:shareId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ shareId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ detail: 'Share identifier is invalid.' })
    const db = getDatabase()
    await db.update(publications).set({ revokedAt: new Date() }).where(eq(publications.shareId, params.data.shareId))
    return { revoked: true }
  })

  app.get('/v1/share/:shareId', async (request, reply) => {
    const params = z.object({ shareId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(404).send({ detail: 'Shared dashboard not found.' })
    const db = getDatabase()
    const now = new Date()
    const matches = await db.select({ snapshot: publications.snapshot, visibility: publications.visibility })
      .from(publications)
      .where(and(eq(publications.shareId, params.data.shareId), isNull(publications.revokedAt), or(isNull(publications.expiresAt), gt(publications.expiresAt, now))))
      .limit(1)
    if (!matches[0]) return reply.code(404).send({ detail: 'Shared dashboard not found or expired.' })
    return { visibility: matches[0].visibility, snapshot: matches[0].snapshot }
  })
}
