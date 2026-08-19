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
  const data = extractItems(raw).flatMap(normalizeTimelineItem);
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

// Returns ONE NormalizedEntry PER SUB-SECTION, not one per API item.
//
// A real Timeline item (e.g. "Springs of Islam in Medina") bundles several
// dated sub-events under one id — arrival in Quba, mosque construction,
// the Ansar-Muhajireen brotherhood, Aisha's marriage, all concatenated.
// Scoring that whole bundle as one document caused two separate problems,
// both confirmed live:
//   1. A long bundle has far more raw text than a typical Shamail entry, so
//      it has more chances to contain any given word SOMEWHERE, purely by
//      length — "aaj weather kaisa hai" ended up citing a battle entry,
//      almost certainly because "weather" appeared once, incidentally, deep
//      in a long narrative about something else entirely. IDF weights how
//      RARE a word is corpus-wide, but never accounted for how much raw
//      text a single candidate document contains.
//   2. Even a CORRECT match (Hijrah) returned the entire multi-topic bundle
//      as the answer, when the actual question ("when did it happen") only
//      needed one specific sub-section.
// Splitting into one candidate per sub-section fixes both: each candidate
// is now roughly Shamail-length, and citing one sub-section instead of the
// whole bundle gives a properly-scoped answer instead of a multi-topic
// dump. All sub-entries from the same parent still share that parent's real
// id and title for citation purposes — the API's addressable unit is the
// parent, so that's what gets cited, even though scoring now happens at the
// finer-grained sub-section level.
function normalizeTimelineItem(item: any): NormalizedEntry[] {
  const primary = item.en ?? item.ur ?? {};
  const sections: any[] = Array.isArray(primary.content) ? primary.content : [];
  const parentId = String(item.id ?? item._id ?? '');
  const parentTitle = primary.title ?? 'Timeline entry';
  const hawala = primary.gregorianDate ? `${primary.gregorianDate} CE` : undefined;

  const slugWords = tokenize((item.slug?.en ?? '').replace(/-/g, ' '));
  const parentKeywords = [...slugWords, ...(primary.section ? [primary.section] : [])];

  if (sections.length === 0) {
    // No sub-sections at all (edge case) — fall back to a single entry so
    // the item isn't silently dropped, even though there's little text.
    return [
      {
        id: parentId,
        source: 'timeline',
        title: parentTitle,
        text: primary.description || '',
        hawala,
        points: [],
        keywords: parentKeywords,
        category: primary.section ?? undefined,
      },
    ];
  }

  return sections
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((section) => {
      const sectionTitle: string = section.title ?? '';
      const text = sectionTitle ? `${sectionTitle}\n${section.content_text ?? ''}` : (section.content_text ?? '');
      return {
        id: parentId,
        source: 'timeline' as const,
        title: parentTitle,
        text,
        hawala,
        points: [],
        // Parent-level context (slug/section words) PLUS this specific
        // sub-section's own title — not every sub-section's title, so a
        // "Passing of the father" sub-entry doesn't inherit keyword weight
        // from an unrelated sibling sub-section under the same parent.
        keywords: [...parentKeywords, ...tokenize(sectionTitle)],
        category: primary.section ?? undefined,
      };
    })
    .filter((entry) => entry.text.trim().length > 0);
}
