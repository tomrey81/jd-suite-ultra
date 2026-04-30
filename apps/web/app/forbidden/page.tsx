import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '403 — JD Suite' };

export default function Forbidden() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#FAF7F2',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8A7560',
            marginBottom: 16,
          }}
        >
          JD Suite
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display, "Playfair Display", Georgia, serif)',
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1.1,
            marginBottom: 12,
            color: '#1A1A1A',
            letterSpacing: '-0.01em',
          }}
        >
          403 — <em style={{ color: '#8A7560', fontStyle: 'italic' }}>not for you.</em>
        </h1>
        <p style={{ color: '#55524A', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
          This area is reserved for platform admins. If you think you should have access,
          ping Tomasz on LinkedIn.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              background: '#1A1A1A',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ← Back to JD Suite
          </Link>
          <a
            href="https://www.linkedin.com/in/tomaszrey"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: '1px solid rgba(26, 26, 15, 0.15)',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#1A1A1A',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Contact Tomasz
          </a>
        </div>
      </div>
    </main>
  );
}
