'use client';
import { signOut } from 'next-auth/react';

export function AdminSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="admin-btn sm"
      style={{ width: 'fit-content' }}
    >
      Sign out
    </button>
  );
}
