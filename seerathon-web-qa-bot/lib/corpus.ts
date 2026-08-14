// Thin client for the Seerathon corpus API.
//
// Base: https://api.islamicdesk.com/api/seerathon/corpus
//
// CONFIRMED against real live responses (checked 2026-08-14):
//
// Shamail: { data: { items: [{ id, source, category, keywords: string[],
//   en/ur: { title, hadeesTarjama, hadeesHawala, points: string[] } }] } }
//
// Timeline: a DIFFERENT shape, not just different field names —
//   { data: { items: [{ id, source, slug: {en, romanUrdu},
//     en/ur: { title, description, section, gregorianDate,
//       content: [{ title, sequence, content_text }, ...] } } }] } }
//   No `hadeesTarjama`, no `hadeesHawala`, no `keywords` at all. The real
//   text lives in the `content[]` array — one Timeline item (e.g. "Blessed
//   Birth") can bundle several dated sub-events (the birth itself, the
//   father's passing, etc.), each with its own title + content_text.
//   `description` exists but is an empty string on real data, which is what
//   broke the old shared normalizer: `??` only falls through on
//   null/undefined, not `""`, so it stopped there and returned empty text
//   for every single Timeline entry — meaning none of them ever had enough
//   text to be considered a candidate, regardless of the question asked.

import { tokenize } from './text';

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
// Only ~120 Shamail + ~34 Timeline entries total, so fetching everything
// and scoring locally is more reliable than trusting the API's own
// undocumented `?q=` ranking. Caching protects against /meta's documented
// 60 req/min/IP rate limit — uncached, every chat message would spend 2 of
// those on corpus fetches alone.

type Cached<T> = { data: T; expiresAt: number };
let shamailCache: Cached<NormalizedEntry[]> | null = null;
let timelineCache: Cached<NormalizedEntry[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllShamail(): Promise<NormalizedEntry[]> {
  if (shamailCache && shamailCache.expiresAt > Date.now()) return shamailCache.data;
  const raw = await corpusFetch('/shamail', { limit: 120 });
  const data = extractItems(raw).map(normalizeShamailItem);
  shamailCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getAllTimeline(): Promise<NormalizedEntry[]> {
  if (timelineCache && timelineCache.expiresAt > Date.now()) return timelineCache.data;
  const raw = await corpusFetch('/timeline', { limit: 120 });
  const data = extractItems(raw).map(normalizeTimelineItem);
  timelineCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

function extractItems(raw: any): any[] {
  const items = raw?.data?.items ?? raw?.data ?? raw?.results ?? raw?.items ?? (Array.isArray(raw) ? raw : []);
  return Array.isArray(items) ? items : [];
}

function normalizeShamailItem(item: any): NormalizedEntry {
  const primary = item.en ?? item.ur ?? {};
  return {
    id: String(item.id ?? item._id ?? ''),
    source: 'shamail',
    title: primary.title ?? 'Shamail entry',
    text: primary.hadeesTarjama ?? '',
    // Sometimes only the `ur` block has hawala filled in even when `en`
    // exists for the same entry — fall back rather than showing nothing.
    hawala: item.en?.hadeesHawala || item.ur?.hadeesHawala || undefined,
    points: Array.isArray(primary.points) ? primary.points : [],
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    category: item.category?.name?.en ?? (typeof item.category?.name === 'string' ? item.category.name : undefined),
  };
}

function normalizeTimelineItem(item: any): NormalizedEntry {
  const primary = item.en ?? item.ur ?? {};
  const sections: any[] = Array.isArray(primary.content) ? primary.content : [];

  // Combine every dated sub-event into one readable body, sub-headed by
  // its own title, in sequence order.
  const text = sections
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((s) => (s.title ? `${s.title}\n${s.content_text ?? ''}` : (s.content_text ?? '')))
    .filter(Boolean)
    .join('\n\n');

  // Timeline items ship no `keywords` field at all (unlike Shamail), so
  // this derives equivalent signal from the slug and each sub-section's
  // title. Runs through the SAME tokenize() used for scoring — not a raw
  // split — specifically because a raw split let generic words like "his"
  // through as if they were curated +3 keywords (title: "...Under the Care
  // of His Grandfather..." vs question "...treat HIS neighbors" — wrong
  // match, confirmed during testing). Keywords should be content words,
  // not function words, same bar as everywhere else.
  const slugText = (item.slug?.en ?? '').replace(/-/g, ' ');
  const sectionTitleText = sections.map((s) => s.title ?? '').join(' ');
  const keywords = [
    ...tokenize(slugText),
    ...(primary.section ? [primary.section] : []),
    ...tokenize(sectionTitleText),
  ];

  // No hadith reference on Timeline entries, but the year is real,
  // citeable context — use it as the hawala-equivalent when present.
  const hawala = primary.gregorianDate ? `${primary.gregorianDate} CE` : undefined;

  return {
    id: String(item.id ?? item._id ?? ''),
    source: 'timeline',
    title: primary.title ?? 'Timeline entry',
    text,
    hawala,
    points: [],
    keywords,
    category: primary.section ?? undefined,
  };
}
