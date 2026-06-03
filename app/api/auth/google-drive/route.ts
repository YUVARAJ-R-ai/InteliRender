import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAppConfig } from '@/lib/app-config';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
].join(' ');

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/login', req.url));

  const clientId = await getAppConfig('google_client_id') ?? process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response('Google OAuth credentials are not configured. Go to Settings → Integrations and upload your OAuth JSON.', { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google-drive/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set('gdrive_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
