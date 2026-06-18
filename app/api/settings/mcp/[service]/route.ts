import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mcpConnections } from '@/lib/db/schema';
import { encrypt } from '@/lib/encryption';

const SUPPORTED_SERVICES = ['github', 'linear', 'notion', 'google_drive', 'gmail', 'google_calendar', 'stripe', 'postgres', 'slack'];

/**
 * POST /api/settings/mcp/[service] — connect a service with a token/PAT.
 * Body: { token: string, metadata?: object }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { service } = await params;
  if (!SUPPORTED_SERVICES.includes(service)) {
    return NextResponse.json({ error: 'Unsupported service' }, { status: 400 });
  }

  const { token, metadata } = await req.json();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  await db
    .insert(mcpConnections)
    .values({
      userId: session.user.id,
      service,
      accessToken: encrypt(token.trim()),
      status: 'connected',
      metadata: metadata ?? null,
      lastSynced: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mcpConnections.userId, mcpConnections.service],
      set: {
        accessToken: encrypt(token.trim()),
        status: 'connected',
        metadata: metadata ?? null,
        lastSynced: new Date(),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}

/** DELETE /api/settings/mcp/[service] — disconnect a service */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ service: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { service } = await params;
  await db
    .delete(mcpConnections)
    .where(and(eq(mcpConnections.userId, session.user.id), eq(mcpConnections.service, service)));

  return NextResponse.json({ success: true });
}
