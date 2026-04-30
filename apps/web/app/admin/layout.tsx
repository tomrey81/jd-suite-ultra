import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import './admin.css';
import { AdminSignOut } from './_components/sign-out';
import { AdminNav } from './_components/admin-nav';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'JD Suite — Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <b>JD Suite</b>
          <span>Admin Console</span>
        </div>
        <AdminNav />

        <div className="admin-side-foot">
          <div>
            <div style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{admin.name || admin.email}</div>
            <div>Platform admin</div>
          </div>
          <AdminSignOut />
          <Link href="/" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>← Back to app</Link>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
