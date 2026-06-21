import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { customMcpServers } from '@/lib/db/schema';

/** GET /api/admin/mcp-servers — list all custom MCP servers (admin only) */
export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const servers = await db
    .select()
    .from(customMcpServers)
    .orderBy(desc(customMcpServers.createdAt));

  return NextResponse.json(servers);
}

/**
 * POST /api/admin/mcp-servers — add a custom MCP server.
 * Body: { name: string, command: string, args?: string[] | string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, command, args } = await req.json();
  if (!name?.trim() || !command?.trim()) {
    return NextResponse.json({ error: 'name and command are required' }, { status: 400 });
  }

  // Accept args as an array or a space-separated string.
  const argsArray = Array.isArray(args)
    ? args.map((a: string) => String(a)).filter(Boolean)
    : typeof args === 'string'
      ? args.trim().split(/\s+/).filter(Boolean)
      : [];

  const [created] = await db
    .insert(customMcpServers)
    .values({
      userId: session!.user!.id ?? null,
      name: name.trim(),
      command: command.trim(),
      args: argsArray,
      isEnabled: true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
