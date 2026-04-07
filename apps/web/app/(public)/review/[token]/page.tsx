import { db } from '@jd-suite/db';
import { notFound } from 'next/navigation';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import { GuestReviewView } from '@/components/guest/guest-review-view';
import type { TemplateSection } from '@jd-suite/types';

export default async function GuestReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const guestToken = await db.guestToken.findFirst({
    where: { token, revokedAt: null },
    include: {
      jd: {
        include: {
          template: true,
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!guestToken) notFound();

  // Check expiry
  if (new Date() > guestToken.expiresAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">⏰</div>
          <h1 className="mb-2 font-display text-xl font-bold text-text-primary">Link Expired</h1>
          <p className="text-sm text-text-secondary">
            This review link has expired. Contact the JD owner for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Mark as used
  if (!guestToken.usedAt) {
    await db.guestToken.update({ where: { id: guestToken.id }, data: { usedAt: new Date() } });
  }

  const jd = guestToken.jd;
  const sections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) || DEFAULT_TEMPLATE_SECTIONS;
  const data = (jd.data as Record<string, string>) || {};

  return (
    <GuestReviewView
      jdId={jd.id}
      token={token}
      data={data}
      sections={sections}
      jobTitle={jd.jobTitle}
      orgUnit={jd.orgUnit || ''}
      status={jd.status}
      canComment={guestToken.role === 'REVIEWER'}
      sharedBy={guestToken.createdBy.name || guestToken.createdBy.email}
      comments={jd.comments.map((c) => ({
        id: c.id,
        content: c.content,
        fieldId: c.fieldId,
        authorType: c.authorType,
        authorEmail: c.authorEmail,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
