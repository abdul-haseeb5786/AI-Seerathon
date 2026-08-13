'use client';

import { useEffect, useRef, useState } from 'react';
import { MESSAGES } from '@/lib/messages';
import ChatHeader from './ChatHeader';
import DisclaimerBanner from './DisclaimerBanner';
import MessageBubble, { type ChatMessage } from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import SuggestedQuestions from './SuggestedQuestions';
import { SendIcon } from './icons';

export default function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'bot', text: MESSAGES.greeting }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [disclaimer, setDisclaimer] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then((d) => setDisclaimer(d.disclaimer || MESSAGES.fallbackDisclaimer))
      .catch(() => setDisclaimer(MESSAGES.fallbackDisclaimer));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function send(overrideText?: string) {
    const question = (overrideText ?? input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'bot', text: data.text, kind: data.kind, citations: data.citations }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: MESSAGES.connectionError, kind: 'fallback' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const showStarters = messages.length === 1 && !loading;

  return (
    <div className="flex h-full max-h-[720px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-brand-ink/10 bg-white shadow-xl shadow-brand-ink/10">
      <ChatHeader />
      <DisclaimerBanner disclaimer={disclaimer} />

      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((message, i) => (
          <MessageBubble key={i} message={message} />
        ))}
        {showStarters && <SuggestedQuestions onPick={(q) => send(q)} />}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-brand-ink/10 px-3 py-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about the Seerah…"
          aria-label="Ask about the Seerah"
          className="flex-1 rounded-full border border-brand-ink/15 bg-white px-4 py-2 font-body text-sm text-brand-ink outline-none placeholder:text-brand-ink/40 focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/30"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-emerald text-white transition-colors hover:bg-brand-emerald-dark focus:outline-none focus:ring-2 focus:ring-brand-emerald/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
