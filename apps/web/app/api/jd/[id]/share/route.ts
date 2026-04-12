import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { createGuestTokenSchema } from '@jd-suite/types';

// POST /api/jd/[id]/share — create a guest review token
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = createGuestTokenSchema.safeParse({ ...body, jdId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { email, role, expiryHours } = parsed.data;

    const token = await db.$transaction(async (tx) => {
      const guestToken = await tx.guestToken.create({
        data: {
          jdId: id,
          createdById: session!.user.id,
          email,
          role,
          expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        },
      });

      // Audit trail
      await tx.jDVersion.create({
        data: {
          jdId: id,
          authorId: session!.user.id,
          authorType: 'USER',
          changeType: 'FIELD_EDIT',
          note: `Shared with ${email} as ${role} (expires in ${expiryHours}h)`,
        },
      });

      return guestToken;
    });

    const reviewUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/review/${token.token}`;

    // TODO: Send email via Resend with reviewUrl

    return NextResponse.json({ token: token.token, reviewUrl, expiresAt: token.expiresAt }, { status: 201 });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// GET /api/jd/[id]/share — list active tokens
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tokens = await db.guestToken.findMany({
    where: { jdId: id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(tokens);
}
