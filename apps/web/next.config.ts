import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ['@jd-suite/db', '@jd-suite/types'],
  serverExternalPackages: ['canvas'],
  webpack: (config) => {
    // pdfjs-dist bundles a canvas dependency that isn't available in Vercel
    // build/runtime — mark it external so webpack doesn't try to bundle it.
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // SEC-03: full CSP — not just frame-ancestors.
            // 'unsafe-inline' required by Next.js App Router (no nonce setup yet).
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "connect-src 'self' https://api.anthropic.com https://*.neon.tech https://*.vercel.app",
              // SEC-08: restrict to specific known domains, not wildcard *.vercel.app
              "frame-ancestors 'self' https://thetotalrewardsacademy2026.vercel.app",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SEC-08: belt-and-suspenders for older browsers that ignore CSP frame-ancestors
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // SEC-04: HSTS — enforce HTTPS for 1 year
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Permissions-Policy',
            // SEC-15: block dangerous browser APIs; microphone=(self) for Web Speech API (Krystyna/VoiceInput)
            value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=()',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
