import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(12).max(128),
  orgName: z.string().min(1).max(200),
  country: z.string().min(2).max(56),
  jobFunction: z.string().min(1).max(120),
  accessCode: z.string().min(1).max(120),
  // Required consents
  dataConsent: z.literal(true),       // GDPR Art. 6(1)(b) — necessary for account
  tosAccept: z.literal(true),          // Terms of Service
  privacyAccept: z.literal(true),      // Privacy Policy
  // Optional consents (Art. 6(1)(a) — must be opt-in, defaults false)
  marketingOptIn: z.boolean().optional().default(false),
  newsletterOptIn: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      firstName, lastName, email, password, orgName,
      country, jobFunction, accessCode, marketingOptIn, newsletterOptIn,
    } = parsed.data;

    // Validate access code BEFORE consuming any DB writes
    const code = await db.accessCode.findUnique({ where: { code: accessCode.trim() } });
    if (!code || !code.active) {
      return NextResponse.json({ error: 'Invalid or inactive access code' }, { status: 403 });
    }
    if (code.expiresAt && code.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Access code has expired' }, { status: 403 });
    }
    if (code.maxUses != null && code.usesCount >= code.maxUses) {
      return NextResponse.json({ error: 'Access code has reached its usage limit' }, { status: 403 });
    }

    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);

    // Create user, org, membership, code-use record — all in one transaction
    const result = await db.$transaction(async (tx) => {
      const now = new Date();
      const user = await tx.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          country,
          jobFunction,
          passwordHash,
          dataConsentAt: now,
          tosAcceptedAt: now,
          privacyAcceptedAt: now,
          marketingOptIn: !!marketingOptIn,
          newsletterOptIn: !!newsletterOptIn,
        },
      });

      const org = await tx.organisation.create({ data: { name: orgName } });

      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: 'ADMIN' },
      });

      await tx.accessCodeUse.create({
        data: { accessCodeId: code.id, userId: user.id },
      });

      await tx.accessCode.update({
        where: { id: code.id },
        data: { usesCount: { increment: 1 } },
      });

      return { userId: user.id, orgId: org.id };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
