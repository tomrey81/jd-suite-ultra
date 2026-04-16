import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = { id: 'bypass', email: 'demo@quadrance.app', name: 'Demo User' };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header user={user} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-page">{children}</main>
      </div>
    </div>
  );
}
