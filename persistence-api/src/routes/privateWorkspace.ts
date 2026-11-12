import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client.js'
import { conversations, datasets, messages, workspaces } from '../db/schema.js'
import { requireServiceToken } from '../middleware/serviceAuth.js'

const datasetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(180),
  rows: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  columns: z.array(z.object({ name: z.string().max(256), type: z.string().max(128), role: z.string().max(32).optional() })).max(500),
})

const conversationSchema = z.object({ id: z.string().uuid(), title: z.string().min(1).max(180) })
const messageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
})

async function ensureWorkspace() {
  const db = getDatabase()
  await db.insert(workspaces).values({ id: 'local' }).onConflictDoNothing()
  return db
}

export async function registerPrivateWorkspaceRoutes(app: FastifyInstance) {
  app.get('/v1/private/datasets', { preHandler: requireServiceToken }, async () => {
    const db = await ensureWorkspace()
    return db.select().from(datasets).orderBy(desc(datasets.updatedAt))
  })

  app.put('/v1/private/datasets/:datasetId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ datasetId: z.string().min(1).max(80) }).safeParse(request.params)
    const body = datasetSchema.safeParse(request.body)
    if (!params.success || !body.success || params.data.datasetId !== body.data.id) {
      return reply.code(400).send({ detail: 'Dataset metadata is invalid.' })
    }
    const db = await ensureWorkspace()
    const { id, name, rows, size, columns } = body.data
    await db.insert(datasets).values({ id, name, rowCount: rows, byteSize: size, columns }).onConflictDoUpdate({
      target: datasets.id,
      set: { name, rowCount: rows, byteSize: size, columns, updatedAt: new Date() },
    })
    return { saved: true }
  })

  app.delete('/v1/private/datasets/:datasetId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ datasetId: z.string().min(1).max(80) }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ detail: 'Dataset identifier is invalid.' })
    const db = await ensureWorkspace()
    await db.delete(datasets).where(eq(datasets.id, params.data.datasetId))
    return { deleted: true }
  })

  app.get('/v1/private/conversations', { preHandler: requireServiceToken }, async () => {
    const db = await ensureWorkspace()
    return db.select().from(conversations).where(eq(conversations.workspaceId, 'local')).orderBy(desc(conversations.updatedAt))
  })

  app.post('/v1/private/conversations', { preHandler: requireServiceToken }, async (request, reply) => {
    const body = conversationSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ detail: 'Conversation data is invalid.' })
    const db = await ensureWorkspace()
    const now = new Date()
    await db.insert(conversations).values({ ...body.data, workspaceId: 'local', createdAt: now, updatedAt: now })
    return reply.code(201).send(body.data)
  })

  app.get('/v1/private/conversations/:conversationId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ conversationId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ detail: 'Conversation identifier is invalid.' })
    const db = await ensureWorkspace()
    const conversation = await db.select().from(conversations).where(and(eq(conversations.id, params.data.conversationId), eq(conversations.workspaceId, 'local'))).limit(1)
    if (!conversation[0]) return reply.code(404).send({ detail: 'Conversation not found.' })
    const history = await db.select().from(messages).where(eq(messages.conversationId, params.data.conversationId)).orderBy(messages.createdAt)
    return { ...conversation[0], messages: history }
  })

  app.post('/v1/private/conversations/:conversationId/messages', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ conversationId: z.string().uuid() }).safeParse(request.params)
    const body = messageSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ detail: 'Message data is invalid.' })
    const db = await ensureWorkspace()
    const parent = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, params.data.conversationId), eq(conversations.workspaceId, 'local'))).limit(1)
    if (!parent[0]) return reply.code(404).send({ detail: 'Conversation not found.' })
    await db.insert(messages).values({ ...body.data, conversationId: params.data.conversationId })
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, params.data.conversationId))
    return reply.code(201).send({ saved: true })
  })

  app.delete('/v1/private/conversations/:conversationId', { preHandler: requireServiceToken }, async (request, reply) => {
    const params = z.object({ conversationId: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ detail: 'Conversation identifier is invalid.' })
    const db = await ensureWorkspace()
    await db.delete(conversations).where(and(eq(conversations.id, params.data.conversationId), eq(conversations.workspaceId, 'local')))
    return { deleted: true }
  })
}
