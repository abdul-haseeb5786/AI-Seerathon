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

**Matching algorithm — tightened after live testing surfaced 3 wrong
citations** (not just "no answer" — a *confident, wrong* answer, e.g. a
question about eating returned an entry about the Prophet's ﷺ names, because
they coincidentally shared the word "Nabi"). Two changes:
- Domain stopwords added for pure address/honorific terms that appear in
  nearly every entry regardless of topic (prophet, nabi, sayyiduna, beloved,
  holy, blessed, hazrat, sallallahu, alayhi, wasallam, ...) — these were
  contributing false signal on their own. Deliberately does **not** include
  proper names (Muhammad, Ahmad, Aisha, Abdullah, ...) — which person an
  entry is about is real topical signal, not filler.
- Confidence threshold raised from "any single overlapping word" to
  `MIN_CONFIDENT_SCORE = 3` (one real keyword hit, or several word overlaps).
  Trade-off, stated plainly: this makes the bot say "not in corpus" more
  often on weakly-matching questions — which is the correct trade-off for
  "grounded ONLY," since a wrong citation is worse than an honest fallback.

**Judgment call — still not decided:** "Is it sunnah to eat with the right
hand like the Prophet ﷺ did?" is currently **not** treated as a ruling
question — `isRulingQuestion()` only flags phrases like "is it allowed" /
"jaiz hai", not bare "sunnah", because that word is also normal Shamail
vocabulary and blocking it would misfire on legitimate questions constantly.
If the brief wants "sunnah"-framed questions refused too, that's an explicit
decision to make, not a bug to fix.

**Known lexical-matching limitation:** spelling/hyphenation variants aren't
normalized (e.g. "Ashab al-Feel" vs the corpus's "As-hab-al-Feel" share no
tokens after tokenizing, so that specific phrasing won't match even though
the event is in the corpus). Not fixed — would need stemming/fuzzy matching,
a bigger change than the scope of this pass.

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
- **Matching** is plain lexical overlap over the API's own `q` search, not
  embeddings. Fine for ~120 Shamail entries; revisit if recall feels weak
  once you're testing against real data.
- Not yet wired: pagination beyond the first page of results, and the
  `/courses` endpoint isn't called anywhere (by design — see scope note above).
