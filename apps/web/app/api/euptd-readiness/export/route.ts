import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { CHECKLIST, PILLAR_META, rollupByPillar, overallScore, type Answer, type Lang } from '@/lib/euptd/checklist';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function scope() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const m = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!m) return null;
  return { userId: session.user.id, orgId: m.orgId, orgName: m.org.name };
}

const ANSWER_LABEL: Record<Answer, { en: string; pl: string }> = {
  yes: { en: 'Yes', pl: 'Tak' },
  partial: { en: 'Partial', pl: 'Częściowo' },
  no: { en: 'No', pl: 'Nie' },
  na: { en: 'N/A', pl: 'N/D' },
};

// GET /api/euptd-readiness/export?format=csv|xlsx&lang=en|pl
export async function GET(req: NextRequest) {
  const s = await scope();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'xlsx').toLowerCase();
  const lang = ((url.searchParams.get('lang') || 'en') as Lang);

  const [rows, members] = await Promise.all([
    db.euptdReadinessResponse.findMany({ where: { orgId: s.orgId } }),
    db.membership.findMany({
      where: { orgId: s.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const answersMap = new Map<string, typeof rows[number]>();
  for (const r of rows) answersMap.set(r.itemId, r);

  const memberById = new Map(members.map((m) => [m.user.id, m.user]));

  const plain: Record<string, Answer> = {};
  for (const r of rows) plain[r.itemId] = r.answer as Answer;

  const rollups = rollupByPillar(plain);
  const overall = overallScore(plain);

  // Build flat row data
  const itemRows = CHECKLIST.map((it) => {
    const rec = answersMap.get(it.id);
    const member = rec?.assignedToId ? memberById.get(rec.assignedToId) : null;
    return {
      pillar: PILLAR_META[it.pillar].label[lang],
      itemId: it.id,
      ref: it.ref || '',
      weight: it.weight,
      question: it.question[lang],
      hint: it.hint[lang],
      answer: rec ? ANSWER_LABEL[rec.answer as Answer][lang] : '',
      note: rec?.note || '',
      assignedTo: member ? (member.name || member.email || '') : '',
      lastUpdated: rec ? new Date(rec.updatedAt).toISOString() : '',
    };
  });

  const filenameBase = `euptd-readiness-${slug(s.orgName)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    const headers = ['Pillar', 'ID', 'EUPTD Ref', 'Weight', 'Question', 'Hint', 'Answer', 'Notes', 'Assigned to', 'Last updated'];
    const lines = [headers.join(',')];
    for (const r of itemRows) {
      lines.push([
        csv(r.pillar), csv(r.itemId), csv(r.ref), String(r.weight),
        csv(r.question), csv(r.hint), csv(r.answer), csv(r.note),
        csv(r.assignedTo), csv(r.lastUpdated),
      ].join(','));
    }
    // Append a summary footer
    lines.push('');
    lines.push(`Overall,,,,,,${overall}%,,,`);
    for (const ru of rollups) {
      const meta = PILLAR_META[ru.pillar];
      lines.push(`${csv(meta.label[lang])},,,,,,${ru.score}%,${ru.answered}/${ru.total} answered,,`);
    }

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  // XLSX via exceljs
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JD Suite';
  wb.created = new Date();

  // Sheet 1 — Summary
  const sum = wb.addWorksheet(lang === 'pl' ? 'Podsumowanie' : 'Summary');
  sum.columns = [
    { header: lang === 'pl' ? 'Filar' : 'Pillar', width: 30 },
    { header: lang === 'pl' ? 'Wynik' : 'Score', width: 14 },
    { header: lang === 'pl' ? 'Odpowiedzi' : 'Answered', width: 14 },
    { header: lang === 'pl' ? 'Tak' : 'Yes', width: 8 },
    { header: lang === 'pl' ? 'Częściowo' : 'Partial', width: 12 },
    { header: lang === 'pl' ? 'Nie' : 'No', width: 8 },
    { header: 'N/A', width: 8 },
    { header: 'Status', width: 14 },
  ];
  sum.getRow(1).font = { bold: true };
  sum.addRow([lang === 'pl' ? 'OGÓŁEM' : 'OVERALL', `${overall}%`, '', '', '', '', '', '']);
  sum.getRow(2).font = { bold: true };
  for (const ru of rollups) {
    const meta = PILLAR_META[ru.pillar];
    sum.addRow([
      meta.label[lang],
      `${ru.score}%`,
      `${ru.answered}/${ru.total}`,
      ru.yes, ru.partial, ru.no, ru.na,
      ru.status,
    ]);
  }

  // Sheet 2 — Items
  const items = wb.addWorksheet(lang === 'pl' ? 'Pytania' : 'Items');
  items.columns = [
    { header: lang === 'pl' ? 'Filar' : 'Pillar', width: 28 },
    { header: 'ID', width: 12 },
    { header: lang === 'pl' ? 'Ref EUPTD' : 'EUPTD Ref', width: 16 },
    { header: lang === 'pl' ? 'Waga' : 'Weight', width: 8 },
    { header: lang === 'pl' ? 'Pytanie' : 'Question', width: 60 },
    { header: lang === 'pl' ? 'Wskazówka' : 'Hint', width: 50 },
    { header: lang === 'pl' ? 'Odpowiedź' : 'Answer', width: 14 },
    { header: lang === 'pl' ? 'Notatki' : 'Notes', width: 40 },
    { header: lang === 'pl' ? 'Przypisany do' : 'Assigned to', width: 24 },
    { header: lang === 'pl' ? 'Ostatnia zmiana' : 'Last updated', width: 22 },
  ];
  items.getRow(1).font = { bold: true };
  for (const r of itemRows) {
    items.addRow([
      r.pillar, r.itemId, r.ref, r.weight,
      r.question, r.hint, r.answer, r.note, r.assignedTo, r.lastUpdated,
    ]);
  }
  // Wrap long cells
  items.getColumn(5).alignment = { wrapText: true, vertical: 'top' };
  items.getColumn(6).alignment = { wrapText: true, vertical: 'top' };
  items.getColumn(8).alignment = { wrapText: true, vertical: 'top' };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Blob([new Uint8Array(buffer as ArrayBuffer)]), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}

function csv(s: string | number): string {
  const v = String(s);
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace';
}
