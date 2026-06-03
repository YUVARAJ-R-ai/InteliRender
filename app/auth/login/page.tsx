'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  }

  async function handleGoogle() {
    await signIn('google', { redirectTo: '/' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1C1E] px-4">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#E8EDF2] tracking-tight">
            IntelliRender
          </h1>
          <p className="text-sm text-[#A5A299] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-[#1F2226] border border-white/[0.06] rounded-2xl p-8 shadow-lg">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A5A299] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#2D2F33] border border-white/[0.06] text-[#E8EDF2] placeholder-[#A5A299]/50 text-sm outline-none focus:border-[#8AB4F8]/40 focus:ring-1 focus:ring-[#8AB4F8]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A5A299] mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-[#2D2F33] border border-white/[0.06] text-[#E8EDF2] placeholder-[#A5A299]/50 text-sm outline-none focus:border-[#8AB4F8]/40 focus:ring-1 focus:ring-[#8AB4F8]/20 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#8AB4F8] hover:bg-[#8AB4F8]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#1A1C1E] text-sm font-semibold transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-[#A5A299]">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-2.5 rounded-xl bg-[#2D2F33] hover:bg-[#3D3F43] border border-white/[0.06] text-[#E8EDF2] text-sm font-medium flex items-center justify-center gap-3 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="text-center text-sm text-[#A5A299] mt-6">
            No account?{' '}
            <Link href="/auth/signup" className="text-[#8AB4F8] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
