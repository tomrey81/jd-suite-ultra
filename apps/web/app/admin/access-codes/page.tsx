import { db } from '@jd-suite/db';
import { CodesView } from './codes-view';

export const dynamic = 'force-dynamic';

export default async function AccessCodesPage() {
  const codes = await db.accessCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { uses: true } } },
  });

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Access codes</h1>
          <p>Rotatable invitation codes. Each registration consumes one and increments usesCount.</p>
        </div>
      </header>
      <CodesView initialCodes={codes.map((c) => ({
        id: c.id, code: c.code, label: c.label, maxUses: c.maxUses,
        usesCount: c.usesCount, expiresAt: c.expiresAt, active: c.active,
        createdAt: c.createdAt,
      }))} />
    </>
  );
}
