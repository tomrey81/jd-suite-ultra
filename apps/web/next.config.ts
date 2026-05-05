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
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://thetotalrewardsacademy2026.vercel.app https://*.vercel.app http://localhost:*",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // microphone=(self) allows this page to request mic permission (required for
            // Web Speech API in Krystyna and VoiceInput). Camera and geolocation remain blocked.
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
