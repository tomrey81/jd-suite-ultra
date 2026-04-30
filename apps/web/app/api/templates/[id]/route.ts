import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.string(),
  required: z.boolean().optional(),
  hint: z.string().optional(),
  rows: z.number().optional(),
  opts: z.array(z.string()).optional(),
  ai: z.boolean().optional(),
  priority: z.string().optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  desc: z.string().optional(),
  required: z.boolean().optional(),
  fields: z.array(fieldSchema),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  purpose: z.string().optional(),
  description: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
  isDefault: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/templates/[id]
export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = session?.orgId;

  const tpl = await db.template.findFirst({
    where: {
      id,
      OR: [{ orgId }, { orgId: null }],
    },
    include: {
      _count: { select: { jds: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tpl);
}

// PATCH /api/templates/[id]
export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  // Only org-owned templates can be edited
  const existing = await db.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.orgId !== orgId) {
    return NextResponse.json({ error: 'System templates cannot be edited. Duplicate first.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.isDefault) {
      await db.template.updateMany({
        where: { orgId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const tpl = await db.template.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.purpose !== undefined && { purpose: parsed.data.purpose }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.sections !== undefined && { sections: parsed.data.sections as any }),
        ...(parsed.data.isDefault !== undefined && { isDefault: parsed.data.isDefault }),
      },
    });

    return NextResponse.json(tpl);
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/templates/[id]
export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = session?.orgId;

  const existing = await db.template.findUnique({
    where: { id },
    include: { _count: { select: { jds: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.orgId !== orgId) {
    return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 403 });
  }
  if (existing._count.jds > 0) {
    return NextResponse.json({ error: `Template is used by ${existing._count.jds} JD(s). Reassign them first.` }, { status: 409 });
  }

  await db.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
