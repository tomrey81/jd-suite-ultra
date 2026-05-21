import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ImportTemplatePage } from '@/components/templates/import-template-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import Template — JD Suite' };

export default async function TemplateImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/templates/import');

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-6">
          <Link
            href="/templates"
            className="text-[11px] text-text-muted hover:text-brand-gold"
          >
            &larr; Templates
          </Link>
          <div className="mt-3 mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
            Templates
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Import Customer Template
          </h1>
          <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-text-secondary">
            Upload an existing JD template in any format. JD Suite maps the structure to a
            compatible template, then assesses it against ILO pay equity and EIGE gender equality
            criteria. You can add recommended compliance fields before saving.
          </p>
        </div>
        <ImportTemplatePage />
      </div>
    </div>
  );
}
