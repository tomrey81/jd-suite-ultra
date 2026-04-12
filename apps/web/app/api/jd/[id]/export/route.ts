import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

// GET /api/jd/[id]/export?format=txt|md|json|csv|docx|xlsx
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'txt').toLowerCase();

  const SUPPORTED_FORMATS = ['txt', 'md', 'json', 'csv', 'docx', 'xlsx'];
  if (!SUPPORTED_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Unsupported format "${format}". Supported: ${SUPPORTED_FORMATS.join(', ')}` },
      { status: 400 },
    );
  }

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
  const safeTitle = (data.jobTitle || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `JD_${safeTitle}_${dateStr}`;

  // ── Audit trail ─────────────────────────────────────────────────────────────
  await db.$transaction(async (tx) => {
    await tx.export.create({
      data: { jdId: id, userId: session!.user.id, format: format.toUpperCase() },
    });
    await tx.jDVersion.create({
      data: {
        jdId: id,
        authorId: session!.user.id,
        authorType: 'USER',
        changeType: 'EXPORT',
        note: `Exported as ${format.toUpperCase()}`,
      },
    });
  });

  // ── JSON ─────────────────────────────────────────────────────────────────────
  if (format === 'json') {
    const exportData = {
      jobTitle: data.jobTitle,
      status: jd.status,
      orgUnit: jd.orgUnit,
      data,
      evaluation: evalResult ? (evalResult.criteria as any) : null,
      exportedAt: new Date().toISOString(),
      exportedBy: session!.user.email,
    };
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}.json"`,
      },
    });
  }

  // ── Markdown ─────────────────────────────────────────────────────────────────
  if (format === 'md') {
    const lines = sections.map((s) => {
      const fieldLines = s.fields
        .filter((f) => data[f.id]?.trim())
        .map((f) => `**${f.label}**\n\n${data[f.id]}`)
        .join('\n\n');
      return `## ${s.title}\n\n${fieldLines}`;
    });
    const evalSection = evalResult
      ? (() => {
          const criteria = (evalResult.criteria as any[]) || [];
          const suf = criteria.filter((c: any) => c.status === 'sufficient').length;
          const gaps = criteria.filter((c: any) => c.status === 'insufficient').length;
          return `\n\n---\n\n## Pay Equity Evaluation\n\nSufficient: **${suf}** | Gaps: **${gaps}**`;
        })()
      : '';
    const md = lines.join('\n\n---\n\n') + evalSection;
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.md"`,
      },
    });
  }

  // ── CSV ───────────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    // One row per field: Section, Field, Value
    const csvEscape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows: string[][] = [['Section', 'Field', 'Value']];
    for (const sec of sections) {
      for (const f of sec.fields) {
        const val = data[f.id] || '';
        rows.push([sec.title, f.label, val]);
      }
    }
    // Append evaluation summary if available
    if (evalResult) {
      const criteria = (evalResult.criteria as any[]) || [];
      rows.push(['', '', '']);
      rows.push(['Evaluation', 'Criterion', 'Status']);
      for (const c of criteria) {
        rows.push(['Evaluation', c.criterion || c.name || '', c.status || '']);
      }
    }
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.csv"`,
      },
    });
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────────
  if (format === 'docx') {
    try {
      const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx');
      const children: any[] = [
        new Paragraph({
          text: data.jobTitle || 'Job Description',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: '' }),
      ];
      for (const sec of sections) {
        children.push(
          new Paragraph({ text: sec.title, heading: HeadingLevel.HEADING_2 }),
        );
        for (const f of sec.fields) {
          const val = data[f.id];
          if (val?.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: `${f.label}: `, bold: true }), new TextRun(val)],
              }),
            );
          }
        }
        children.push(new Paragraph({ text: '' }));
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Quadrance JD Suite | Origometrics Platform | EU Pay Transparency Directive 2023/970',
              italics: true,
              size: 18,
            }),
          ],
        }),
      );

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      return new Response(new Blob([new Uint8Array(buffer)]), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${fileName}.docx"`,
        },
      });
    } catch (err: any) {
      if (err?.code === 'MODULE_NOT_FOUND' || err?.message?.includes('Cannot find module')) {
        return NextResponse.json(
          {
            error: 'DOCX export requires the "docx" package.',
            hint: 'Run: pnpm add docx --filter web',
          },
          { status: 501 },
        );
      }
      throw err;
    }
  }

  // ── XLSX ─────────────────────────────────────────────────────────────────────
  if (format === 'xlsx') {
    try {
      const XLSX = await import('xlsx');
      const rows: any[][] = [['Section', 'Field', 'Value']];
      for (const sec of sections) {
        for (const f of sec.fields) {
          rows.push([sec.title, f.label, data[f.id] || '']);
        }
      }
      if (evalResult) {
        const criteria = (evalResult.criteria as any[]) || [];
        rows.push([]);
        rows.push(['Evaluation', 'Criterion', 'Status']);
        for (const c of criteria) {
          rows.push(['Evaluation', c.criterion || c.name || '', c.status || '']);
        }
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'JD');
      const buf: Uint8Array = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new Response(new Blob([new Uint8Array(buf)]), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
        },
      });
    } catch (err: any) {
      if (err?.code === 'MODULE_NOT_FOUND' || err?.message?.includes('Cannot find module')) {
        return NextResponse.json(
          {
            error: 'XLSX export requires the "xlsx" package.',
            hint: 'Run: pnpm add xlsx --filter web',
          },
          { status: 501 },
        );
      }
      throw err;
    }
  }

  // ── TXT (default) ─────────────────────────────────────────────────────────────
  const lines = [
    'JOB DESCRIPTION',
    '='.repeat(60),
    `Status: ${jd.status}`,
    `Code: ${jd.jobCode || '-'}`,
    `Org Unit: ${jd.orgUnit || '-'}`,
    `Exported: ${new Date().toISOString()}`,
    '',
  ];
  for (const sec of sections) {
    lines.push(sec.title.toUpperCase());
    lines.push('-'.repeat(40));
    for (const f of sec.fields) {
      if (data[f.id]?.trim()) {
        lines.push(`${f.label}:\n${data[f.id]}`, '');
      }
    }
    lines.push('');
  }
  if (evalResult) {
    const criteria = (evalResult.criteria as any[]) || [];
    const suf = criteria.filter((c: any) => c.status === 'sufficient').length;
    const gaps = criteria.filter((c: any) => c.status === 'insufficient').length;
    lines.push(
      '='.repeat(60),
      'PAY EQUITY EVALUATION',
      `Sufficient: ${suf} | Gaps: ${gaps}`,
      '',
    );
  }
  lines.push(
    '='.repeat(60),
    'Quadrance JD Suite | Origometrics Platform | EU Pay Transparency Directive 2023/970',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}.txt"`,
    },
  });
}
