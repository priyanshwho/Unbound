import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { config } from '../core/config.js'
import * as schema from './schema.js'

export function getDatabase() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured. Add the Neon connection URL to persistence-api/.env.')
  const client = neon(config.databaseUrl)
  return drizzle({ client, schema })
}
