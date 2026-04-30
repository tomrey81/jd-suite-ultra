import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, isAdminResponse } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (isAdminResponse(admin)) return admin;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const orgId = url.searchParams.get('orgId') || undefined;
  const status = url.searchParams.get('status') || undefined;

  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (status) where.status = status;

  const [jds, total] = await Promise.all([
    db.jobDescription.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit, skip: offset,
      select: {
        id: true, jobTitle: true, jobCode: true, orgUnit: true,
        status: true, folder: true, createdAt: true, updatedAt: true, archivedAt: true,
        org: { select: { id: true, name: true } },
        owner: { select: { email: true, name: true } },
        _count: { select: { versions: true } },
      },
    }),
    db.jobDescription.count({ where }),
  ]);

  return NextResponse.json({ jds, total, limit, offset });
}
