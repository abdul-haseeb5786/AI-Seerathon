import { NextRequest, NextResponse } from 'next/server';
import { getAnswer } from '@/lib/answer';
import { MESSAGES } from '@/lib/messages';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!question) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  try {
    const answer = await getAnswer(question);
    return NextResponse.json(answer);
  } catch (err) {
    console.error('POST /api/chat failed:', err);
    // Corpus unreachable — this is a connection problem, not "out of corpus",
    // so it gets its own message rather than quietly reusing the fallback copy.
    return NextResponse.json(
      { kind: 'fallback', text: MESSAGES.connectionError, citations: [] },
      { status: 200 },
    );
  }
}
