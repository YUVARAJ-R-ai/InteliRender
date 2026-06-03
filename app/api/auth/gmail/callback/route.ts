import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { mcpConnections } from '@/lib/db/schema';
import { encrypt } from '@/lib/encryption';
import { cookies } from 'next/headers';
import { getAppConfig } from '@/lib/app-config';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/login', req.url));

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const returnUrl = new URL('/', req.url);
  returnUrl.searchParams.set('settings', 'Integrations');

  if (error) { returnUrl.searchParams.set('error', 'gmail_denied'); return NextResponse.redirect(returnUrl); }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('gmail_oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    returnUrl.searchParams.set('error', 'gmail_state');
    return NextResponse.redirect(returnUrl);
  }
  if (!code) { returnUrl.searchParams.set('error', 'gmail_no_code'); return NextResponse.redirect(returnUrl); }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const clientId = await getAppConfig('google_client_id') ?? process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = await getAppConfig('google_client_secret') ?? process.env.GOOGLE_CLIENT_SECRET!;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      returnUrl.searchParams.set('error', 'gmail_no_refresh');
      return NextResponse.redirect(returnUrl);
    }

    await db.insert(mcpConnections).values({
      userId: session.user.id, service: 'gmail',
      accessToken: encrypt(tokens.refresh_token),
      status: 'connected', metadata: null,
      lastSynced: new Date(), updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [mcpConnections.userId, mcpConnections.service],
      set: { accessToken: encrypt(tokens.refresh_token), status: 'connected', lastSynced: new Date(), updatedAt: new Date() },
    });

    returnUrl.searchParams.set('connected', 'gmail');
    const response = NextResponse.redirect(returnUrl);
    response.cookies.delete('gmail_oauth_state');
    return response;
  } catch (err) {
    console.error('Gmail OAuth error:', err);
    returnUrl.searchParams.set('error', 'gmail_failed');
    return NextResponse.redirect(returnUrl);
  }
}
