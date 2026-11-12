import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from './app.js'
import { config } from './core/config.js'
import { publicationSnapshotSchema } from './contracts/publication.js'

test('private routes reject requests without the local service token', async () => {
  const previousToken = config.serviceToken
  config.serviceToken = 'test-service-token'
  const app = buildApp()
  try {
    const response = await app.inject({ method: 'GET', url: '/v1/private/conversations' })
    assert.equal(response.statusCode, 401)
  } finally {
    await app.close()
    config.serviceToken = previousToken
  }
})

test('public share route does not expose private persistence routes', async () => {
  const app = buildApp()
  const response = await app.inject({ method: 'GET', url: '/v1/private/datasets' })
  assert.ok(response.statusCode === 401 || response.statusCode === 503)
  await app.close()
})

test('public snapshot contract rejects raw-row payloads', () => {
  const valid = {
    version: 1,
    dashboardId: '8b0e4ec2-20b1-4b21-9516-087ff415d9e2',
    title: 'Retail performance',
    kpis: [],
    charts: [{ id: 'sales', title: 'Sales by product', type: 'bar', data: [{ label: 'Mug', value: 120 }] }],
    filters: [],
  }
  assert.equal(publicationSnapshotSchema.safeParse(valid).success, true)
  assert.equal(publicationSnapshotSchema.safeParse({ ...valid, rows: [{ customer_email: 'private@example.com' }] }).success, false)
})
