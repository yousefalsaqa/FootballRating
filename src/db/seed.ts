import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { appMeta, claims, journalists, type ClaimOutcome, type Confidence } from '@/db/schema';
import { avatarColorFor } from '@/lib/constants';
import { newId } from '@/lib/id';

const SEED_FLAG = 'seeded.journalists.v1';
const HANDLE_BACKFILL_FLAG = 'seeded.handles.v2';
const DEMO_CLAIMS_FLAG = 'seeded.demo-claims.v1';

/**
 * Seed ids are FIXED strings (not per-install UUIDs) so exports from one
 * device merge cleanly into another instead of duplicating the seeded rows.
 */
const SEED_JOURNALISTS: { id: string; name: string; outlet: string; handle: string }[] = [
  { id: 'seed-fabrizio-romano', name: 'Fabrizio Romano', outlet: 'Independent', handle: 'fabrizioromano' },
  { id: 'seed-david-ornstein', name: 'David Ornstein', outlet: 'The Athletic', handle: 'david_ornstein' },
  { id: 'seed-florian-plettenberg', name: 'Florian Plettenberg', outlet: 'Sky Sport DE', handle: 'plettigoal' },
  { id: 'seed-gianluca-di-marzio', name: 'Gianluca Di Marzio', outlet: 'Sky Sport IT', handle: 'dimarzio' },
  { id: 'seed-christian-falk', name: 'Christian Falk', outlet: 'BILD', handle: 'cfbayern' },
  { id: 'seed-matteo-moretto', name: 'Matteo Moretto', outlet: 'Relevo', handle: 'mattemoretto' },
  { id: 'seed-ben-jacobs', name: 'Ben Jacobs', outlet: 'talkSPORT', handle: 'jacobsben' },
];

interface SeedClaim {
  journalistId: string;
  headline: string;
  playerName: string;
  fromClubName?: string;
  toClubName: string;
  league?: string;
  confidence: Confidence;
  /** Days ago the claim was made; 0 = today. */
  claimedDaysAgo: number;
  /** Present = resolved that many days ago. */
  resolved?: { outcome: ClaimOutcome; daysAgo: number };
}

