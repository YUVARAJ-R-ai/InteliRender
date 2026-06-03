import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mcpConnections } from '@/lib/db/schema';

/** GET /api/settings/mcp — list all MCP connection statuses for the user */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connections = await db
    .select({
      service: mcpConnections.service,
      status: mcpConnections.status,
      metadata: mcpConnections.metadata,
      lastSynced: mcpConnections.lastSynced,
      tokenExpiry: mcpConnections.tokenExpiry,
    })
    .from(mcpConnections)
    .where(eq(mcpConnections.userId, session.user.id));

  // Never return tokens — only status metadata
  return NextResponse.json(connections);
}
