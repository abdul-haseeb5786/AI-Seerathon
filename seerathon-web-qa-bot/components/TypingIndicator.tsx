export default function TypingIndicator() {
  return (
    <div className="flex justify-start motion-safe:animate-message-in" aria-live="off">
      <div className="flex items-center gap-1 rounded-2xl border border-brand-ink/10 bg-white px-3.5 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-brass/70 motion-safe:animate-bounce" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-brass/70 motion-safe:animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-brass/70 motion-safe:animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
