import { and, eq, inArray, isNull, like } from 'drizzle-orm';

import { db } from '@/db/client';
import { appMeta, claims, journalists, type ClaimOutcome, type Confidence } from '@/db/schema';
import { avatarColorFor } from '@/lib/constants';
import { newId } from '@/lib/id';

const HANDLE_BACKFILL_FLAG = 'seeded.handles.v2';
const DEMO_CLAIMS_V2_FLAG = 'seeded.demo-claims.v2';

/**
 * Seed ids are FIXED strings (not per-install UUIDs) so exports from one
 * device merge cleanly into another instead of duplicating the seeded rows.
 * Seeding is idempotent by id: new entries added here reach existing installs.
 */
const SEED_JOURNALISTS: { id: string; name: string; outlet: string; handle: string }[] = [
  { id: 'seed-fabrizio-romano', name: 'Fabrizio Romano', outlet: 'Independent', handle: 'fabrizioromano' },
  { id: 'seed-david-ornstein', name: 'David Ornstein', outlet: 'The Athletic', handle: 'david_ornstein' },
  { id: 'seed-florian-plettenberg', name: 'Florian Plettenberg', outlet: 'Sky Sport DE', handle: 'plettigoal' },
  { id: 'seed-gianluca-di-marzio', name: 'Gianluca Di Marzio', outlet: 'Sky Sport IT', handle: 'dimarzio' },
  { id: 'seed-christian-falk', name: 'Christian Falk', outlet: 'BILD', handle: 'cfbayern' },
  { id: 'seed-matteo-moretto', name: 'Matteo Moretto', outlet: 'Relevo', handle: 'mattemoretto' },
  { id: 'seed-ben-jacobs', name: 'Ben Jacobs', outlet: 'talkSPORT', handle: 'jacobsben' },
  { id: 'seed-alfredo-pedulla', name: 'Alfredo Pedullà', outlet: 'Sportitalia', handle: 'alfredopedulla' },
  { id: 'seed-nicolo-schira', name: 'Nicolò Schira', outlet: 'Independent', handle: 'nicoschira' },
  { id: 'seed-dharmesh-sheth', name: 'Dharmesh Sheth', outlet: 'Sky Sports', handle: 'skysports_sheth' },
  { id: 'seed-santi-aouna', name: 'Santi Aouna', outlet: 'Foot Mercato', handle: 'santi_j_fm' },
  { id: 'seed-sacha-tavolieri', name: 'Sacha Tavolieri', outlet: 'Sky Sport CH', handle: 'sachatavolieri' },
  { id: 'seed-mike-mcgrath', name: 'Mike McGrath', outlet: 'The Telegraph', handle: 'mcgrathmike' },
  { id: 'seed-simon-stone', name: 'Simon Stone', outlet: 'BBC Sport', handle: 'sistoney67' },
  { id: 'seed-cesar-luis-merlo', name: 'César Luis Merlo', outlet: 'TyC Sports', handle: 'clmerlo' },
];

interface SeedClaim {
  journalistId: string;
  headline: string;
  playerName: string;
  fromClubName?: string;
  toClubName: string;
  league?: string;
  confidence: Confidence;
  sourceUrl?: string;
  /** Days ago the claim was made; 0 = today. */
  claimedDaysAgo: number;
  /** Present = resolved that many days ago. */
  resolved?: { outcome: ClaimOutcome; daysAgo: number };
}

/**
 * Real, publicly-reported claims from the 2026 summer window (as of 27 Jul
 * 2026), with sources attached. Nothing invented — pending items resolve as
 * the window plays out.
 */
