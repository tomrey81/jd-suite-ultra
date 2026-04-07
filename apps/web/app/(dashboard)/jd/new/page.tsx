import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { redirect } from 'next/navigation';
import { DEFAULT_TEMPLATE_SECTIONS, DEFAULT_TEMPLATE } from '@/lib/default-template';
import { buildJDEmpty } from '@/lib/jd-helpers';

export default async function NewJDPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orgId = (session as any).orgId;
  if (!orgId) redirect('/');

  // Ensure the default template exists
  let template = await db.template.findFirst({
    where: { isDefault: true, orgId: null },
  });

  if (!template) {
    template = await db.template.create({
      data: {
        name: DEFAULT_TEMPLATE.name,
        purpose: DEFAULT_TEMPLATE.purpose,
        description: DEFAULT_TEMPLATE.description,
        sections: DEFAULT_TEMPLATE_SECTIONS as any,
        isDefault: true,
        orgId: null,
      },
    });
  }

  const sections = (template.sections as any[]) || DEFAULT_TEMPLATE_SECTIONS;
  const emptyJd = buildJDEmpty(sections);

  // Create the JD in the database
  const jd = await db.$transaction(async (tx) => {
    const created = await tx.jobDescription.create({
      data: {
        orgId,
        ownerId: session.user.id,
        templateId: template!.id,
        data: emptyJd,
        jobTitle: '',
        status: 'DRAFT',
      },
    });

    await tx.jDVersion.create({
      data: {
        jdId: created.id,
        authorId: session.user.id,
        authorType: 'USER',
        changeType: 'IMPORT',
        note: 'JD created from template',
      },
    });

    return created;
  });

  redirect(`/jd/${jd.id}`);
}
