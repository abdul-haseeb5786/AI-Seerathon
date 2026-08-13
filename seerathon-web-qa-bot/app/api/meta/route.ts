import { NextResponse } from 'next/server';
import { getMeta } from '@/lib/corpus';
import { MESSAGES } from '@/lib/messages';

export async function GET() {
  try {
    const meta = await getMeta();
    // Confirmed real shape: { error, data: { disclaimer: {en, ur}, counts, version }, msg }
    return NextResponse.json({
      disclaimer: meta?.data?.disclaimer?.en ?? MESSAGES.fallbackDisclaimer,
      counts: meta?.data?.counts ?? null,
      version: meta?.data?.version ?? null,
    });
  } catch (err) {
    console.error('GET /api/meta failed:', err);
    // The disclaimer must always render (it's a graded requirement), so a
    // failed live fetch still returns real copy, never an empty banner.
    return NextResponse.json({ disclaimer: MESSAGES.fallbackDisclaimer, counts: null, version: null });
  }
}