const SEED_CLAIMS_V2: SeedClaim[] = [
  {
    journalistId: 'seed-fabrizio-romano',
    headline: 'Yan Diomande to Real Madrid, here we go — fee in excess of €100m',
    playerName: 'Yan Diomande',
    fromClubName: 'RB Leipzig',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 3,
    sourceUrl: 'https://x.com/FabrizioRomano/status/2081453698962592146',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Diomande–Madrid not finalized: negotiations still ongoing',
    playerName: 'Yan Diomande',
    fromClubName: 'RB Leipzig',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 2,
    sourceUrl: 'https://www.bavarianfootballworks.com/off-the-crossbar/236021/media-wars-florian-plettenberg-and-fabrizio-romano-go-toe-to-toe-over-accusations-of-fake-news',
    claimedDaysAgo: 1,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Summerville to Al-Hilal in €70m+ deal, medical completed',
    playerName: 'Crysencio Summerville',
    fromClubName: 'Liverpool',
    toClubName: 'Al-Hilal',
    league: 'Saudi Pro League',
    confidence: 3,
    sourceUrl: 'https://www.empireofthekop.com/2026/07/23/liverpool-target-agrees-four-year-deal-as-ornstein-confirms-medical-done-on-tuesday/',
    claimedDaysAgo: 6,
    resolved: { outcome: 'true', daysAgo: 4 },
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Newcastle’s £46m Bergvall offer rejected by Tottenham',
    playerName: 'Lucas Bergvall',
    fromClubName: 'Tottenham',
    toClubName: 'Newcastle',
    league: 'Premier League',
    confidence: 2,
    sourceUrl: 'https://sports.yahoo.com/articles/david-ornstein-just-confirmed-tottenham-060001397.html',
    claimedDaysAgo: 3,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Real Madrid operating on basis Rodri arrives this summer',
    playerName: 'Rodri',
    fromClubName: 'Manchester City',
    toClubName: 'Real Madrid',
    league: 'La Liga',
    confidence: 2,
    sourceUrl: 'https://www.footballtransfers.com/en/transfer-news/uk-premier-league/2026/07/real-madrid-rodri-david-ornstein',
    claimedDaysAgo: 7,
  },
  {
    journalistId: 'seed-david-ornstein',
    headline: 'Arsenal exploring sensational Vinícius Jr move — no talks yet',
    playerName: 'Vinícius Júnior',
    fromClubName: 'Real Madrid',
    toClubName: 'Arsenal',
    league: 'Premier League',
    confidence: 1,
    sourceUrl: 'https://www.footballtransfers.com/en/transfer-news/uk-premier-league/2026/07/arsenal-transfer-news-vinicius-jr-david-ornstein',
    claimedDaysAgo: 5,
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Bayern and Nathaniel Brown reach full verbal agreement',
    playerName: 'Nathaniel Brown',
    fromClubName: 'Eintracht Frankfurt',
    toClubName: 'Bayern München',
    league: 'Bundesliga',
    confidence: 3,
    sourceUrl: 'https://www.bavarianfootballworks.com/bayern-munich-transfer-news-rumors/233743/bayern-munich-keeping-eyes-ears-open-in-transfer-market-but-are-pleased-with-current-squad',
    claimedDaysAgo: 14,
    resolved: { outcome: 'true', daysAgo: 7 },
  },
  {
    journalistId: 'seed-florian-plettenberg',
    headline: 'Musiala–Galatasaray links are nonsense: 100% staying at Bayern',
    playerName: 'Jamal Musiala',
    toClubName: 'Bayern München',
    league: 'Bundesliga',
    confidence: 3,
    sourceUrl: 'https://www.sportsmole.co.uk/people/florian-plettenberg/',
    claimedDaysAgo: 6,
  },
  {
    journalistId: 'seed-gianluca-di-marzio',
    headline: 'Como third bid for Chalobah accepted — ready to close',
    playerName: 'Trevoh Chalobah',
    fromClubName: 'Chelsea',
    toClubName: 'Como',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://www.talkchelsea.net/transfers/jacobs-contradicts-di-marzio-defenders-future/',
    claimedDaysAgo: 2,
  },
  {
    journalistId: 'seed-ben-jacobs',
    headline: 'Chalobah bids rejected — no agreement with Como',
    playerName: 'Trevoh Chalobah',
    fromClubName: 'Chelsea',
    toClubName: 'Como',
    league: 'Serie A',
    confidence: 2,
    sourceUrl: 'https://www.talkchelsea.net/transfers/jacobs-contradicts-di-marzio-defenders-future/',
    claimedDaysAgo: 2,
  },
];

