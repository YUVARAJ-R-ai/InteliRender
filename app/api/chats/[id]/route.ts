import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';

/** PATCH /api/chats/[id] — rename a chat (marks it as manually titled) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const chatId = parseInt(id);
    if (isNaN(chatId)) return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });

    const { title } = await req.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const cleanTitle = title.trim().slice(0, 60);
    if (!cleanTitle) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });

    await db
      .update(chats)
      .set({ title: cleanTitle, isManuallyTitled: true })
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)));

    return NextResponse.json({ title: cleanTitle });
  } catch (error) {
    console.error('Error renaming chat:', error);
    return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 });
  }
}

/** DELETE /api/chats/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const chatId = parseInt(id);
    if (isNaN(chatId)) return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });

    await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
