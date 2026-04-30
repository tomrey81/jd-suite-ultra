import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { analyseBiasWithPacks } from '@/lib/bias/engine-with-packs';
import { lexiconVersion } from '@/lib/bias/loader';
import { POLICY_PACKS, type PackId } from '@/lib/bias/policy-packs';
import type { Language } from '@/lib/bias/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED: Language[] = ['en', 'pl'];
const VALID_PACKS = new Set<PackId>(POLICY_PACKS.map((p) => p.id));

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { text?: string; language?: string; packs?: string[] }
    | null;
  if (!body || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'Provide { text, language, packs? }' }, { status: 400 });
  }
  if (body.text.length > 60_000) {
    return NextResponse.json({ error: 'Text too large (max 60k chars)' }, { status: 413 });
  }
  const lang = (body.language || 'en').toLowerCase() as Language;
  if (!ALLOWED.includes(lang)) {
    return NextResponse.json(
      { error: `Unsupported language: ${lang}. Supported: ${ALLOWED.join(', ')}` },
      { status: 400 },
    );
  }
  const packs = Array.isArray(body.packs)
    ? body.packs.filter((p): p is PackId => VALID_PACKS.has(p as PackId))
    : [];

  const report = analyseBiasWithPacks(body.text, lang, packs);
  return NextResponse.json({
    ok: true,
    report,
    lexiconVersion: lexiconVersion(lang),
    packs: packs.map((id) => {
      const pack = POLICY_PACKS.find((p) => p.id === id);
      return { id, label: pack?.label, source: pack?.source };
    }),
  });
}
