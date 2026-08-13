import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seerah Q&A — Seerathon',
  description: 'Seerah Q&A bot grounded in the approved Shamail + Timeline corpus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&family=Noto+Naskh+Arabic:wght@500;600&display=swap"
        />
      </head>
      <body className="bg-brand-parchment font-body text-brand-ink">{children}</body>
    </html>
  );
}
