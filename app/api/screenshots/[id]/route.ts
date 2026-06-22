import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

/**
 * GET /api/screenshots/[id] — stream a browser_task screenshot PNG from redis.
 * The PNG is stored base64-encoded under `screenshot:<id>` by the Python MCP
 * server (services/mcp-server/tools/browser.py).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Ids are uuid4 hex (32 hex chars) — reject anything else.
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const redis = await getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Screenshot storage unavailable' }, { status: 503 });
  }

  const encoded = await redis.get(`screenshot:${id}`);
  if (!encoded) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const png = Buffer.from(encoded, 'base64');
  return new NextResponse(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
