import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/templates/[id]/duplicate
export async function POST(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const source = await db.template.findFirst({
    where: { id, OR: [{ orgId }, { orgId: null }] },
  });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const copy = await db.template.create({
    data: {
      orgId,
      createdById: session.user.id,
      name: `${source.name} (copy)`,
      purpose: source.purpose,
      description: source.description,
      sections: source.sections as any,
      isDefault: false,
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
