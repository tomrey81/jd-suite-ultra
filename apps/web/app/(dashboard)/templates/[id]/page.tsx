import { notFound, redirect } from 'next/navigation';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { TemplateEditor } from '@/components/templates/template-editor';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateEditPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/templates');
  const { id } = await params;

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  const orgId = membership?.orgId ?? null;

  // Special case: /templates/new — start with default sections
  if (id === 'new') {
    return (
      <TemplateEditor
        mode="create"
        orgId={orgId}
        initial={{
          id: '',
          name: '',
          purpose: 'general',
          description: '',
          sections: DEFAULT_TEMPLATE_SECTIONS,
          isDefault: false,
          orgId,
        }}
      />
    );
  }

  const tpl = await db.template.findFirst({
    where: { id, OR: [{ orgId: orgId ?? undefined }, { orgId: null }] },
  });
  if (!tpl) notFound();

  const editable = tpl.orgId === orgId && orgId !== null;

  return (
    <TemplateEditor
      mode={editable ? 'edit' : 'view'}
      orgId={orgId}
      initial={{
        id: tpl.id,
        name: tpl.name,
        purpose: tpl.purpose,
        description: tpl.description,
        sections: tpl.sections as any,
        isDefault: tpl.isDefault,
        orgId: tpl.orgId,
      }}
    />
  );
}
