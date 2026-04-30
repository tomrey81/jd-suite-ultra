import Link from 'next/link';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TemplatesList } from '@/components/templates/templates-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'JD Templates — JD Suite' };

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/templates');

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  const orgId = membership?.orgId;

  const templates = await db.template.findMany({
    where: orgId ? { OR: [{ orgId }, { orgId: null }] } : { orgId: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { jds: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
              Templates
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
              JD Templates
            </h1>
            <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-text-secondary">
              Define section structure, required fields, help text, and validation rules.
              Templates drive what the AI Editor and Lint &amp; Analyse expect from a JD.
            </p>
          </div>
          <Link
            href="/templates/new"
            className="rounded-full bg-brand-gold px-4 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:bg-brand-gold/90"
          >
            + New Template
          </Link>
        </div>

        <TemplatesList templates={templates as any} orgId={orgId ?? null} />
      </div>
    </div>
  );
}
