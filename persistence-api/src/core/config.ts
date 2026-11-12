import 'dotenv/config'

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  serviceToken: process.env.UNBOUND_SERVICE_TOKEN ?? '',
  port: Number(process.env.PORT ?? 8100),
  host: process.env.HOST ?? '127.0.0.1',
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173',
}
