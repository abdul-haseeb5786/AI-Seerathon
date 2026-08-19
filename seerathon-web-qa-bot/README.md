# Seerah Q&A — Web Chat

Built for the Seerathon **Developers / AI Engineers** role brief, `web` platform option.
A grounded Q&A bot: answers only from the approved corpus, cites its source, refuses
ruling/fatwa questions, and always shows the disclaimer.

## Brief → code map

| Brief requirement | Where |
|---|---|
| In-corpus answer + citation | `lib/answer.ts` (`getAnswer`) → citation chip in `ChatWidget.tsx` |
| Out-of-corpus → safe fallback | `lib/answer.ts` (no lexical overlap match) + `MESSAGES.outOfCorpus` |
| Ruling/fatwa → refuse, redirect to alim | `lib/guardrails.ts` (`isRulingQuestion`), checked **before** any corpus search |
| Persistent disclaimer | `app/api/meta/route.ts` + banner in `ChatWidget.tsx`, always rendered, never dismissible |
| Corpus APIs | `lib/corpus.ts` — exact base URL / paths / query params from the brief |
| No free-form rulings | Same ruling gate — it overrides even a strong corpus match |

## ⚠️ Status as of last test pass (verified live, 2026-08-14)

**Corpus scope** — resolved: **Shamail + Timeline answer questions, Courses
is reference-only.** Still worth a quick confirm with organizers since the
brief's other section phrases it more loosely.

**Shamail schema — CONFIRMED and working.** Real fields: `en.title`,
`en.hadeesTarjama` (entry text), `en.hadeesHawala` (hadith reference — falls
back to `ur` block when `en`'s is blank), `en.points`, top-level `keywords[]`.

**Timeline schema — CONFIRMED and working end-to-end**, as of the second live
test pass. Turned out to be a genuinely different shape from Shamail, not
just different field names:
- No `hadeesTarjama`, no `hadeesHawala`, no `keywords[]` at all.
- Real text lives in `en.content[]` — an array of dated sub-events (e.g. one
  "Blessed Birth" item bundles both the birth itself *and* the father's
  passing as separate `{title, sequence, content_text}` entries). Fixed by
  concatenating all sub-sections in sequence order.
- `en.description` exists but is an empty string on real data — the original
  code's fallback chain (`?? primary.description ?? ...`) stopped there,
  because `??` only skips `null`/`undefined`, not `""`. That silently
  produced empty text for **every single Timeline entry**, which is the
  actual reason Timeline-based questions (Hijrah, etc.) never answered even
  after the Shamail fix — they were being normalized away before scoring
  ever started, not failing to match.
- No `keywords[]`, so `normalizeTimelineItem()` derives equivalent signal
  from the slug (`blessed-birth` → `blessed`, `birth`) and each sub-section's
  title.
- No hadith reference to cite — uses `gregorianDate` as the hawala instead
  (e.g. "571 CE"), which is genuine citeable context for a timeline event.
- Verified live: "When was Prophet Muhammad born?" now correctly answers
  from the real Blessed Birth entry, formats both sub-events, cites "571 CE."

**Matching algorithm — 5 rounds of live-testing fixes, in order:**

1. *Flat scoring, threshold ≥1.* Original version. A single incidental shared
   word was enough to confidently cite the wrong hadith — e.g. a question
   about eating returned an entry about the Prophet's ﷺ names, because they
   coincidentally shared "Nabi."
2. *Domain stopwords + threshold raised to 3.* Filtered out address/honorific
   terms that appear in nearly every entry regardless of topic. Fixed the 3
   known wrong-citations, confirmed no regressions.
3. *Shared tokenizer (`lib/text.ts`).* A pronoun ("his") leaked through
   Timeline's keyword derivation as a false keyword hit because that
   derivation used a raw `.split()` instead of the same filter used for
   scoring. Fixed by sharing one tokenizer between both.
4. *TF-IDF weighting.* The threshold from step 2 that stopped false
   positives was also too strict for short real questions — "How did the
   Prophet treat animals?" only has 2 content words after stopword-filtering.
   Confirmed via `/shamail?limit=120` full-text search that "neighbors,"
   "animals," and "smile" entries genuinely exist — these were matching
   misses, not "not in corpus" cases. Replaced flat +1/+3 counting with IDF
   computed live from the fetched corpus, plus a title-match bonus, keeping
   domain stopwords on top (IDF alone wasn't enough — this corpus's titles
   are formulaic enough that common words still caused false ties).
5. *Sub-section splitting + a 2-token confidence gate.* Live retest surfaced
   a new, more serious false positive: "aaj weather kaisa hai" confidently
   cited a battle entry. Cause: Timeline entries bundle several sub-events
   into one long document, and a long document has far more raw text than a
   typical Shamail entry — more chances for any rare word to appear
   SOMEWHERE incidentally, which IDF can't discount (it weighs how rare a
   word is corpus-wide, not how much text one candidate contains). Two
   fixes together:
   - `normalizeTimelineItem()` now returns one candidate **per sub-section**
     instead of one per bundled item, so Timeline candidates are roughly
     Shamail-length again. Side effect: also fixed the earlier observation
     that Hijrah answers were unnecessarily long — the answer is now just
     the relevant sub-section, still correctly cited to the parent's id/title.
   - `pickBestMatch()` now rejects a top match resting on only ONE matching
     word unless that word is in the title — a single incidental body-text
     word (however rare) is no longer enough alone; either a second
     matching word or a real title hit is required.

