import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { encrypt, decrypt } from '@/lib/encryption';

/** Retrieve and decrypt a setting value. Returns null if not set. */
export async function getUserSetting(userId: string, key: string): Promise<string | null> {
  const [row] = await db
    .select({ encryptedValue: userSettings.encryptedValue })
    .from(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)))
    .limit(1);

  if (!row) return null;
  try {
    return decrypt(row.encryptedValue);
  } catch {
    return null;
  }
}

/** Save (upsert) an encrypted setting. */
export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  const encryptedValue = encrypt(value);
  await db
    .insert(userSettings)
    .values({ userId, key, encryptedValue })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.key],
      set: { encryptedValue, updatedAt: new Date() },
    });
}

/** Delete a setting. */
export async function deleteUserSetting(userId: string, key: string): Promise<void> {
  await db
    .delete(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)));
}

/** List all setting keys for a user (values never returned). */
export async function listUserSettingKeys(userId: string): Promise<string[]> {
  const rows = await db
    .select({ key: userSettings.key })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return rows.map(r => r.key);
}

// ── Convenience: API key helpers ─────────────────────────────────────────────

export const KEY_SILICONFLOW = 'api_key_siliconflow';
export const KEY_OPENAI      = 'api_key_openai';
export const KEY_ANTHROPIC   = 'api_key_anthropic';

/** Returns the user's SiliconFlow key from DB, or falls back to env var. */
export async function getSiliconFlowKey(userId: string): Promise<string> {
  const dbKey = await getUserSetting(userId, KEY_SILICONFLOW);
  return dbKey ?? process.env.SILICONFLOW_API_KEY ?? '';
}
