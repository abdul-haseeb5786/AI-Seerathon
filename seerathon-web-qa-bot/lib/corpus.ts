// Thin client for the Seerathon corpus API.
//
// Base: https://api.islamicdesk.com/api/seerathon/corpus
//
// CONFIRMED against a real response (checked 2026-08-13, via a live
// /meta and /shamail?limit=1 call):
//   { error, data: { items: [...], total, page, limit, pages }, msg }
//   item: {
//     id, source, category: { id, name: {en, ur} },
//     slug: {en, romanUrdu}, keywords: string[],
//     en: { title, hadeesTarjama, hadeesHawala, type, points: string[] },
//     ur: { ...same shape... }
//   }
// `hadeesTarjama` is the actual entry text. `hadeesHawala` (the hadith
// reference, e.g. "Sahih Bukhari 3560") is sometimes only filled in on the
// `ur` block even when `en` exists for the same entry — so hawala falls
// back to `ur` if `en` is empty, rather than just reading `en`.
//
// Timeline shape is INFERRED from this (same API, same team, same bilingual
// convention) but not yet confirmed against a real /timeline response —
// tighten normalizeList's fallbacks below once you've seen one.

const BASE = process.env.SEERATHON_CORPUS_BASE ?? 'https://api.islamicdesk.com/api/seerathon/corpus';

export type CorpusSource = 'shamail' | 'timeline';

export type NormalizedEntry = {
  id: string;
  source: CorpusSource;
  title: string;
  text: string;
  hawala?: string;
  points: string[];
  keywords: string[];
  category?: string;
};

function authHeaders(): Record<string, string> {
  const key = process.env.SEERATHON_API_KEY;
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

async function corpusFetch(path: string, params: Record<string, string | number | boolean> = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Corpus API ${path} responded ${res.status}`);
  }
  return res.json();
}

export async function getMeta(): Promise<any> {
  return corpusFetch('/meta');
}

export async function getCourses(): Promise<any> {
  return corpusFetch('/courses');
}

export async function getShamailById(id: string): Promise<any> {
  return corpusFetch(`/shamail/${id}`);
}

export async function getTimelineById(id: string): Promise<any> {
  return corpusFetch(`/timeline/${id}`);
}

// --- Full-corpus fetch with a short in-memory cache ---------------------
// Only ~120 Shamail + ~34 Timeline entries total (per /meta counts), so
// fetching everything and scoring locally — using the `keywords` field the
// corpus already provides — is more reliable than trusting the API's own
// `?q=` ranking, which is undocumented and unverified. Caching matters for
// a second reason: /meta reports a 60 req/min per-IP rate limit, and
// without a cache, every single chat message would spend 2 of those 60 on
// corpus fetches alone — easy to blow through with a few people testing at
// once during a demo.

type Cached<T> = { data: T; expiresAt: number };
let shamailCache: Cached<NormalizedEntry[]> | null = null;
let timelineCache: Cached<NormalizedEntry[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllShamail(): Promise<NormalizedEntry[]> {
  if (shamailCache && shamailCache.expiresAt > Date.now()) return shamailCache.data;
  const raw = await corpusFetch('/shamail', { limit: 120 });
  const data = normalizeList(raw, 'shamail');
  shamailCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getAllTimeline(): Promise<NormalizedEntry[]> {
  if (timelineCache && timelineCache.expiresAt > Date.now()) return timelineCache.data;
  const raw = await corpusFetch('/timeline', { limit: 120 });
  const data = normalizeList(raw, 'timeline');
  timelineCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

// The corpus itself uses the ﷺ ligature (U+FDFA) throughout its title/text
// fields. That single codepoint has almost no font coverage anywhere —
// confirmed by testing several fonts including a dedicated Arabic one, all
// rendered a broken box — while the fully spelled-out phrase renders
// correctly everywhere. This swaps the encoding only, not the meaning, the
// same way normalizing smart quotes isn't "changing a quotation." Applied
// at the normalization boundary so it's consistent everywhere the corpus's
// own text is displayed, without touching what's actually stored/reasoned
// about internally.
function normalizeHonorific(text: string): string {
  if (!text.includes('\uFDFA')) return text;
  return text
    .replace(/\uFDFA/g, ' \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeList(raw: any, source: CorpusSource): NormalizedEntry[] {
  const items = raw?.data?.items ?? raw?.data ?? raw?.results ?? raw?.items ?? (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(items)) return [];

  return items.map((item: any): NormalizedEntry => {
    const primary = item.en ?? item.ur ?? {};
    return {
      id: String(item.id ?? item._id ?? ''),
      source,
      title: normalizeHonorific(
        primary.title ?? item.title ?? `${source === 'shamail' ? 'Shamail' : 'Timeline'} entry`,
      ),
      text: normalizeHonorific(
        primary.hadeesTarjama ?? primary.text ?? primary.description ?? item.text ?? item.content ?? '',
      ),
      hawala: item.en?.hadeesHawala || item.ur?.hadeesHawala || undefined,
      points: (Array.isArray(primary.points) ? primary.points : []).map(normalizeHonorific),
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      category:
        item.category?.name?.en ?? (typeof item.category?.name === 'string' ? item.category.name : undefined),
    };
  });
}
