import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { customMcpServers } from '@/lib/db/schema';

/**
 * PATCH /api/admin/mcp-servers/[id] — toggle enabled / update fields (admin only).
 * Body: { isEnabled?: boolean, name?: string, command?: string, args?: string[] }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const serverId = Number(id);
  if (Number.isNaN(serverId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const set: Record<string, unknown> = {};
  if (typeof body.isEnabled === 'boolean') set.isEnabled = body.isEnabled;
  if (typeof body.name === 'string' && body.name.trim()) set.name = body.name.trim();
  if (typeof body.command === 'string' && body.command.trim()) set.command = body.command.trim();
  if (Array.isArray(body.args)) set.args = body.args.map((a: string) => String(a)).filter(Boolean);

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(customMcpServers)
    .set(set)
    .where(eq(customMcpServers.id, serverId))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

/** DELETE /api/admin/mcp-servers/[id] — remove a custom MCP server (admin only) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const serverId = Number(id);
  if (Number.isNaN(serverId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await db.delete(customMcpServers).where(eq(customMcpServers.id, serverId));
  return NextResponse.json({ success: true });
}