/** Summer 2026 window demo wire — gives the table standings from day one. */
const SEED_CLAIMS: SeedClaim[] = [
  // Fabrizio Romano
  { journalistId: 'seed-fabrizio-romano', headline: 'Haaland agreement with Real Madrid at advanced stage', playerName: 'Erling Haaland', fromClubName: 'Manchester City', toClubName: 'Real Madrid', league: 'La Liga', confidence: 2, claimedDaysAgo: 0 },
  { journalistId: 'seed-fabrizio-romano', headline: 'Nico Williams to Bayern, here we go', playerName: 'Nico Williams', fromClubName: 'Athletic Club', toClubName: 'Bayern München', league: 'Bundesliga', confidence: 3, claimedDaysAgo: 44, resolved: { outcome: 'true', daysAgo: 21 } },
  { journalistId: 'seed-fabrizio-romano', headline: 'Osimhen to Juventus, done deal — here we go', playerName: 'Victor Osimhen', fromClubName: 'Galatasaray', toClubName: 'Juventus', league: 'Serie A', confidence: 3, claimedDaysAgo: 33, resolved: { outcome: 'true', daysAgo: 26 } },
  { journalistId: 'seed-fabrizio-romano', headline: 'Kudus set for Newcastle medical', playerName: 'Mohammed Kudus', fromClubName: 'West Ham', toClubName: 'Newcastle', league: 'Premier League', confidence: 2, claimedDaysAgo: 55, resolved: { outcome: 'partial', daysAgo: 40 } },
  // David Ornstein
  { journalistId: 'seed-david-ornstein', headline: 'Arsenal agree £70m package for Rodrygo', playerName: 'Rodrygo', fromClubName: 'Real Madrid', toClubName: 'Arsenal', league: 'Premier League', confidence: 2, claimedDaysAgo: 0 },
  { journalistId: 'seed-david-ornstein', headline: 'Saka signs new long-term Arsenal contract', playerName: 'Bukayo Saka', toClubName: 'Arsenal', league: 'Premier League', confidence: 3, claimedDaysAgo: 30, resolved: { outcome: 'true', daysAgo: 14 } },
  { journalistId: 'seed-david-ornstein', headline: 'Liverpool exploring Zubimendi release clause', playerName: 'Martín Zubimendi', fromClubName: 'Real Sociedad', toClubName: 'Liverpool', league: 'Premier League', confidence: 1, claimedDaysAgo: 70, resolved: { outcome: 'true', daysAgo: 35 } },
  // Florian Plettenberg
  { journalistId: 'seed-florian-plettenberg', headline: 'Woltemade to Chelsea at advanced stage', playerName: 'Nick Woltemade', fromClubName: 'Stuttgart', toClubName: 'Chelsea', league: 'Premier League', confidence: 2, claimedDaysAgo: 38, resolved: { outcome: 'partial', daysAgo: 18 } },
  { journalistId: 'seed-florian-plettenberg', headline: 'Bayern medical booked for Wirtz', playerName: 'Florian Wirtz', fromClubName: 'Liverpool', toClubName: 'Bayern München', league: 'Bundesliga', confidence: 3, claimedDaysAgo: 50, resolved: { outcome: 'false', daysAgo: 24 } },
  { journalistId: 'seed-florian-plettenberg', headline: 'Leverkusen close to Sesko deal', playerName: 'Benjamin Šeško', fromClubName: 'RB Leipzig', toClubName: 'Bayer Leverkusen', league: 'Bundesliga', confidence: 2, claimedDaysAgo: 62, resolved: { outcome: 'true', daysAgo: 45 } },
  // Gianluca Di Marzio
  { journalistId: 'seed-gianluca-di-marzio', headline: 'Leão–PSG talks opened via intermediaries', playerName: 'Rafael Leão', fromClubName: 'AC Milan', toClubName: 'Paris Saint-Germain', league: 'Ligue 1', confidence: 1, claimedDaysAgo: 41, resolved: { outcome: 'false', daysAgo: 12 } },
  { journalistId: 'seed-gianluca-di-marzio', headline: 'Inter agree terms with Gudmundsson', playerName: 'Albert Guðmundsson', fromClubName: 'Fiorentina', toClubName: 'Inter', league: 'Serie A', confidence: 2, claimedDaysAgo: 58, resolved: { outcome: 'true', daysAgo: 39 } },
  // Christian Falk
  { journalistId: 'seed-christian-falk', headline: 'Kimmich agrees Bayern extension to 2029', playerName: 'Joshua Kimmich', toClubName: 'Bayern München', league: 'Bundesliga', confidence: 3, claimedDaysAgo: 27, resolved: { outcome: 'true', daysAgo: 10 } },
  { journalistId: 'seed-christian-falk', headline: 'City agree Musiala release-clause package', playerName: 'Jamal Musiala', fromClubName: 'Bayern München', toClubName: 'Manchester City', league: 'Premier League', confidence: 1, claimedDaysAgo: 48, resolved: { outcome: 'false', daysAgo: 29 } },
  // Matteo Moretto
  { journalistId: 'seed-matteo-moretto', headline: 'Chelsea preparing €60m bid for Fermín', playerName: 'Fermín López', fromClubName: 'Barcelona', toClubName: 'Chelsea', league: 'Premier League', confidence: 2, claimedDaysAgo: 0 },
  { journalistId: 'seed-matteo-moretto', headline: 'Vinícius renewal stalled amid Saudi push', playerName: 'Vinícius Júnior', toClubName: 'Real Madrid', league: 'La Liga', confidence: 1, claimedDaysAgo: 36, resolved: { outcome: 'partial', daysAgo: 16 } },
  { journalistId: 'seed-matteo-moretto', headline: 'Atlético close on Sørloth replacement Gyökeres', playerName: 'Viktor Gyökeres', fromClubName: 'Sporting CP', toClubName: 'Atlético Madrid', league: 'La Liga', confidence: 2, claimedDaysAgo: 66, resolved: { outcome: 'true', daysAgo: 47 } },
  // Ben Jacobs
  { journalistId: 'seed-ben-jacobs', headline: 'Garnacho-to-Chelsea talks revived', playerName: 'Alejandro Garnacho', fromClubName: 'Manchester United', toClubName: 'Chelsea', league: 'Premier League', confidence: 2, claimedDaysAgo: 0 },
  { journalistId: 'seed-ben-jacobs', headline: 'Toney agrees Premier League return', playerName: 'Ivan Toney', fromClubName: 'Al-Ahli', toClubName: 'Everton', league: 'Premier League', confidence: 1, claimedDaysAgo: 52, resolved: { outcome: 'true', daysAgo: 31 } },
];

