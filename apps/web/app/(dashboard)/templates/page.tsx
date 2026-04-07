import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const orgId = (session as any).orgId;

  const templates = await db.template.findMany({
    where: { OR: [{ orgId: orgId || undefined }, { orgId: null }] },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Template Builder</h1>
            <p className="text-xs text-text-secondary">
              Manage JD templates. Drag sections and fields to reorder. Toggle required/optional. Add custom fields.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {templates.map((t) => {
            const sections = (t.sections as any[]) || [];
            const fieldCount = sections.reduce((a: number, s: any) => a + (s.fields?.length || 0), 0);
            return (
              <div key={t.id} className="rounded-lg border border-border-default bg-white p-[18px]">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
                  {t.isDefault ? 'Default' : 'Custom'}
                </div>
                <div className="mb-1 font-display text-[0.95rem] font-semibold text-text-primary">{t.name}</div>
                <p className="mb-2.5 text-[11px] leading-relaxed text-text-muted">{t.description}</p>
                <div className="mb-3 text-[11px] text-text-muted">
                  {sections.length} sections · {fieldCount} fields · {t.purpose}
                </div>
                <div className="flex gap-2">
                  <Link href="/jd/new"
                    className="rounded-md border border-border-default px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-brand-gold">
                    Use template
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
