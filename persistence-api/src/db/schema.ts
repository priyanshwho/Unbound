import { bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const messageRole = pgEnum('message_role', ['user', 'assistant'])
export const publicationVisibility = pgEnum('publication_visibility', ['public', 'unlisted'])

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().default('local'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const datasets = pgTable('datasets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rowCount: bigint('row_count', { mode: 'number' }).notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  columns: jsonb('columns').$type<Array<{ name: string; type: string; role?: string }>>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().default('local').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('conversations_updated_at_idx').on(table.updatedAt)])

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: messageRole('role').notNull(),
  content: text('content').notNull(),
  result: jsonb('result').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('messages_conversation_created_at_idx').on(table.conversationId, table.createdAt)])

export const dashboards = pgTable('dashboards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  spec: jsonb('spec').$type<Record<string, unknown>>().notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dashboardVersions = pgTable('dashboard_versions', {
  id: text('id').primaryKey(),
  dashboardId: text('dashboard_id').notNull().references(() => dashboards.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  spec: jsonb('spec').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('dashboard_versions_revision_idx').on(table.dashboardId, table.revision)])

export const publications = pgTable('publications', {
  shareId: text('share_id').primaryKey(),
  dashboardId: text('dashboard_id').notNull().references(() => dashboards.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  visibility: publicationVisibility('visibility').notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, table => [index('publications_dashboard_id_idx').on(table.dashboardId)])

