'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◇', exact: true },
  { href: '/admin/users', label: 'Users', icon: '◉', exact: false },
  { href: '/admin/orgs', label: 'Organisations', icon: '◈', exact: false },
  { href: '/admin/access-codes', label: 'Access codes', icon: '⌥', exact: false },
  { href: '/admin/jds', label: 'JDs & Audit', icon: '☰', exact: false },
  { href: '/admin/audit', label: 'Admin log', icon: '◌', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'active' : ''}
          >
            <span style={{ width: 14, display: 'inline-block', textAlign: 'center', color: 'var(--action)' }}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
