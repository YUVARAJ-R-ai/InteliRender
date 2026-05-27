import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const messageId = parseInt(id);
    if (isNaN(messageId)) return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });

    // Find the message
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    // If it's a user message, we might want to delete it and all subsequent messages in this chat
    // For simplicity, let's just delete the specific message and the one immediately following it if it's an assistant message
    
    // Better yet, just delete all messages from this one onwards in the same chat to "rewind" the conversation
    await db.delete(messages)
      .where(and(
        eq(messages.chatId, msg.chatId),
        gte(messages.id, messageId)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
