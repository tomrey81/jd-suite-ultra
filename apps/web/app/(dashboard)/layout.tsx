import { Header } from '@/components/layout/header';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = { id: 'bypass', email: 'demo@quadrance.app', name: 'Demo User' };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header user={user} />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
