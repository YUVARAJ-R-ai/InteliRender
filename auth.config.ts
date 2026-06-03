import type { NextAuthConfig } from 'next-auth';

// Edge-safe config — no Node.js-only imports (no pg, no bcryptjs, no providers).
// Used by middleware solely to check whether a valid session exists.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
