import { InfoIcon } from './icons';
import { MESSAGES } from '@/lib/messages';

export default function DisclaimerBanner({ disclaimer }: { disclaimer: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-brand-brass/30 bg-brand-brass-tint px-4 py-2.5">
      <span aria-hidden className="mt-0.5 shrink-0 text-brand-brass">
        <InfoIcon />
      </span>
      <p className="text-[11.5px] leading-snug text-brand-ink/80">{disclaimer || MESSAGES.fallbackDisclaimer}</p>
    </div>
  );
}
