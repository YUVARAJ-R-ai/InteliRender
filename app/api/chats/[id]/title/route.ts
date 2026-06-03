import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getTitleModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getSiliconFlowKey } from '@/lib/user-settings';

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const chatId = parseInt(id);
    if (isNaN(chatId)) return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });

    const session = await auth();

    // Never overwrite a title the user set manually
    const [chat] = await db
      .select({ isManuallyTitled: chats.isManuallyTitled })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    if (chat?.isManuallyTitled) return NextResponse.json({ skipped: true });

    const { firstMessage } = await req.json();
    if (!firstMessage) return NextResponse.json({ error: 'firstMessage required' }, { status: 400 });

    const apiKey = session?.user?.id ? await getSiliconFlowKey(session.user.id) : undefined;

    let title = '';
    try {
      const { text } = await generateText({
        model: getTitleModel(apiKey || undefined),
        maxOutputTokens: 16,
        system: 'Return ONLY a 4-word-or-fewer title that summarises the message. No quotes, no punctuation, no explanation — just the title.',
        prompt: firstMessage.slice(0, 300),
      });
      title = text.replace(/["'`*]/g, '').replace(/\n.*/s, '').trim().slice(0, 60);
    } catch {
      // Fall through to fallback
    }

    // Fallback: first 40 chars of user message, title-cased
    if (!title) title = toTitleCase(firstMessage.trim().slice(0, 40));

    const whereClause = session?.user?.id
      ? and(eq(chats.id, chatId), eq(chats.userId, session.user.id))
      : eq(chats.id, chatId);

    await db.update(chats).set({ title }).where(whereClause);

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating chat title:', error);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
