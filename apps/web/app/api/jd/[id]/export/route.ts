import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

// GET /api/jd/[id]/export?format=txt|md|json
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'txt';

  const jd = await db.jobDescription.findFirst({
    where: { id, orgId },
    include: {
      template: true,
      evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) || DEFAULT_TEMPLATE_SECTIONS;
  const data = (jd.data as Record<string, string>) || {};
  const evalResult = jd.evalResults[0];
  const fileName = `JD_${(data.jobTitle || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

  // Audit trail
  await db.$transaction(async (tx) => {
    await tx.export.create({
      data: { jdId: id, userId: session.user.id, format: format.toUpperCase() },
    });
    await tx.jDVersion.create({
      data: {
        jdId: id,
        authorId: session.user.id,
        authorType: 'USER',
        changeType: 'EXPORT',
        note: `Exported as ${format.toUpperCase()}`,
      },
    });
  });

  if (format === 'json') {
    const exportData = {
      jobTitle: data.jobTitle,
      status: jd.status,
      orgUnit: jd.orgUnit,
      data,
      evaluation: evalResult ? (evalResult.criteria as any) : null,
      exportedAt: new Date().toISOString(),
    };
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}.json"`,
      },
    });
  }

  if (format === 'md') {
    const lines = sections.map((s) => {
      const fieldLines = s.fields
        .filter((f) => data[f.id]?.trim())
        .map((f) => `**${f.label}**\n\n${data[f.id]}`)
        .join('\n\n');
      return `## ${s.title}\n\n${fieldLines}`;
    });
    const md = lines.join('\n\n---\n\n');
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.md"`,
      },
    });
  }

  // Default: TXT
  const lines = [
    'JOB DESCRIPTION',
    '='.repeat(60),
    `Status: ${jd.status}`,
    `Code: ${jd.jobCode || '-'}`,
    '',
  ];
  for (const sec of sections) {
    lines.push(sec.title.toUpperCase());
    for (const f of sec.fields) {
      if (data[f.id]?.trim()) {
        lines.push(`${f.label}:\n${data[f.id]}`, '');
      }
    }
  }
  if (evalResult) {
    const criteria = (evalResult.criteria as any[]) || [];
    const suf = criteria.filter((c: any) => c.status === 'sufficient').length;
    const gaps = criteria.filter((c: any) => c.status === 'insufficient').length;
    lines.push(
      '='.repeat(60),
      'PAY EQUITY EVALUATION',
      `Sufficient: ${suf} | Gaps: ${gaps}`,
    );
  }
  lines.push('', 'Quadrance JD Suite | Origometrics Platform | EU Pay Transparency Directive 2023/970');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}.txt"`,
    },
  });
}
