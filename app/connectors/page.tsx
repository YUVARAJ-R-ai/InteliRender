import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ConnectorsPage } from '@/components/connectors/ConnectorsPage';

export const metadata = { title: 'Connectors · IntelliRender' };

export default async function Connectors() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');
  return <ConnectorsPage />;
}
