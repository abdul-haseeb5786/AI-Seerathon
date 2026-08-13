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

## ⚠️ Status as of last test pass

**Corpus scope** — resolved, following the API note: **Shamail + Timeline
answer questions, Courses is reference-only.** Still worth a quick confirm
with organizers since the brief's other section phrases it more loosely.

**Shamail schema — CONFIRMED** against a real `/meta` and `/shamail?limit=1`
response. Fixed in `lib/corpus.ts`:
- The envelope is `{ data: { items: [...] } }`, not `{ data: [...] }` — the
  original code missed this nesting and silently treated every response as
  empty, which is why nothing matched during the first test pass.
- Real fields: `en.title`, `en.hadeesTarjama` (the entry text), `en.hadeesHawala`
  (hadith reference — falls back to the `ur` block when `en`'s is blank),
  `en.points` (bullet takeaways), and a top-level `keywords[]` array now used
  to weight the local matcher.
- Matching fetches the full corpus (only ~120 + ~34 entries, cached 5 min) and
  scores locally with `keywords` weighted highest, instead of trusting the
  API's undocumented `?q=` ranking. This also protects against `/meta`'s
  documented 60 req/min/IP rate limit — uncached, every chat message would
  burn 2 of those on corpus fetches alone.
- Citation chips now show the hawala when present, per `usage_rules` in
  `/meta` ("cite... source id and title, and hawala when available").

**Timeline schema — still UNCONFIRMED.** No real `/timeline?limit=1` response
seen yet, so `normalizeList()` assumes it mirrors the Shamail shape. Reasonable
bet (same API, same team), but grab a real sample before trusting
Timeline-based answers (e.g. "when was the Hijrah").

**Judgment call surfaced during testing — not yet decided:** "Is it sunnah to
eat with the right hand like the Prophet ﷺ did?" is currently **not** treated
as a ruling question — `isRulingQuestion()` only flags phrases like "is it
allowed" / "jaiz hai", not bare "sunnah", because that word is also normal
Shamail vocabulary and blocking it would misfire on legitimate questions
constantly. So right now this gets answered from the corpus like any other
Shamail topic. If the brief wants "sunnah" phrased as a ruling-style question
refused too, that needs an explicit decision — it's a real trade-off, not a bug.

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
