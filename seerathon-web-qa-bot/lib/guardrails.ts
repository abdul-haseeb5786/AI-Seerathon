// Heuristic detector for fatwa / religious-ruling style questions.
//
// The brief is explicit: these get refused and redirected to an alim EVEN IF
// the corpus has related content. So this check has to run before corpus
// search, not after, and it deliberately errs toward over-triggering — a
// false refusal on a borderline question is cheap; the bot improvising a
// ruling is not acceptable at all.
//
// This is a keyword heuristic, not a robust classifier. It will miss
// paraphrased ruling questions and occasionally flag something benign. If
// that turns out to be a problem, replace `isRulingQuestion` with a small
// LLM call ("does this ask for a religious ruling/fatwa? yes/no") — same
// call site, same return type, drop-in swap.

const RULING_KEYWORDS = [
  // English
  'halal',
  'haram',
  'permissible',
  'impermissible',
  'forbidden',
  'is it allowed',
  'is it a sin',
  'sinful',
  'ruling on',
  'fatwa',
  'fiqh',
  'obligatory',
  'mandatory',
  'is it haraam',
  'is it halaal',

  // Roman Urdu / Hindi
  'jaiz hai',
  'jaiz h',
  'najaiz',
  'na jaiz',
  'hukum',
  'hukm',
  'gunah hai',
  'sawab hai',
  'farz hai',
  'fard hai',
  'wajib hai',
  'sunnat hai ya',
  'makruh',
  'haram hai',
  'halal hai',
  'kar sakte hain',
  'karna chahiye',
  'sahi hai ya',
  'durust hai',
  'shariat mein',
  'shariat ka hukum',
];

export function isRulingQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return RULING_KEYWORDS.some((keyword) => q.includes(keyword));
}
