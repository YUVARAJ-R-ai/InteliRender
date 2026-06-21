import type { Session } from 'next-auth';

/**
 * Returns true when the session belongs to an admin.
 *
 * Admin is gated by the ADMIN_EMAIL env var (the app owner's email). When
 * ADMIN_EMAIL is not set, the app falls back to allowing any authenticated
 * user — so the panel still works out of the box for a single-owner deploy.
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return true; // no admin configured → any signed-in user
  return session.user.email?.trim().toLowerCase() === adminEmail;
}
