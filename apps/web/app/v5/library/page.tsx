/**
 * P0e — Library hierarchy.
 *
 * Family + Function (orgUnit) + Level (architecture grade) view of every JD
 * in the user's organisations. Multi-facet filters, server-rendered.
 */

import Link from 'next/link';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LibraryFilters from './filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Library hierarchy — JD Suite v5' };

interface SP {
  family?: string;
  fn?: string;
  level?: string;
  status?: string;
  q?: string;
}

export default async function LibraryHierarchyPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id as string;

  // Restrict to orgs the user belongs to
  const memberships = await db.membership.findMany({
    where: { userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] p-6">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="font-display text-2xl font-semibold text-[#1A1A1A]">Library hierarchy</h1>
          <p className="mt-2 text-[12px] text-[#55524A]">
            You are not a member of any organisation yet — ask an admin to add you to one.
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const familyFilter = sp.family || '';
  const fnFilter = (sp.fn || '').toLowerCase();
  const levelFilter = sp.level || '';
  const statusFilter = sp.status || '';
  const q = (sp.q || '').toLowerCase();

  // Pull families + JDs in parallel.
  const [families, jds, slots] = await Promise.all([
    db.jobFamily.findMany({
      where: { orgId: { in: orgIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, orgId: true },
    }),
    db.jobDescription.findMany({
      where: {
        orgId: { in: orgIds },
        archivedAt: null,
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(q
          ? {
              OR: [
                { jobTitle: { contains: q, mode: 'insensitive' } },
                { jobCode: { contains: q, mode: 'insensitive' } },
                { orgUnit: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ jobTitle: 'asc' }],
      take: 1000,
      select: {
        id: true,
        jobTitle: true,
        jobCode: true,
        orgUnit: true,
        status: true,
        careerFamily: true,
        updatedAt: true,
        org: { select: { id: true, name: true } },
      },
    }),
    db.jobArchitectureSlot.findMany({
      where: { orgId: { in: orgIds } },
      select: { jdId: true, familyId: true, level: true },
    }),
  ]);

  // Index slot data per jd
  const slotByJd = new Map<string, { familyId: string; level: number }>();
  for (const s of slots) slotByJd.set(s.jdId, { familyId: s.familyId, level: s.level });
  const familyById = new Map(families.map((f) => [f.id, f]));

  // Apply family + level + function filters in JS (cheaper than parallel DB queries here)
  const visible = jds.filter((j) => {
    const slot = slotByJd.get(j.id);
    if (familyFilter) {
      if (!slot || slot.familyId !== familyFilter) {
        // Allow family filter to also match careerFamily (free-text)
        if (j.careerFamily?.toLowerCase() !== familyFilter.toLowerCase()) return false;
      }
    }
    if (levelFilter && (!slot || String(slot.level) !== levelFilter)) return false;
    if (fnFilter && !(j.orgUnit || '').toLowerCase().includes(fnFilter)) return false;
    return true;
  });

  // Compute facets for the filter rail
  const facetFamily = new Map<string, number>();
  const facetFn = new Map<string, number>();
  const facetLevel = new Map<number, number>();
  const facetStatus = new Map<string, number>();
  for (const j of jds) {
    const slot = slotByJd.get(j.id);
    if (slot) {
      facetFamily.set(slot.familyId, (facetFamily.get(slot.familyId) ?? 0) + 1);
      facetLevel.set(slot.level, (facetLevel.get(slot.level) ?? 0) + 1);
    } else if (j.careerFamily) {
      facetFamily.set(j.careerFamily, (facetFamily.get(j.careerFamily) ?? 0) + 1);
    }
    if (j.orgUnit) facetFn.set(j.orgUnit, (facetFn.get(j.orgUnit) ?? 0) + 1);
    facetStatus.set(j.status, (facetStatus.get(j.status) ?? 0) + 1);
  }

  // Group visible JDs by Family > Level for the matrix view
  const grouped = new Map<string, Map<number, typeof visible>>();
  for (const j of visible) {
    const slot = slotByJd.get(j.id);
    const fKey = slot?.familyId ?? j.careerFamily ?? '_unassigned';
    const lvl = slot?.level ?? 0;
    if (!grouped.has(fKey)) grouped.set(fKey, new Map());
    const lvlMap = grouped.get(fKey)!;
    if (!lvlMap.has(lvl)) lvlMap.set(lvl, []);
    lvlMap.get(lvl)!.push(j);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A7560]">
              JD Suite v5 · Phase 0e
            </div>
            <h1 className="font-display text-2xl font-semibold text-[#1A1A1A]">
              Library hierarchy
            </h1>
            <p className="mt-1 text-[12px] text-[#55524A]">
              {visible.length.toLocaleString()} of {jds.length.toLocaleString()} job descriptions ·{' '}
              {families.length} families · {orgIds.length} {orgIds.length === 1 ? 'organisation' : 'organisations'}
            </p>
          </div>
          <Link
            href="/v5"
            className="rounded border border-[#E0DBD4] bg-white px-3 py-1.5 text-[11px] text-[#1A1A1A]"
          >
            ← v5 home
          </Link>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Filter rail */}
          <LibraryFilters
            facets={{
              families: families.map((f) => ({
                id: f.id,
                name: f.name,
                color: f.color,
                count: facetFamily.get(f.id) ?? 0,
              })),
              functions: [...facetFn.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 25)
                .map(([name, count]) => ({ name, count })),
              levels: [...facetLevel.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([level, count]) => ({ level, count })),
              statuses: [...facetStatus.entries()].map(([status, count]) => ({ status, count })),
            }}
            current={{
              family: familyFilter,
              fn: sp.fn || '',
              level: levelFilter,
              status: statusFilter,
              q: sp.q || '',
            }}
          />

          {/* Matrix */}
          <div>
            {grouped.size === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E0DBD4] bg-white p-10 text-center text-[12px] text-[#55524A]">
                No JDs match these filters.
              </div>
            ) : (
              <div className="space-y-4">
                {[...grouped.entries()].map(([famKey, lvlMap]) => {
                  const fam = familyById.get(famKey);
                  const sortedLvls = [...lvlMap.entries()].sort((a, b) => a[0] - b[0]);
                  return (
                    <div
                      key={famKey}
                      className="rounded-lg border border-[#E0DBD4] bg-white p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: fam?.color ?? '#A39B8B' }}
                        />
                        <h2 className="font-display text-base font-semibold text-[#1A1A1A]">
                          {fam?.name ?? (famKey === '_unassigned' ? 'Unassigned to family' : famKey)}
                        </h2>
                        <span className="text-[10px] text-[#55524A]">
                          (
                          {sortedLvls.reduce((s, [, items]) => s + items.length, 0)} JDs)
                        </span>
                      </div>
                      <div className="space-y-3">
                        {sortedLvls.map(([lvl, items]) => (
                          <div key={lvl}>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">
                              Level {lvl || '—'}{' '}
                              <span className="text-[#55524A]">· {items.length}</span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {items.map((j) => (
                                <Link
                                  key={j.id}
                                  href={`/admin/jds/${j.id}`}
                                  className="rounded border border-[#F4ECDF] bg-[#FAF7F2] p-2.5 transition hover:border-[#8A7560]"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-[12px] text-[#1A1A1A] line-clamp-1">
                                      {j.jobTitle || '(untitled)'}
                                    </div>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        j.status === 'APPROVED'
                                          ? 'bg-[#1A1A1A] text-white'
                                          : 'bg-[#F4ECDF] text-[#55524A]'
                                      }`}
                                    >
                                      {j.status}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[10px] text-[#55524A]">
                                    {j.jobCode ? `${j.jobCode} · ` : ''}
                                    {j.orgUnit || '—'}
                                  </div>
                                  <div className="mt-0.5 text-[9px] text-[#8A7560]">
                                    {j.org?.name}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
