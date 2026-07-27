import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Database schema — single source of truth for all persisted shapes.
 * Timestamps are epoch milliseconds. No derived data is stored (scores are
 * always computed by features/scoring so the algorithm can evolve freely).
 */

export const journalists = sqliteTable('journalists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  outlet: text('outlet'),
  avatarColor: text('avatar_color').notNull(),
  isSeeded: integer('is_seeded', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
});

export const CONFIDENCE_LEVELS = [1, 2, 3] as const;
/** 1 = speculative link, 2 = advanced/strong, 3 = confirmed ("here we go"). */
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CLAIM_OUTCOMES = ['true', 'partial', 'false'] as const;
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

export const claims = sqliteTable(
  'claims',
  {
    id: text('id').primaryKey(),
    journalistId: text('journalist_id')
      .notNull()
      .references(() => journalists.id, { onDelete: 'cascade' }),
    headline: text('headline').notNull(),
    playerName: text('player_name').notNull(),
    playerApiId: integer('player_api_id'),
    fromClubName: text('from_club_name'),
    fromClubApiId: integer('from_club_api_id'),
    toClubName: text('to_club_name').notNull(),
    toClubApiId: integer('to_club_api_id'),
    league: text('league'),
    confidence: integer('confidence').$type<Confidence>().notNull(),
    /** e.g. "2026-summer", "2027-winter". */
    transferWindow: text('transfer_window'),
    sourceUrl: text('source_url'),
    notes: text('notes'),
    claimedAt: integer('claimed_at').notNull(),
    status: text('status', { enum: ['pending', 'resolved'] })
      .notNull()
      .default('pending'),
    outcome: text('outcome', { enum: CLAIM_OUTCOMES }),
    resolvedAt: integer('resolved_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_claims_journalist_status').on(table.journalistId, table.status),
    index('idx_claims_status_claimed').on(table.status, table.claimedAt),
  ],
);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const claimTags = sqliteTable(
  'claim_tags',
  {
    claimId: text('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.claimId, table.tagId] })],
);

/** Football API response cache — keyed by normalized request descriptor. */
export const apiCache = sqliteTable('api_cache', {
  cacheKey: text('cache_key').primaryKey(),
  payload: text('payload').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

/** Daily football API request counter, e.g. day = "2026-07-26". */
export const apiUsage = sqliteTable('api_usage', {
  day: text('day').primaryKey(),
  requestCount: integer('request_count').notNull().default(0),
});

/** Misc app flags (seed status, export timestamps). */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Journalist = typeof journalists.$inferSelect;
export type NewJournalist = typeof journalists.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type Tag = typeof tags.$inferSelect;
