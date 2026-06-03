import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appConfig } from '@/lib/db/schema';
import { encrypt, decrypt } from '@/lib/encryption';

export async function getAppConfig(key: string): Promise<string | null> {
  const [row] = await db
    .select({ encryptedValue: appConfig.encryptedValue })
    .from(appConfig)
    .where(eq(appConfig.key, key))
    .limit(1);
  if (!row) return null;
  try { return decrypt(row.encryptedValue); } catch { return null; }
}

export async function setAppConfig(key: string, value: string): Promise<void> {
  await db
    .insert(appConfig)
    .values({ key, encryptedValue: encrypt(value) })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { encryptedValue: encrypt(value), updatedAt: new Date() },
    });
}

export async function hasAppConfig(key: string): Promise<boolean> {
  const [row] = await db
    .select({ key: appConfig.key })
    .from(appConfig)
    .where(eq(appConfig.key, key))
    .limit(1);
  return !!row;
}
