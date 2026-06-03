import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listUserSettingKeys, setUserSetting } from '@/lib/user-settings';
import { maskSecret } from '@/lib/encryption';
import { getUserSetting } from '@/lib/user-settings';

const VALID_KEYS = ['api_key_siliconflow', 'api_key_openai', 'api_key_anthropic', 'api_key_custom'];

/** GET /api/settings/keys — return key names + masked hint (never the value) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await listUserSettingKeys(session.user.id);
  // Only return API key entries; build a map of key → masked hint
  const filtered = keys.filter(k => k.startsWith('api_key_'));

  const result: Record<string, { saved: boolean; hint: string }> = {};
  for (const key of VALID_KEYS) {
    const saved = filtered.includes(key);
    let hint = '';
    if (saved) {
      const val = await getUserSetting(session.user.id, key);
      hint = val ? maskSecret(val) : '';
    }
    result[key] = { saved, hint };
  }

  return NextResponse.json(result);
}

/** POST /api/settings/keys — save/update an encrypted key */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, value } = await req.json();
  if (!key || !value) return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  if (!VALID_KEYS.includes(key)) return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });

  await setUserSetting(session.user.id, key, value.trim());
  return NextResponse.json({ success: true });
}
