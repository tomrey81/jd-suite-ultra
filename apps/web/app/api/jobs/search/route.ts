import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/jobs/search?country=pl&query=hr+manager&page=1
//
// Wraps the Adzuna API. Requires ADZUNA_APP_ID and ADZUNA_APP_KEY env
// vars. The user-facing page should show a "configure API key" hint
// when these are missing.
//
// Coverage: gb (UK), us (USA), de (Germany), pl (Poland), fr (France),
// au, br, ca, in, it, mx, nl, nz, pl, ru, sg, za.

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs';
const RESULTS_PER_PAGE = 30;

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_type?: string;
  category?: { tag?: string; label?: string };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return NextResponse.json({
      error: 'Adzuna API not configured.',
      hint: 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel env vars. Get free keys at https://developer.adzuna.com',
    }, { status: 503 });
  }

  const url = new URL(req.url);
  const country = (url.searchParams.get('country') || 'gb').toLowerCase();
  const query = (url.searchParams.get('query') || '').trim();
  const where = (url.searchParams.get('where') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const salaryMin = url.searchParams.get('salaryMin');
  const fullTime = url.searchParams.get('fullTime') === '1';

  if (!/^[a-z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(RESULTS_PER_PAGE),
    'content-type': 'application/json',
  });
  if (query) params.set('what', query);
  if (where) params.set('where', where);
  if (category) params.set('category', category);
  if (salaryMin) params.set('salary_min', salaryMin);
  if (fullTime) params.set('full_time', '1');

  const apiUrl = `${ADZUNA_BASE}/${country}/search/${page}?${params}`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json({
        error: `Adzuna API ${res.status}`,
        detail: txt.slice(0, 200),
      }, { status: 502 });
    }
    const data = await res.json();
    const results = (data.results || []) as AdzunaJob[];

    const jobs = results.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company?.display_name || '',
      location: j.location?.display_name || (j.location?.area?.slice(-2).join(', ') ?? ''),
      url: j.redirect_url,
      posted: j.created,
      salaryMin: j.salary_min ?? null,
      salaryMax: j.salary_max ?? null,
      salaryPredicted: j.salary_is_predicted === '1',
      contract: j.contract_type ?? null,
      category: j.category?.label ?? null,
      description: (j.description || '').slice(0, 500),
      source: 'adzuna',
      country,
    }));

    return NextResponse.json({
      ok: true,
      jobs,
      total: data.count ?? jobs.length,
      page,
      perPage: RESULTS_PER_PAGE,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Search failed' }, { status: 500 });
  }
}