/** Headlines of the retired v1 fake demo set — deleted from seeded installs. */
const V1_FAKE_HEADLINES = [
  'Haaland agreement with Real Madrid at advanced stage',
  'Nico Williams to Bayern, here we go',
  'Osimhen to Juventus, done deal — here we go',
  'Kudus set for Newcastle medical',
  'Arsenal agree £70m package for Rodrygo',
  'Saka signs new long-term Arsenal contract',
  'Liverpool exploring Zubimendi release clause',
  'Woltemade to Chelsea at advanced stage',
  'Bayern medical booked for Wirtz',
  'Leverkusen close to Sesko deal',
  'Leão–PSG talks opened via intermediaries',
  'Inter agree terms with Gudmundsson',
  'Kimmich agrees Bayern extension to 2029',
  'City agree Musiala release-clause package',
  'Chelsea preparing €60m bid for Fermín',
  'Vinícius renewal stalled amid Saudi push',
  'Atlético close on Sørloth replacement Gyökeres',
  'Garnacho-to-Chelsea talks revived',
  'Toney agrees Premier League return',
];

const DAY_MS = 86_400_000;

/** Replaces the retired fake wire with real, sourced claims. Runs once. */
async function seedRealClaimsIfNeeded(now: number): Promise<void> {
  if (await hasFlag(DEMO_CLAIMS_V2_FLAG)) {
    return;
  }
  // Purge the v1 invented claims (only from seeded journalists, by exact headline).
  await db
    .delete(claims)
    .where(and(like(claims.journalistId, 'seed-%'), inArray(claims.headline, V1_FAKE_HEADLINES)));

  const existingHeadlines = new Set(
    (await db.select({ headline: claims.headline }).from(claims)).map((r) => r.headline),
  );
  const fresh = SEED_CLAIMS_V2.filter((c) => !existingHeadlines.has(c.headline));
  if (fresh.length) {
    await db.insert(claims).values(
      fresh.map((c) => ({
        id: newId(),
        journalistId: c.journalistId,
        headline: c.headline,
        playerName: c.playerName,
        fromClubName: c.fromClubName ?? null,
        toClubName: c.toClubName,
        league: c.league ?? null,
        confidence: c.confidence,
        transferWindow: '2026-summer',
        sourceUrl: c.sourceUrl ?? null,
        claimedAt: now - c.claimedDaysAgo * DAY_MS,
        status: c.resolved ? ('resolved' as const) : ('pending' as const),
        outcome: c.resolved?.outcome ?? null,
        resolvedAt: c.resolved ? now - c.resolved.daysAgo * DAY_MS : null,
        createdAt: now,
      })),
    );
  }
  await db.insert(appMeta).values({ key: DEMO_CLAIMS_V2_FLAG, value: new Date(now).toISOString() });
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

/** Seeds journalists (insert-missing by fixed id) and the real-claims wire. */
export async function seedIfNeeded(): Promise<void> {
  const now = Date.now();
  const existingIds = new Set(
    (await db.select({ id: journalists.id }).from(journalists)).map((r) => r.id),
  );
  const missing = SEED_JOURNALISTS.filter((j) => !existingIds.has(j.id));
  if (missing.length) {
    await db.insert(journalists).values(
      missing.map((j) => ({
        ...j,
        avatarColor: avatarColorFor(j.name),
        isSeeded: true,
        createdAt: now,
      })),
    );
  }
  await backfillHandlesIfNeeded(now);
  await seedRealClaimsIfNeeded(now);
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
