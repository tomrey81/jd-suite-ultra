import type { TemplateSection } from '@jd-suite/types';

export type JDData = Record<string, string>;

export function buildJDEmpty(sections: TemplateSection[]): JDData {
  const jd: JDData = {};
  for (const sec of sections) {
    for (const f of sec.fields) {
      if (f.type === 'select' || f.type === 'radio') {
        jd[f.id] = f.opts?.[0] ?? '';
      } else {
        jd[f.id] = '';
      }
    }
  }
  return jd;
}

export function compScore(jd: JDData, sections: TemplateSection[]): number {
  const required: string[] = [];
  for (const s of sections) {
    for (const f of s.fields) {
      if (f.required) required.push(f.id);
    }
  }
  if (!required.length) return 0;
  const filled = required.filter((k) => (jd[k] || '').trim().length > 0);
  return Math.round((filled.length / required.length) * 100);
}

export function secScore(jd: JDData, sec: TemplateSection): number {
  const required = sec.fields.filter((f) => f.required).map((f) => f.id);
  if (!required.length) return 100;
  const filled = required.filter((k) => (jd[k] || '').trim().length > 0);
  return Math.round((filled.length / required.length) * 100);
}

export function buildText(jd: JDData, sections: TemplateSection[]): string {
  const lines: string[] = [];
  for (const sec of sections) {
    for (const f of sec.fields) {
      const val = jd[f.id];
      if (val && val.trim()) {
        lines.push(`${f.label.toUpperCase()}: ${val}`);
      }
    }
  }
  return lines.join('\n') || '[No data yet]';
}

export function formatDate(date: Date | string | number): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
