// All bot-facing copy lives here on purpose — the brief treats wording as
// part of the guardrail (safe fallback / refusal / disclaimer are graded
// behaviors), so keeping it in one place makes it easy to review, translate,
// or tighten without hunting through components.

export const MESSAGES = {
  greeting:
    "Ask about the Prophet's \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 character (Shamail) or a moment from the Seerah timeline. Every answer cites its source.",

  rulingRefusal:
    "This needs a religious ruling, which is outside what this bot covers. It only answers from the approved Shamail and Timeline corpus. Ask a qualified alim for guidance on this.",

  outOfCorpus:
    "Nothing in the approved corpus matches this. Try asking about a specific Shamail trait or a Seerah timeline event instead.",

  connectionError:
    "Couldn't reach the corpus just now. Try again in a moment.",

  fallbackDisclaimer:
    "Answers come only from the approved Shamail and Timeline corpus and may be incomplete. This isn't a source for religious rulings \u2014 ask a qualified alim for those.",
} as const;
