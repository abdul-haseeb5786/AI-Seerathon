// Single shared definition of "what counts as a meaningful content word."
// Used by lib/corpus.ts (deriving pseudo-keywords for Timeline entries,
// which ship no keywords[] of their own) AND lib/answer.ts (scoring
// questions against entries). Keeping this in one place is deliberate: a
// second, slightly-different filter is exactly how "his" leaked through as
// a false +3 keyword signal in normalizeTimelineItem() while the same word
// was already excluded from plain word-overlap scoring — same class of bug
// as the original "Nabi"/"Madinah"/"hand" false-citation issue, just via a
// pronoun instead of an honorific, and only possible because the two
// filters weren't the same function.

export const STOPWORDS = new Set([
  // Generic English function words / pronouns
  'the', 'and', 'was', 'with', 'for', 'that', 'this', 'from', 'have', 'what',
  'does', 'did', 'about', 'tell', 'me', 'you', 'your', 'please', 'when', 'how',
  'his', 'her', 'their', 'they', 'them', 'who', 'which', 'were', 'are', 'not',
  'into', 'out', 'now', 'then', 'there', 'here', 'also',

  // Roman Urdu / Hindi function words
  'ka', 'ki', 'ke', 'hai', 'mein', 'main', 'kya', 'kis', 'kaisa', 'kaisi',
  'bare', 'bataye', 'bataen', 'kar',

  // Religious address/honorific terms — appear in nearly every entry
  // regardless of topic, so they're pure filler, not signal. Deliberately
  // does NOT include proper names (Muhammad, Ahmad, Aisha, Abdullah, ...) —
  // which specific person an entry is about IS real topical signal.
  'prophet', 'nabi', 'beloved', 'holy', 'blessed', 'sallallahu',
  'alayhi', 'wasallam', 'sayyiduna', 'sayyidatuna', 'narrated', 'kareem',
  'hazrat', 'huzoor', 'allah', 'said', 'says', 'like', 'once',
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}
