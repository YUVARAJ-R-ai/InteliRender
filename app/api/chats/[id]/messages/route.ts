import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const chatId = parseInt(id);
    if (isNaN(chatId)) return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });

    const chatMessages = await db.select().from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.id));
      
    return NextResponse.json(chatMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
