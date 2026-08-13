// Picked from entries confirmed present in the live corpus during testing,
// so a reviewer's first tap reliably produces a good, correctly-cited
// answer instead of a coin flip. Update this list as more of the real
// corpus gets explored.
const STARTERS = [
  "What was the Prophet's \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 blessed complexion like?",
  "What are some of the Prophet's \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 names and titles?",
  'How did the Prophet \u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645 treat children?',
];

export default function SuggestedQuestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="motion-safe:animate-message-in flex flex-wrap gap-1.5 px-0.5 pt-1">
      {STARTERS.map((q) => (
        <button
          key={q}
          onClick={() => onPick(q)}
          className="rounded-full border border-brand-ink/12 bg-white px-3 py-1.5 text-left font-body text-[12px] text-brand-ink/75 transition-colors hover:border-brand-emerald/40 hover:bg-brand-emerald/5 hover:text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-emerald/30"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
