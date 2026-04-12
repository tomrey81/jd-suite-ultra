import { db } from '@jd-suite/db';
import { notFound } from 'next/navigation';
import { JDEditor } from '@/components/jd/jd-editor';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

export const dynamic = 'force-dynamic';

export default async function JDEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({
    where: { id },
    include: { template: true },
  });

  if (!jd) notFound();

  const templateSections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) || DEFAULT_TEMPLATE_SECTIONS;

  const initialData = (jd.data as Record<string, string>) || {};

  return (
    <JDEditor
      jdId={jd.id}
      initialData={initialData}
      templateSections={templateSections}
    />
  );
}
