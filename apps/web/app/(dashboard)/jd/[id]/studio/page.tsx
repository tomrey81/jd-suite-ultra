import { db } from '@jd-suite/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StudioView } from '@/components/studio/studio-view';
import { buildText } from '@/lib/jd-helpers';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

export const dynamic = 'force-dynamic';

export default async function JDStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({
    where: { id },
    include: { template: true },
  });

  if (!jd) notFound();

  const sections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) || DEFAULT_TEMPLATE_SECTIONS;
  const data = (jd.data as Record<string, string>) || {};
  const initialText = buildText(data, sections);
  const jdTitle = data.jobTitle || jd.orgUnit || 'Untitled JD';

  return (
    <div className="flex flex-col h-full">
      {/* Back nav */}
      <div
        style={{ background: '#141410', borderBottom: '1px solid rgba(138,117,96,0.25)' }}
        className="px-6 py-3 flex items-center gap-4 shrink-0"
      >
        <Link
          href={`/jd/${id}`}
          style={{ color: '#8A7560' }}
          className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
        >
          ← Back to editor
        </Link>
        <span style={{ color: 'rgba(246,244,239,0.3)' }} className="text-xs">
          /
        </span>
        <span style={{ color: '#F6F4EF' }} className="text-sm font-medium truncate">
          {jdTitle}
        </span>
        <span
          style={{
            background: 'rgba(138,117,96,0.15)',
            color: '#8A7560',
            border: '1px solid rgba(138,117,96,0.3)',
          }}
          className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full tracking-widest uppercase"
        >
          JD Studio
        </span>
      </div>

      {/* Studio view — fills remaining height */}
      <div className="flex-1 overflow-y-auto">
        <StudioView initialText={initialText} jdId={id} jdTitle={jdTitle} />
      </div>
    </div>
  );
}
