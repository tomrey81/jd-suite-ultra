'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Inter, system-ui, sans-serif',
          background: '#F6F4EF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: '2rem',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e3de',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8A7560',
              marginBottom: 8,
            }}
          >
            JD Suite
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            An unexpected error occurred. The error has been logged automatically.
            {error.digest && (
              <span
                style={{
                  display: 'block',
                  marginTop: 8,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#9ca3af',
                }}
              >
                Ref: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#8A7560',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
