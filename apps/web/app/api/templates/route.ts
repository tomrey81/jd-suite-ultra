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

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  purpose: z.string().default('general'),
  description: z.string().default(''),
  sections: z.array(sectionSchema),
  isDefault: z.boolean().optional(),
});

// GET /api/templates — list all accessible templates (org + system)
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;

  const templates = await db.template.findMany({
    where: orgId ? { OR: [{ orgId }, { orgId: null }] } : { orgId: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { jds: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(templates);
}

// POST /api/templates — create new template
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, purpose, description, sections, isDefault } = parsed.data;

    // If isDefault, clear default flag on other org templates
    if (isDefault) {
      await db.template.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const tpl = await db.template.create({
      data: {
        orgId,
        createdById: session.user.id,
        name,
        purpose,
        description,
        sections: sections as any,
        isDefault: isDefault ?? false,
      },
    });

    return NextResponse.json(tpl, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
