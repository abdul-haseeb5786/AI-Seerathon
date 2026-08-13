import { getAllShamail, getAllTimeline, type NormalizedEntry } from './corpus';
import { isRulingQuestion } from './guardrails';
import { MESSAGES } from './messages';

export type AnswerKind = 'answer' | 'fallback' | 'refusal';

export type Citation = {
  source: 'shamail' | 'timeline';
  id: string;
  title: string;
  hawala?: string;
};

export type BotAnswer = {
  kind: AnswerKind;
  text: string;
  citations: Citation[];
};

const STOPWORDS = new Set([
  'the', 'and', 'was', 'with', 'for', 'that', 'this', 'from', 'have', 'what',
  'does', 'did', 'about', 'tell', 'me', 'you', 'your', 'please', 'when', 'how',
  'ka', 'ki', 'ke', 'hai', 'mein', 'main', 'kya', 'kis', 'kaisa', 'kaisi',
  'bare', 'bataye', 'bataen', 'kar',
  // Domain stopwords: these appear in nearly EVERY entry regardless of
  // topic (every Shamail/Timeline item is about the Prophet ﷺ, narrated by
  // a companion, etc.), so they contribute zero discriminating signal and
  // were the direct cause of wrong citations during testing — e.g. "Nabi"
  // alone was enough to match an unrelated entry about his names/titles.
  'prophet', 'nabi', 'muhammad', 'beloved', 'holy', 'blessed', 'sallallahu',
  'alayhi', 'wasallam', 'sayyiduna', 'sayyidatuna', 'narrated', 'kareem',
  'hazrat', 'huzoor', 'allah', 'said', 'says', 'like', 'once',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

// Scoring combines two signals:
//  - `keywords`: curated tags the corpus itself ships on every entry, so a
//    hit here is a strong, intentional signal — weighted higher.
//  - plain lexical overlap between the question and the entry's title/text/
//    category, as a fallback for questions that don't happen to use the
//    exact keyword vocabulary.
// This replaced trusting the API's own `?q=` search, which is undocumented
// and unverified — a rule you can point to and explain beats a black box
// when someone asks "why did it cite this entry?" during a demo.
function scoreEntry(entry: NormalizedEntry, questionTokens: Set<string>): number {
  let score = 0;

  for (const keyword of entry.keywords) {
    if (questionTokens.has(keyword.toLowerCase())) score += 3;
  }

  const entryTokens = tokenize(`${entry.title} ${entry.text} ${entry.category ?? ''}`);
  for (const token of entryTokens) {
    if (questionTokens.has(token)) score += 1;
  }

  return score;
}

// Confidence floor. Testing surfaced real wrong citations at threshold >=1
// — a single incidental shared word (one entry happened to mention
// "Madinah" in passing; another happened to say "...placed his hand...")
// was enough to confidently cite the wrong hadith. Requiring >=3 means
// either one real keyword hit, or at least three separate overlapping
// content words — a much harder bar for coincidence to clear. This will
// mean more questions fall to the out-of-corpus fallback than before; that
// trade is correct here — an honest "not found" is safer than a wrong
// citation for a "grounded ONLY" bot.
const MIN_CONFIDENT_SCORE = 3;

function pickBestMatch(candidates: NormalizedEntry[], question: string): NormalizedEntry | null {
  const questionTokens = tokenize(question);
  let best: NormalizedEntry | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate.text || candidate.text.trim().length < 3) continue;
    const score = scoreEntry(candidate, questionTokens);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore >= MIN_CONFIDENT_SCORE ? best : null;
}

function formatAnswer(entry: NormalizedEntry): string {
  const parts = [entry.title, '', entry.text];
  if (entry.points.length > 0) {
    parts.push('', 'Key points:', ...entry.points.map((p) => `\u2022 ${p}`));
  }
  return parts.join('\n');
}

export async function getAnswer(question: string): Promise<BotAnswer> {
  const trimmed = question.trim();

  // Guardrail 1 — ruling/fatwa questions are refused before the corpus is
  // even searched, regardless of what might match in it.
  if (isRulingQuestion(trimmed)) {
    return { kind: 'refusal', text: MESSAGES.rulingRefusal, citations: [] };
  }

  // Guardrail 2 — only the approved answer corpus (Shamail + Timeline).
  // Courses is intentionally excluded: the brief's API note says it's
  // index/reference only, and /courses only returns titles anyway, so
  // there's no full text to ground an answer in even if we wanted to.
  const [shamailResult, timelineResult] = await Promise.allSettled([
    getAllShamail(),
    getAllTimeline(),
  ]);

  const shamailMatches = shamailResult.status === 'fulfilled' ? shamailResult.value : [];
  const timelineMatches = timelineResult.status === 'fulfilled' ? timelineResult.value : [];

  // Both endpoints failed outright (corpus API down/unreachable) — that's a
  // connection problem, not "we searched and found nothing." Let it
  // propagate so the route handler shows MESSAGES.connectionError instead
  // of silently relabeling an outage as out-of-corpus. If only one endpoint
  // failed, carry on with whatever the other returned.
  if (shamailResult.status === 'rejected' && timelineResult.status === 'rejected') {
    throw new Error('Corpus API unreachable: both /shamail and /timeline failed');
  }

  const best = pickBestMatch([...shamailMatches, ...timelineMatches], trimmed);

  if (!best) {
    return { kind: 'fallback', text: MESSAGES.outOfCorpus, citations: [] };
  }

  return {
    kind: 'answer',
    text: formatAnswer(best),
    citations: [{ source: best.source, id: best.id, title: best.title, hawala: best.hawala }],
  };
}
