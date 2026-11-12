import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../core/config.js'

export async function requireServiceToken(request: FastifyRequest, reply: FastifyReply) {
  if (!config.serviceToken) {
    return reply.code(503).send({ detail: 'UNBOUND_SERVICE_TOKEN is not configured.' })
  }
  const provided = request.headers['x-unbound-service-token']
  if (typeof provided !== 'string') return reply.code(401).send({ detail: 'Service authorization required.' })
  const expectedBuffer = Buffer.from(config.serviceToken)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return reply.code(401).send({ detail: 'Service authorization failed.' })
  }
}