const DAY_MS = 86_400_000;

/** Populates the wire with demo claims once, and only into an empty table. */
async function seedDemoClaimsIfNeeded(now: number): Promise<void> {
  if (await hasFlag(DEMO_CLAIMS_FLAG)) {
    return;
  }
  const existing = await db.select({ id: claims.id }).from(claims).limit(1);
  if (existing.length === 0) {
    await db.insert(claims).values(
      SEED_CLAIMS.map((c) => ({
        id: newId(),
        journalistId: c.journalistId,
        headline: c.headline,
        playerName: c.playerName,
        fromClubName: c.fromClubName ?? null,
        toClubName: c.toClubName,
        league: c.league ?? null,
        confidence: c.confidence,
        transferWindow: '2026-summer',
        claimedAt: now - c.claimedDaysAgo * DAY_MS,
        status: c.resolved ? ('resolved' as const) : ('pending' as const),
        outcome: c.resolved?.outcome ?? null,
        resolvedAt: c.resolved ? now - c.resolved.daysAgo * DAY_MS : null,
        createdAt: now,
      })),
    );
  }
  await db.insert(appMeta).values({ key: DEMO_CLAIMS_FLAG, value: new Date(now).toISOString() });
}

/**
 * True when the app_meta flag row exists. Uses select().limit(1) rather than
 * db.query.findFirst — the sql-js driver returns a truthy husk object for
 * findFirst on an empty table, which silently skipped seeding on web.
 */
async function hasFlag(key: string): Promise<boolean> {
  const rows = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1);
  return rows.length > 0;
}

/** Inserts well-known journalists on first launch. Idempotent via app_meta flags. */
export async function seedIfNeeded(): Promise<void> {
  const now = Date.now();
  if (!(await hasFlag(SEED_FLAG))) {
    await db.insert(journalists).values(
      SEED_JOURNALISTS.map((j) => ({
        ...j,
        avatarColor: avatarColorFor(j.name),
        isSeeded: true,
        createdAt: now,
      })),
    );
    await db.insert(appMeta).values({ key: SEED_FLAG, value: new Date(now).toISOString() });
  }
  await backfillHandlesIfNeeded(now);
  await seedDemoClaimsIfNeeded(now);
}

/** Databases seeded before the handle column existed get handles by name. */
async function backfillHandlesIfNeeded(now: number): Promise<void> {
  if (await hasFlag(HANDLE_BACKFILL_FLAG)) {
    return;
  }
  for (const seed of SEED_JOURNALISTS) {
    try {
      await db
        .update(journalists)
        .set({ handle: seed.handle })
        .where(and(eq(journalists.name, seed.name), isNull(journalists.handle)));
    } catch {
      // Handle already taken by a user-created journalist — leave theirs.
    }
  }
  await db.insert(appMeta).values({ key: HANDLE_BACKFILL_FLAG, value: new Date(now).toISOString() });
}
