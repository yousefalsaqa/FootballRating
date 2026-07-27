import journalists from '../../src/db/seed-journalists.json';

/**
 * Ingest worker: polls Google News for each tracked journalist, has Claude
 * Haiku extract structured transfer claims from the fresh headlines, and
 * serves them as JSON for the app's Incoming inbox.
 *
 * Storage (KV):
 *   seen:<link-hash>   — article already processed (TTL 7d)
 *   draft:<claim-key>  — extracted claim draft (TTL 72h)
 */

interface Env {
  INGEST_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
}

interface FeedItem {
  journalistId: string;
  journalistName: string;
  title: string;
  link: string;
  pubDate: number;
}

export interface ClaimDraft {
  id: string;
  journalistId: string;
  headline: string;
  playerName: string;
  fromClubName: string | null;
  toClubName: string;
  league: string | null;
  confidence: 1 | 2 | 3;
  sourceUrl: string;
  reportedAt: number;
}

const MAX_ITEMS_PER_RUN = 25;
const MAX_ARTICLE_AGE_MS = 24 * 60 * 60 * 1000;
const DRAFT_TTL_SECONDS = 72 * 60 * 60;
const SEEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'content-type': 'application/json',
};

/** Minimal RSS <item> parser — Workers have no DOMParser. */
function parseRssItems(xml: string): { title: string; link: string; pubDate: number }[] {
  const items: { title: string; link: string; pubDate: number }[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const pubDate = pubDateRaw ? Date.parse(pubDateRaw) : NaN;
    if (title && link && !Number.isNaN(pubDate)) {
      items.push({ title: decodeXmlEntities(title), link, pubDate });
    }
  }
  return items;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function sha1(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Collects fresh, unseen feed items across all tracked journalists. */
async function collectFreshItems(env: Env, now: number): Promise<FeedItem[]> {
  const fresh: FeedItem[] = [];
  for (const journalist of journalists) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${journalist.name}" transfer`)}&hl=en-GB&gl=GB&ceid=GB:en`;
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'journalist-rater-ingest/1.0' } });
      if (!response.ok) {
        continue;
      }
      const xml = await response.text();
      for (const item of parseRssItems(xml)) {
        if (now - item.pubDate > MAX_ARTICLE_AGE_MS) {
          continue;
        }
        const seenKey = `seen:${await sha1(item.link)}`;
        if (await env.INGEST_KV.get(seenKey)) {
          continue;
        }
        await env.INGEST_KV.put(seenKey, '1', { expirationTtl: SEEN_TTL_SECONDS });
        fresh.push({
          journalistId: journalist.id,
          journalistName: journalist.name,
          ...item,
        });
      }
    } catch (error) {
      console.error(`Feed failed for ${journalist.name}`, error);
    }
  }
  return fresh.slice(0, MAX_ITEMS_PER_RUN);
}

const EXTRACTION_PROMPT = `You extract football transfer claims from news headlines for a journalist-reliability tracker.

Input: a JSON array of {index, journalist, title} where title is a news headline mentioning that journalist.

For each item decide whether the HEADLINE reports a specific, attributable transfer claim MADE BY THAT JOURNALIST (a transfer/contract report they broke — not opinion pieces, rankings, quizzes, aggregator roundups, or claims attributed to someone else).

Reply with ONLY a JSON array (no prose). For each item that IS a claim, include:
{
  "index": number,
  "headline": string,        // concise claim restatement, max 90 chars
  "playerName": string,
  "fromClubName": string|null,
  "toClubName": string,      // for contract renewals/stays, the current club
  "league": string|null,     // league of the destination club
  "confidence": 1|2|3        // 1 speculative/interest, 2 advanced/agreed-terms, 3 confirmed/"here we go"/done
}
Omit items that are not claims. If unsure, omit.`;

/** Asks Claude to turn raw headlines into structured claim drafts. */
async function extractClaims(env: Env, items: FeedItem[]): Promise<ClaimDraft[]> {
  if (!items.length) {
    return [];
  }
  const payload = items.map((item, index) => ({
    index,
    journalist: item.journalistName,
    title: item.title,
  }));
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
  });
  if (!response.ok) {
    console.error('Claude API error', response.status, await response.text());
    return [];
  }
  const body = (await response.json()) as { content: { type: string; text?: string }[] };
  const text = body.content.find((c) => c.type === 'text')?.text ?? '[]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
  } catch {
    console.error('Unparseable extraction output', text.slice(0, 300));
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const drafts: ClaimDraft[] = [];
  for (const entry of parsed as Record<string, unknown>[]) {
    const index = Number(entry.index);
    const source = items[index];
    if (
      !source ||
      typeof entry.headline !== 'string' ||
      typeof entry.playerName !== 'string' ||
      typeof entry.toClubName !== 'string' ||
      ![1, 2, 3].includes(Number(entry.confidence))
    ) {
      continue;
    }
    drafts.push({
      id: `${source.journalistId}:${slugify(`${entry.playerName}-${entry.toClubName}`)}`,
      journalistId: source.journalistId,
      headline: entry.headline.slice(0, 120),
      playerName: entry.playerName,
      fromClubName: typeof entry.fromClubName === 'string' ? entry.fromClubName : null,
      toClubName: entry.toClubName,
      league: typeof entry.league === 'string' ? entry.league : null,
      confidence: Number(entry.confidence) as 1 | 2 | 3,
      sourceUrl: source.link,
      reportedAt: source.pubDate,
    });
  }
  return drafts;
}

async function runIngest(env: Env): Promise<void> {
  const now = Date.now();
  const items = await collectFreshItems(env, now);
  const drafts = await extractClaims(env, items);
  for (const draft of drafts) {
    // Keyed by journalist+player+destination: repeat coverage overwrites, not duplicates.
    await env.INGEST_KV.put(`draft:${draft.id}`, JSON.stringify(draft), {
      expirationTtl: DRAFT_TTL_SECONDS,
    });
  }
  console.log(`Ingest run: ${items.length} fresh items → ${drafts.length} drafts`);
}

async function listDrafts(env: Env): Promise<ClaimDraft[]> {
  const list = await env.INGEST_KV.list({ prefix: 'draft:' });
  const drafts: ClaimDraft[] = [];
  for (const key of list.keys) {
    const value = await env.INGEST_KV.get(key.name);
    if (value) {
      drafts.push(JSON.parse(value) as ClaimDraft);
    }
  }
  return drafts.sort((a, b) => b.reportedAt - a.reportedAt);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runIngest(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname === '/claims') {
      return new Response(JSON.stringify({ claims: await listDrafts(env) }), {
        headers: CORS_HEADERS,
      });
    }
    // Manual trigger for testing: /run (also lets us verify before the cron fires).
    if (url.pathname === '/run') {
      await runIngest(env);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
    }
    return new Response('journalist-rater-ingest', { headers: { 'content-type': 'text/plain' } });
  },
};
