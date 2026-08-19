import { getAllShamail, getAllTimeline, type NormalizedEntry } from './corpus';
import { isRulingQuestion } from './guardrails';
import { MESSAGES } from './messages';
import { tokenize } from './text';

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

// Scoring uses TF-IDF-style weighting computed live from whatever the
// corpus actually contains, rather than a flat +1/+3 count. This replaced a
// simpler flat-count version after three rounds of live testing kept
// surfacing the same underlying problem from different angles:
//   - flat scoring let ONE incidental shared word (a plants entry mentioning
//     "hand" once) outscore everything else just as easily as a genuinely
//     specific match — fixed with domain stopwords + a threshold, but then:
//   - the same threshold that stopped false positives was too strict for
//     short real questions ("How did the Prophet treat animals?" has only
//     2 real content words after stopword-filtering, and lost to entries
//     that happened to share ONE of them).
// IDF fixes both at once: a word that appears in just 1-2 of ~154 entries
// (like "neighbors" or "animals") scores far higher than a word that
// appears in dozens (even domain words that slip past the stopword list).
// Domain stopwords are still kept on top of this — testing showed IDF alone
// wasn't enough, because this corpus's own titles are formulaic ("The
// Beloved Prophet's compassion towards X"), so words like "beloved" recur
// often enough within the corpus's own phrasing to still cause false ties
// without an explicit filter.
function computeIdf(entries: NormalizedEntry[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  for (const entry of entries) {
    const tokensInEntry = new Set([
      ...tokenize(entry.title),
      ...tokenize(entry.text),
      ...tokenize(entry.category ?? ''),
      ...entry.keywords.map((k) => k.toLowerCase()),
    ]);
    for (const token of tokensInEntry) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const totalDocs = entries.length;
  const idf = new Map<string, number>();
  for (const [token, count] of documentFrequency) {
    // Smoothed IDF, always positive: log((N+1)/(df+1)) + 1
    idf.set(token, Math.log((totalDocs + 1) / (count + 1)) + 1);
  }
  return idf;
}

function scoreEntry(entry: NormalizedEntry, questionTokens: Set<string>, idf: Map<string, number>): number {
  const titleTokens = tokenize(entry.title);
  const bodyTokens = tokenize(`${entry.text} ${entry.category ?? ''}`);
  const keywordTokens = new Set(entry.keywords.map((k) => k.toLowerCase()));

  let score = 0;
  for (const token of questionTokens) {
    const weight = idf.get(token);
    if (!weight) continue; // word doesn't appear anywhere in the corpus at all

    // A title mention is a stronger signal than an incidental body mention
    // — "Compassion ... Towards Animals" matching "animals" in the title is
    // more reliable than a word buried once in a long hadith translation.
    if (titleTokens.has(token)) score += weight * 1.5;
    else if (bodyTokens.has(token)) score += weight;

    // Curated keyword hits count as an independent extra signal on top —
    // deliberate corpus tagging is worth more than incidental phrasing.
    if (keywordTokens.has(token)) score += weight;
  }
  return score;
}

// Confidence floor, in IDF-weighted points rather than a flat word count.
// Chosen from live-testing patterns (correct matches scored roughly 3-7,
// unrelated entries scored 0) with margin to spare, but the exact value is
// a reasoned starting point, not something verified against the full
// 154-entry corpus — the sample used to tune it was necessarily smaller.
// Retest live and adjust if it's rejecting real matches or accepting weak
// ones.
const MIN_CONFIDENT_SCORE = 2;

function pickBestMatch(candidates: NormalizedEntry[], question: string): NormalizedEntry | null {
  const questionTokens = tokenize(question);
  const validCandidates = candidates.filter((c) => c.text && c.text.trim().length >= 3);
  const idf = computeIdf(validCandidates);

  let best: NormalizedEntry | null = null;
  let bestScore = 0;

  for (const candidate of validCandidates) {
    const score = scoreEntry(candidate, questionTokens, idf);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  // No overlap with anything in the corpus at all = no grounding = honest
  // fallback, never a guess.
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
