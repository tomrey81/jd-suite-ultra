import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import LinkedIn from 'next-auth/providers/linkedin';
import Facebook from 'next-auth/providers/facebook';
import { compare } from 'bcryptjs';
import { db } from '@jd-suite/db';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/admin/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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

/** Find-or-create a user from an OAuth profile. Returns the DB user id. */
async function findOrCreateOAuthUser(opts: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
}): Promise<string | null> {
  const email = opts.email.toLowerCase().trim();
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    const result = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, name: opts.name ?? null, image: opts.image ?? null, lastLoginAt: new Date() },
      });
      const org = await tx.organisation.create({
        data: { name: opts.name ? `${opts.name}'s workspace` : 'My workspace' },
      });
      await tx.membership.create({
        data: { userId: newUser.id, orgId: org.id, role: 'ADMIN' },
      });
      return newUser;
    });
    user = result;
  } else {
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        name: user.name ?? opts.name ?? null,
        image: user.image ?? opts.image ?? null,
      },
    });
  }

  await db.account.upsert({
    where: {
      provider_providerAccountId: { provider: opts.provider, providerAccountId: opts.providerAccountId },
    },
    update: {
      access_token: opts.access_token, refresh_token: opts.refresh_token,
      expires_at: opts.expires_at, token_type: opts.token_type,
      scope: opts.scope, id_token: opts.id_token,
    },
    create: {
      userId: user.id, type: 'oauth',
      provider: opts.provider, providerAccountId: opts.providerAccountId,
      access_token: opts.access_token, refresh_token: opts.refresh_token,
      expires_at: opts.expires_at, token_type: opts.token_type,
      scope: opts.scope, id_token: opts.id_token,
    },
  });

  return user.id;
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
        if (!rl.ok) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { memberships: { include: { org: true }, take: 1 } },
        });

        if (!user || !user.passwordHash) return null;
        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
    GitHub({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }),
    LinkedIn({ clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET }),
    Facebook({ clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET }),
  ],
  pages: {
    signIn: '/login',
    newUser: '/register',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials: already verified in authorize()
      if (!account || account.type === 'credentials') return true;
      // OAuth: find-or-create user in DB
      if (!user.email) return false;
      const id = await findOrCreateOAuthUser({
        email: user.email, name: user.name, image: user.image,
        provider: account.provider, providerAccountId: account.providerAccountId,
        access_token: account.access_token, refresh_token: account.refresh_token,
        expires_at: account.expires_at, token_type: account.token_type,
        scope: account.scope, id_token: account.id_token,
      });
      if (!id) return false;
      user.id = id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
    maxAge: 7 * 24 * 60 * 60,
  },
});
