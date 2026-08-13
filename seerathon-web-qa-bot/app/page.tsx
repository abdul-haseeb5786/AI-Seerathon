import ChatWidget from '@/components/ChatWidget';

export default function Home() {
  return (
    <main className="bg-geo-pattern flex h-dvh items-center justify-center overflow-hidden bg-brand-parchment p-3 sm:p-6">
      <ChatWidget />
    </main>
  );
}
