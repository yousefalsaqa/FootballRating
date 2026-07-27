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
  /** Free-tier Workers AI binding — the default extractor. */
  AI: { run(model: string, options: Record<string, unknown>): Promise<{ response?: string }> };
  /** Optional: switches extraction to Claude Haiku when set. */
  ANTHROPIC_API_KEY?: string;
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

const MAX_ITEMS_PER_RUN = 8;
const MAX_PARSED_BLOCKS = 120;
const MAX_ARTICLE_AGE_MS = 48 * 60 * 60 * 1000;
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
  // Cap parsing work — free-tier Workers have a tight CPU budget.
  const itemBlocks = (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, MAX_PARSED_BLOCKS);
  for (const block of itemBlocks) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const pubDate = pubDateRaw ? Date.parse(pubDateRaw) : NaN;
    if (title && link && !Number.isNaN(pubDate)) {
      items.push({
        title: decodeXmlEntities(title),
        link: unwrapBingLink(decodeXmlEntities(link)),
        pubDate,
      });
    }
  }
  return items;
}

/** Bing wraps article links in a redirect — unwrap to the real URL. */
function unwrapBingLink(link: string): string {
  try {
    const parsed = new URL(link);
    if (parsed.hostname.endsWith('bing.com')) {
      const real = parsed.searchParams.get('url');
      if (real) {
        return decodeURIComponent(real);
      }
    }
  } catch {
    // fall through with the original link
  }
  return link;
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

/** Bing News RSS — Google News 503s requests from Cloudflare's network. */
function feedUrlFor(name: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(`"${name}" transfer`)}&format=rss`;
}

const FEED_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/rss+xml, application/xml, text/xml',
};

/**
 * Collects fresh, unseen feed items for ONE journalist per run, rotating
 * through the roster via a KV cursor — the free tier's CPU budget cannot
 * sweep all fifteen feeds in a single invocation.
 */
async function collectFreshItems(env: Env, now: number): Promise<FeedItem[]> {
  const cursor = Number((await env.INGEST_KV.get('cursor')) ?? '0') % journalists.length;
  const journalist = journalists[cursor];
  await env.INGEST_KV.put('cursor', String(cursor + 1));
  if (!journalist) {
    return [];
  }
  const fresh: FeedItem[] = [];
  try {
    const response = await fetch(feedUrlFor(journalist.name), { headers: FEED_HEADERS });
    if (!response.ok) {
      console.error(`Feed ${response.status} for ${journalist.name}`);
      return [];
    }
    const xml = await response.text();
    for (const item of parseRssItems(xml)) {
      if (fresh.length >= MAX_ITEMS_PER_RUN || now - item.pubDate > MAX_ARTICLE_AGE_MS) {
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
  return fresh;
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

/** Runs a prompt on Claude (if a key is set) or free Workers AI. */
async function runModelWith(env: Env, systemPrompt: string, userContent: string): Promise<string> {
  if (env.ANTHROPIC_API_KEY) {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as { content: { type: string; text?: string }[] };
    return body.content.find((c) => c.type === 'text')?.text ?? '[]';
  }
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 2000,
  });
  // Some models return the payload as an already-parsed object.
  return typeof result.response === 'string' ? result.response : JSON.stringify(result.response ?? []);
}

/** Asks the model to turn raw headlines into structured claim drafts. */
async function extractClaims(env: Env, items: FeedItem[]): Promise<ClaimDraft[]> {
  if (!items.length) {
    return [];
  }
  const payload = items.map((item, index) => ({
    index,
    journalist: item.journalistName,
    title: item.title,
  }));
  let text: string;
  try {
    text = await runModelWith(env, EXTRACTION_PROMPT, JSON.stringify(payload));
  } catch (error) {
    console.error('Extraction model failed', error);
    return [];
  }
  // Models sometimes wrap JSON in prose/fences — grab the array.
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  text = arrayMatch ? arrayMatch[0] : text;
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

interface ResolveRequestClaim {
  id: string;
  headline: string;
  playerName: string;
  toClubName: string;
  fromClubName?: string | null;
}

const RESOLUTION_PROMPT = `You judge the outcomes of football transfer claims for a reliability tracker.

Input: a JSON array of claims, each with {id, claim, evidence} where evidence is recent news headlines about that player/club.

For each claim decide the outcome STRICTLY from the evidence:
- "true": the evidence clearly shows the reported move/agreement was completed (official, unveiled, medical done, deal announced).
- "false": the evidence clearly shows it collapsed, was rejected and abandoned, or the player verifiably moved elsewhere / stayed put against the claim.
- "partial": the essentials happened but materially different (different fee structure reported as decisive, loan instead of transfer, etc).
- "unknown": evidence is insufficient, mixed, or the story is clearly still in progress. WHEN IN DOUBT, ANSWER "unknown" — a wrong verdict is far worse than no verdict.

Reply with ONLY a JSON array: [{"id": string, "outcome": "true"|"partial"|"false"|"unknown"}].`;

const MAX_RESOLVE_CLAIMS = 5;
const RESOLVE_PARSED_BLOCKS = 15;
const RESOLVE_EVIDENCE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Gathers headline evidence and asks the model to rule on pending claims. */
async function resolveClaims(
  env: Env,
  requested: ResolveRequestClaim[],
): Promise<{ id: string; outcome: string }[]> {
  const batch = requested.slice(0, MAX_RESOLVE_CLAIMS);
  const now = Date.now();
  const payload: { id: string; claim: string; evidence: string[] }[] = [];
  for (const claim of batch) {
    let evidence: string[] = [];
    try {
      const query = `${claim.playerName} ${claim.toClubName}`;
      const response = await fetch(
        `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`,
        { headers: FEED_HEADERS },
      );
      if (response.ok) {
        const xml = await response.text();
        evidence = parseRssItems(xml)
          .slice(0, RESOLVE_PARSED_BLOCKS)
          .filter((i) => now - i.pubDate < RESOLVE_EVIDENCE_AGE_MS)
          .map((i) => i.title);
      }
    } catch (error) {
      console.error(`Evidence fetch failed for ${claim.playerName}`, error);
    }
    payload.push({ id: claim.id, claim: claim.headline, evidence });
  }
  let text: string;
  try {
    text = await runModelWith(env, RESOLUTION_PROMPT, JSON.stringify(payload));
  } catch (error) {
    console.error('Resolution model failed', error);
    return [];
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  try {
    const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : text) as { id?: string; outcome?: string }[];
    return parsed
      .filter((v) => typeof v.id === 'string' && ['true', 'partial', 'false', 'unknown'].includes(v.outcome ?? ''))
      .map((v) => ({ id: v.id as string, outcome: v.outcome as string }));
  } catch {
    console.error('Unparseable resolution output', text.slice(0, 200));
    return [];
  }
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

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { ...CORS_HEADERS, 'Access-Control-Allow-Headers': 'content-type' },
      });
    }
    // Outcome check for pending claims (max 5 per call).
    if (url.pathname === '/resolve' && request.method === 'POST') {
      let body: { claims?: ResolveRequestClaim[] };
      try {
        body = (await request.json()) as { claims?: ResolveRequestClaim[] };
      } catch {
        return new Response(JSON.stringify({ verdicts: [] }), { headers: CORS_HEADERS });
      }
      const verdicts = await resolveClaims(env, body.claims ?? []);
      return new Response(JSON.stringify({ verdicts }), { headers: CORS_HEADERS });
    }
    if (url.pathname === '/claims') {
      return new Response(JSON.stringify({ claims: await listDrafts(env) }), {
        headers: CORS_HEADERS,
      });
    }
    // Manual trigger: fire-and-forget (a full cycle outlives request timeouts).
    if (url.pathname === '/run') {
      ctx.waitUntil(runIngest(env));
      return new Response(JSON.stringify({ started: true }), { headers: CORS_HEADERS });
    }
    // Diagnostics: fetch one feed and run a trivial AI prompt, report results.
    if (url.pathname === '/debug') {
      const debug: Record<string, unknown> = {};
      try {
        const first = journalists[0];
        const response = await fetch(feedUrlFor(first?.name ?? 'football'), { headers: FEED_HEADERS });
        debug.feedStatus = response.status;
        const xml = await response.text();
        const items = parseRssItems(xml);
        debug.itemsParsed = items.length;
        debug.firstTitles = items.slice(0, 3).map((i) => i.title);
      } catch (error) {
        debug.feedError = String(error);
      }
      try {
        const ai = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 10,
        });
        debug.aiResponse = ai.response;
      } catch (error) {
        debug.aiError = String(error);
      }
      const drafts = await env.INGEST_KV.list({ prefix: 'draft:' });
      const seen = await env.INGEST_KV.list({ prefix: 'seen:' });
      debug.draftCount = drafts.keys.length;
      debug.seenCount = seen.keys.length;
      return new Response(JSON.stringify(debug, null, 2), { headers: CORS_HEADERS });
    }
    return new Response('journalist-rater-ingest', { headers: { 'content-type': 'text/plain' } });
  },
};
