import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@jd-suite/db';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/admin/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Login rate limit: 10 attempts per 15 min per IP. Lifted from
// admin-panel-lite playbook (loginRateLimiter — max 10 in 15 min).
async function rateLimitKey(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip = await rateLimitKey();
        const rl = await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
        if (!rl.ok) {
          // Block authorize; NextAuth maps null to a generic error
          // (timing-stable). The retry-after window is 15 minutes.
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: {
            memberships: {
              include: { org: true },
              take: 1,
            },
          },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
    newUser: '/register',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Fetch org membership for the token
        const membership = await db.membership.findFirst({
          where: { userId: user.id as string },
          orderBy: { org: { createdAt: 'desc' } },
        });
        if (membership) {
          token.orgId = membership.orgId;
          token.orgRole = membership.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session as any).orgId = token.orgId as string | undefined;
        (session as any).orgRole = token.orgRole as string | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
