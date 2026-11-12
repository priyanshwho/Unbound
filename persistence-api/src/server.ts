import { buildApp } from './app.js'
import { config } from './core/config.js'

const app = buildApp()
await app.listen({ host: config.host, port: config.port })
