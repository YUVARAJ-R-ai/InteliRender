import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { AdminPanel } from '@/components/admin/AdminPanel';

export const metadata = { title: 'Admin · IntelliRender' };

export default async function AdminPage() {
  const session = await auth();

  // Unauthenticated → login
  if (!session?.user) {
    redirect('/auth/login');
  }

  // Authenticated but not admin → access denied
  if (!isAdmin(session)) {
    return (
      <div className="min-h-screen w-full bg-[#1a1a1a] text-[#E8EDF2] flex items-center justify-center px-6">
        <div className="max-w-[400px] text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#E8EDF2]">Access denied</h1>
            <p className="text-[13px] text-[#6B7280] mt-1.5 leading-relaxed">
              This page is restricted to administrators. Signed in as{' '}
              <span className="text-[#9CA3AF]">{session.user.email}</span>.
            </p>
          </div>
          <Link
            href="/"
            className="text-[13px] text-[#8AB4F8] hover:text-white transition-colors"
          >
            ← Back to chat
          </Link>
        </div>
      </div>
    );
  }

  return <AdminPanel adminEmail={session.user.email ?? 'admin'} />;
}
