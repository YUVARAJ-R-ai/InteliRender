import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAppConfig, setAppConfig, hasAppConfig } from '@/lib/app-config';

/** GET /api/settings/google-oauth — returns whether credentials are configured */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [hasClientId, hasClientSecret] = await Promise.all([
    hasAppConfig('google_client_id'),
    hasAppConfig('google_client_secret'),
  ]);

  return NextResponse.json({ configured: hasClientId && hasClientSecret });
}

/**
 * POST /api/settings/google-oauth
 * Body: { clientId: string, clientSecret: string }
 * Parses either raw values or a full Google OAuth JSON file payload.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Accept either a parsed JSON file ({ installed: {...} } or { web: {...} })
  // or direct { clientId, clientSecret } values.
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  if (body.installed || body.web) {
    const creds = body.installed ?? body.web;
    clientId = creds.client_id;
    clientSecret = creds.client_secret;
  } else {
    clientId = body.clientId;
    clientSecret = body.clientSecret;
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'client_id and client_secret are required' }, { status: 400 });
  }

  await Promise.all([
    setAppConfig('google_client_id', clientId.trim()),
    setAppConfig('google_client_secret', clientSecret.trim()),
  ]);

  return NextResponse.json({ success: true });
}
