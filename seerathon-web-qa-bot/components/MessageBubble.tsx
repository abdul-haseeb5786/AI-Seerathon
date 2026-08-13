import type { AnswerKind, Citation } from '@/lib/answer';
import { BookmarkIcon } from './icons';

export type ChatMessage = {
  role: 'user' | 'bot';
  text: string;
  kind?: AnswerKind;
  citations?: Citation[];
};

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isRefusal = message.kind === 'refusal';
  const isFallback = message.kind === 'fallback';

  return (
    <div className={`flex motion-safe:animate-message-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 font-body text-[13.5px] leading-relaxed',
          isUser && 'bg-brand-emerald text-white',
          !isUser && isRefusal && 'border border-brand-oxblood/25 bg-brand-oxblood-tint text-brand-oxblood',
          !isUser && isFallback && 'border border-brand-stone/25 bg-brand-stone-tint text-brand-stone',
          !isUser && !isRefusal && !isFallback && 'border border-brand-ink/10 bg-white text-brand-ink',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isRefusal && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-brand-oxblood/70">
            Referred to an alim
          </p>
        )}
        {isFallback && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-brand-stone/70">Not in corpus</p>
        )}

        <p>{message.text}</p>

        {message.citations && message.citations.length > 0 && (
          <CitationList citations={message.citations} />
        )}
      </div>
    </div>
  );
}

function CitationList({ citations }: { citations: Citation[] }) {
  return (
    <div className="mt-2 space-y-1">
      {citations.map((c, i) => (
        <div key={i}>
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-brass bg-brand-brass-tint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-ink/80">
            <BookmarkIcon />
            {c.source === 'shamail' ? 'Shamail' : 'Timeline'} · {c.title}
          </span>
          {c.hawala && (
            <p dir="auto" className="mt-0.5 pl-1 font-mono text-[10px] text-brand-brass">
              {c.hawala}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
