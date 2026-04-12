import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { createCommentSchema } from '@jd-suite/types';

// POST /api/jd/[id]/comment — add a comment (user or guest)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = createCommentSchema.safeParse({ ...body, jdId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Check if authenticated user
    const session = await getSession();
    let authorId: string | null = null;
    let authorType = 'USER';
    let authorEmail: string | null = null;

    if (session?.user) {
      const orgId = session?.orgId;
      const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
      if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      authorId = session!.user.id;
    } else if (body.guestToken) {
      // Guest access via token
      const token = await db.guestToken.findFirst({
        where: {
          token: body.guestToken,
          jdId: id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          role: 'REVIEWER',
        },
      });
      if (!token) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

      authorType = 'GUEST';
      authorEmail = token.email;

      // Mark token as used
      if (!token.usedAt) {
        await db.guestToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const comment = await db.$transaction(async (tx) => {
      const created = await tx.jDComment.create({
        data: {
          jdId: id,
          authorId,
          authorType,
          authorEmail,
          content: parsed.data.content,
          fieldId: parsed.data.fieldId || null,
        },
      });

      await tx.jDVersion.create({
        data: {
          jdId: id,
          authorId,
          authorType,
          changeType: 'COMMENT',
          fieldChanged: parsed.data.fieldId || null,
          newValue: parsed.data.content.slice(0, 200),
          note: authorType === 'GUEST' ? `Guest comment from ${authorEmail}` : 'Comment added',
        },
      });

      return created;
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Comment error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}

// GET /api/jd/[id]/comment — list comments
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (session?.user) {
    const orgId = session?.orgId;
    const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
    if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } else {
    // Guest — verify via query param
    const url = new URL(req.url);
    const guestToken = url.searchParams.get('token');
    if (!guestToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await db.guestToken.findFirst({
      where: { token: guestToken, jdId: id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const comments = await db.jDComment.findMany({
    where: { jdId: id },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, email: true } } },
  });

  return NextResponse.json(comments);
}
