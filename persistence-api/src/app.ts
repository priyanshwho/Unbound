import Fastify from 'fastify'
import cors from '@fastify/cors'
import { sql } from 'drizzle-orm'
import { config } from './core/config.js'
import { getDatabase } from './db/client.js'
import { registerPrivateWorkspaceRoutes } from './routes/privateWorkspace.js'
import { registerPrivateDashboardRoutes } from './routes/privateDashboards.js'
import { registerPublicationRoutes } from './routes/publications.js'

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1_000_000 })
  void app.register(cors, { origin: config.publicOrigin })

  void registerPrivateWorkspaceRoutes(app)
  void registerPrivateDashboardRoutes(app)
  void registerPublicationRoutes(app)

  app.get('/health', async () => {
    let databaseConfigured = false
    try {
      const db = getDatabase()
      await db.execute(sql`select 1`)
      databaseConfigured = true
    } catch {
      databaseConfigured = false
    }
    return { status: 'ok', databaseConfigured }
  })

  return app
}
