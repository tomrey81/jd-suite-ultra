import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { redirect, notFound } from 'next/navigation';
import { JDEditor } from '@/components/jd/jd-editor';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

export default async function JDEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orgId = (session as any).orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({
    where: { id, orgId },
    include: {
      template: true,
    },
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
