import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserSetting, deleteUserSetting } from '@/lib/user-settings';

/** DELETE /api/settings/keys/[name] — remove a saved key */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await params;
  await deleteUserSetting(session.user.id, name);
  return NextResponse.json({ success: true });
}

/** POST /api/settings/keys/[name]/test — validate a key with a lightweight ping */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  const apiKey = await getUserSetting(session.user.id, name);
  if (!apiKey) return NextResponse.json({ valid: false, error: 'Key not saved' });

  try {
    if (name === 'api_key_siliconflow') {
      const res = await fetch('https://api.siliconflow.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return NextResponse.json({ valid: res.ok, status: res.status });
    }
    if (name === 'api_key_openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return NextResponse.json({ valid: res.ok, status: res.status });
    }
    if (name === 'api_key_anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      return NextResponse.json({ valid: res.ok, status: res.status });
    }
    return NextResponse.json({ valid: true, note: 'No test available for this key type' });
  } catch {
    return NextResponse.json({ valid: false, error: 'Network error during test' });
  }
}
