import { Header } from '@/components/layout/header';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AICompanion } from '@/components/ai/ai-companion';
import { getSession } from '@/lib/get-session';

// Dashboard pages require auth + live DB — never statically prerender
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session?.user ?? { id: 'guest', email: '', name: 'Guest' };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header user={user} />
      <DashboardShell>{children}</DashboardShell>
      <AICompanion />
    </div>
  );
}
