import type { Config } from 'tailwindcss';

// Palette is deliberately not stock Tailwind swatches (indigo/blue defaults).
// It's pulled from the Seerathon brief's own document language: ink-navy
// header, warm parchment body, deep masjid-green accent, manuscript-gold for
// citations, muted oxblood reserved only for the "referred to an alim" state.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#10233A',
          parchment: '#FAF6EC',
          emerald: '#0E6B4F',
          'emerald-dark': '#0B5540',
          brass: '#AD8A52',
          'brass-tint': '#F3E9D6',
          oxblood: '#7A3030',
          'oxblood-tint': '#F5E8E8',
          stone: '#7C7565',
          'stone-tint': '#F1EFE9',
        },
      },
      fontFamily: {
        // Noto Naskh Arabic appended to every stack, not just its own —
        // ﷺ and hawala references (Arabic/Urdu hadith citations) can show
        // up inside display, body, or mono text, and without this the
        // browser has no glyph coverage for them and renders a broken box.
        display: ['Fraunces', 'ui-serif', 'serif', '"Noto Naskh Arabic"'],
        body: ['Inter', 'ui-sans-serif', 'sans-serif', '"Noto Naskh Arabic"'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace', '"Noto Naskh Arabic"'],
      },
      keyframes: {
        'message-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'message-in': 'message-in 0.28s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
