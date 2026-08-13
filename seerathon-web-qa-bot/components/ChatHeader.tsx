import { RosetteMark } from './icons';

export default function ChatHeader() {
  return (
    <div className="flex items-center justify-between bg-brand-ink px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="text-brand-brass" aria-hidden>
          <RosetteMark />
        </span>
        <div>
          <p className="font-display text-[17px] font-semibold leading-tight text-white">Seerah Q&amp;A</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-brand-brass/90">
            Shamail + Timeline corpus
          </p>
        </div>
      </div>
      <span className="rounded-full border border-brand-brass/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-brass">
        Web
      </span>
    </div>
  );
}
