import { db } from '@jd-suite/db';
import { redirect } from 'next/navigation';
import { DEFAULT_TEMPLATE_SECTIONS, DEFAULT_TEMPLATE } from '@/lib/default-template';
import { buildJDEmpty } from '@/lib/jd-helpers';

export const dynamic = 'force-dynamic';

export default async function NewJDPage() {
  // TEMPORARY BYPASS — use first org and user
  const firstOrg = await db.organisation.findFirst();
  const firstUser = await db.user.findFirst();
  if (!firstOrg || !firstUser) redirect('/');

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

  const jd = await db.$transaction(async (tx) => {
    const created = await tx.jobDescription.create({
      data: {
        orgId: firstOrg.id,
        ownerId: firstUser.id,
        templateId: template!.id,
        data: emptyJd,
        jobTitle: '',
        status: 'DRAFT',
      },
    });

    await tx.jDVersion.create({
      data: {
        jdId: created.id,
        authorId: firstUser.id,
        authorType: 'USER',
        changeType: 'IMPORT',
        note: 'JD created from template',
      },
    });

    return created;
  });

  redirect(`/jd/${jd.id}`);
}