Verified after step 5: the weather/battle false positive is gone, the
Hijrah answer is properly scoped to one sub-section, and every regression
from steps 1-4 still holds (neighbors, animals, smile, birth, Medina,
appearance, moral qualities, all 3 original wrong-citation fixes).

**One case still misfires, and it's a different kind of problem now — not
an unfixed bug, but a real ceiling of lexical matching:** "Is it sunnah to
eat with the right hand like the Prophet ﷺ did?" still cites a Battle of
Khaybar sub-section, about the Prophet ﷺ being offered poisoned meat — its
text genuinely contains both "hand" ("took a piece in his hand") and "eat,"
a real 2-word match, not an incidental fluke like the weather case. The
words line up; the meaning doesn't — a poisoning narrative has nothing to
do with a question about eating manners as a character trait. No amount of
stopword or threshold tuning fixes this, because the system matches word
overlap, not meaning. Closing this for real needs semantic matching —
embeddings or an LLM re-ranking step over the top few lexical candidates —
which is a bigger change than this pass. Worth doing if you want it
airtight; the current version is honest about not being semantic.

**Judgment call — still not decided:** "Is it sunnah to eat with the right
hand like the Prophet ﷺ did?" is currently **not** treated as a ruling
question — `isRulingQuestion()` only flags phrases like "is it allowed" /
"jaiz hai", not bare "sunnah", because that word is also normal Shamail
vocabulary and blocking it would misfire on legitimate questions constantly.
If the brief wants "sunnah"-framed questions refused too, that's an explicit
decision to make, not a bug to fix.

**Observation, not a bug:** the Hijrah answer is long — the real "Springs of
Islam in Medina" timeline item bundles several sub-events (arrival in Quba,
mosque construction, Ansar-Muhajireen brotherhood, Aisha's marriage) under
one entry, and the current code returns the whole bundle whenever any part
of it matches. The citation is correct and the content is genuinely part of
that entry, so this isn't wrong — but a shorter answer pulled from just the
most relevant sub-section would read better for a narrow question. Happy to
add sub-section-level matching if you want tighter answers.


## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Testing the 4 demo scenarios

- **In-corpus** — ask about a Shamail trait (e.g. the Prophet's ﷺ appearance or manner)
- **Out-of-corpus** — ask something with no relation to Seerah at all
- **Ruling/fatwa** — ask "is X halal" / "iska hukum kya hai" → should refuse and
  point to an alim, even if a related Shamail entry exists
- **Disclaimer** — confirm the banner is visible on load and stays visible the
  whole conversation

## Design notes

Palette and type are a deliberate choice, not Tailwind defaults — see the
comment at the top of `tailwind.config.ts`. Loosely echoes the brief document's
own ink-navy / green / gold language rather than a generic chat-app look, per
the designer notes ("trust-first messaging over 'cool AI' hype," "soft AI glow
without sci-fi excess"). The citation chip is the one deliberately bold
element; everything else stays quiet on purpose.

## Honest limitations / next steps

- **Answer generation** currently returns the matched entry's own title + text
  verbatim — the safest, zero-hallucination reading of "grounded ONLY." If you
  want more natural phrasing, add an LLM rewrite step in `lib/answer.ts`, but
  keep the system prompt scoped to "use only this entry's text, nothing else."
- **Ruling detection** (`lib/guardrails.ts`) is a keyword list and deliberately
  over-triggers. Swap in a small LLM classifier later if false positives
  become annoying — same function signature, drop-in replacement.
- **Matching** is IDF-weighted lexical overlap (see algorithm history above),
  not embeddings. Fine for ~154 total entries; revisit if recall still feels
  weak after retesting against the real corpus.
- Not yet wired: pagination beyond the first page of results, and the
  `/courses` endpoint isn't called anywhere (by design — see scope note above).
- **Spelling/hyphenation variants aren't normalized** — e.g. "Ashab al-Feel"
  vs the corpus's "As-hab-al-Feel" share no tokens after tokenizing, so that
  specific phrasing won't match even though the event is in the corpus.
  Would need stemming/fuzzy matching to fix; bigger change than this pass.
