/**
 * Export tabular data to Word (.docx), Excel (.xlsx), CSV, or Notion-friendly
 * Markdown. Designed for JD lists, command-center tasks, architecture slot
 * tables, process step tables, position rosters etc.
 */

import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType } from 'docx';
import ExcelJS from 'exceljs';

export interface DataColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  /** Optional render function if cell value needs derivation/formatting */
  get?: (row: T) => string | number | null | undefined;
  width?: number;
}

export interface DataExportOptions<T = Record<string, unknown>> {
  title: string;
  rows: T[];
  columns: DataColumn<T>[];
  fileName?: string;
  /** Optional subtitle / caption shown above the table */
  subtitle?: string;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getCell<T>(row: T, col: DataColumn<T>): string {
  const v = col.get ? col.get(row) : (row as Record<string, unknown>)[col.key];
  if (v == null) return '';
  return String(v);
}

// ─── CSV ────────────────────────────────────────────────────────────────────

export function exportCsv<T>(opts: DataExportOptions<T>): void {
  const { rows, columns, fileName = 'export' } = opts;
  const escape = (s: string) =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escape(getCell(r, c))).join(','))
    .join('\n');
  const csv = '\uFEFF' + header + '\n' + body; // BOM for Excel
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileName}-${timestamp()}.csv`);
}

// ─── Markdown (Notion-friendly) ─────────────────────────────────────────────

export function exportMarkdown<T>(opts: DataExportOptions<T>): void {
  const { title, subtitle, rows, columns, fileName = 'export' } = opts;
  const escapeMd = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines: string[] = [];
  lines.push(`# ${title}`);
  if (subtitle) lines.push('', `_${subtitle}_`);
  lines.push('', `*Exported ${new Date().toISOString()} · ${rows.length} rows*`, '');
  lines.push(`| ${columns.map((c) => escapeMd(c.label)).join(' | ')} |`);
  lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
  for (const r of rows) {
    lines.push(`| ${columns.map((c) => escapeMd(getCell(r, c))).join(' | ')} |`);
  }
  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }),
    `${fileName}-${timestamp()}.md`,
  );
}

// ─── Excel (.xlsx) ──────────────────────────────────────────────────────────

export async function exportXlsx<T>(opts: DataExportOptions<T>): Promise<void> {
  const { title, subtitle, rows, columns, fileName = 'export' } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JD Suite';
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31)); // sheet name max 31 chars

  // Title row
  ws.mergeCells(1, 1, 1, columns.length);
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { bold: true, size: 14 };
  titleRow.height = 22;
  let nextRow = 2;
  if (subtitle) {
    ws.mergeCells(nextRow, 1, nextRow, columns.length);
    const r = ws.getRow(nextRow);
    r.getCell(1).value = subtitle;
    r.getCell(1).font = { italic: true, color: { argb: 'FF777777' }, size: 10 };
    nextRow++;
  }
  ws.mergeCells(nextRow, 1, nextRow, columns.length);
  const meta = ws.getRow(nextRow);
  meta.getCell(1).value = `Exported ${new Date().toISOString()} · ${rows.length} rows`;
  meta.getCell(1).font = { color: { argb: 'FF999999' }, size: 9 };
  nextRow += 2;

  // Header
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? Math.max(12, Math.min(40, c.label.length + 4)),
  }));
  const headerRow = ws.getRow(nextRow);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.label;
    headerRow.getCell(i + 1).font = { bold: true };
    headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6D8' } };
    headerRow.getCell(i + 1).border = { bottom: { style: 'thin', color: { argb: 'FF8A7560' } } };
  });
  nextRow++;

  // Data
  for (const r of rows) {
    const row = ws.getRow(nextRow);
    columns.forEach((c, i) => {
      const v = c.get ? c.get(r) : (r as Record<string, unknown>)[c.key];
      row.getCell(i + 1).value = v == null ? '' : (v as string | number);
    });
    nextRow++;
  }

  ws.views = [{ state: 'frozen', ySplit: nextRow - rows.length - 1 }];

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}-${timestamp()}.xlsx`,
  );
}

// ─── Word (.docx) ───────────────────────────────────────────────────────────

export async function exportDocx<T>(opts: DataExportOptions<T>): Promise<void> {
  const { title, subtitle, rows, columns, fileName = 'export' } = opts;

  const headerCells = columns.map((c) =>
    new TableCell({
      width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
      children: [new Paragraph({ text: c.label, alignment: AlignmentType.LEFT })],
    }),
  );

  const dataRows = rows.map((r) =>
    new TableRow({
      children: columns.map((c) =>
        new TableCell({
          width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
          children: [new Paragraph(getCell(r, c))],
        }),
      ),
    }),
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
  });

  const doc = new Document({
    creator: 'JD Suite',
    title,
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          ...(subtitle ? [new Paragraph({ text: subtitle, italics: true } as never)] : []),
          new Paragraph({ text: `Exported ${new Date().toISOString()}  ·  ${rows.length} rows`, spacing: { after: 200 } }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(
    blob,
    `${fileName}-${timestamp()}.docx`,
  );
}
