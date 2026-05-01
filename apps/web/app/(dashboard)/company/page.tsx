'use client';

/**
 * Company Profile — split into six tabs to avoid a 50-field monster form.
 *
 * Tabs:
 *  1. Company Identity
 *  2. Project Scope
 *  3. Users & Access
 *  4. Job Architecture Setup
 *  5. Data Sources
 *  6. Compliance & Reporting
 *
 * Top of the page shows an Overview bar with per-section completion %.
 *
 * Persistence note (honest):
 *   The current backend doesn't yet have a Company Profile model. State is
 *   persisted to localStorage as a v1 placeholder so reloads don't wipe it.
 *   Schema + API migration is the next session's job.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type CompanySize = 'micro' | 'small' | 'medium' | 'large';
type PlatformRole =
  | 'workspace_owner'
  | 'platform_admin'
  | 'methodology_owner'
  | 'core_user'
  | 'reviewer'
  | 'viewer'
  | 'external_consultant';
type Permission = 'admin' | 'edit' | 'review' | 'view' | 'export';
type UserStatus = 'active' | 'invited' | 'disabled';
type SourceStatus = 'not_available' | 'available' | 'uploaded' | 'reviewed' | 'approved';

interface PlatformUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  platformRole: PlatformRole;
  businessRole: string;
  permission: Permission;
  countriesAssigned: string;
  notificationPref: 'email' | 'none' | 'weekly';
  backupContact: string;
  status: UserStatus;
  accessExpiry: string; // ISO date
}

interface Identity {
  legalName: string;
  displayName: string;
  countryHq: string;
  countriesInScope: string;
  industry: string;
  size: CompanySize;
  totalFte: string;
  jdsInScope: string;
  mainLanguage: string;
  defaultCurrency: string;
  timezone: string;
}

interface ProjectScope {
  projectName: string;
  projectOwner: string;
  startDate: string;
  targetCompletion: string;
  countriesInScope: string;
  legalEntities: string;
  businessUnits: string;
  employeeGroups: string[];
  exclusions: string;
  estJdsInScope: string;
  estFteInScope: string;
}

interface JobArchSetup {
  currentGradingSystem: 'internal' | 'hay' | 'mercer_ipe' | 'wtw' | 'custom' | 'none';
  rolesPreviouslyEvaluated: boolean;
  lastEvaluationDate: string;
  hasGradeStructure: boolean | null;
  hasJobFamilies: boolean | null;
  hasCareerLevels: boolean | null;
  hasSalaryBands: boolean | null;
  hasOrgStructure: boolean | null;
  hasProcessDocs: boolean | null;
  hasInternalRegulations: boolean | null;
  collectiveAgreements: 'yes' | 'no' | 'unknown';
  worksCouncilReviewRequired: 'yes' | 'no' | 'unknown';
}

interface DataSourceItem {
  key: string;
  label: string;
  status: SourceStatus;
}

interface Compliance {
  mainObjective: 'euptd' | 'pay_equity' | 'restructuring' | 'new_pay_system' | 'audit';
  reportLanguage: string;
  reportAudience: string[];
  exportFormats: string[];
  confidentiality: 'internal' | 'confidential' | 'restricted';
  auditTrailRequired: boolean;
  humanApprovalRequired: boolean;
  dataRetentionMonths: string;
  aiDisclosureText: string;
}

interface CompanyProfile {
  identity: Identity;
  project: ProjectScope;
  users: PlatformUser[];
  jobArch: JobArchSetup;
  dataSources: DataSourceItem[];
  compliance: Compliance;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_DATA_SOURCES: DataSourceItem[] = [
  { key: 'jds',                label: 'Job descriptions',              status: 'not_available' },
  { key: 'job_ads',             label: 'Job advertisements',           status: 'not_available' },
  { key: 'org_charts',          label: 'Org charts',                   status: 'not_available' },
  { key: 'process_maps',        label: 'Process maps',                 status: 'not_available' },
  { key: 'salary_bands',        label: 'Salary bands',                 status: 'not_available' },
  { key: 'family_framework',    label: 'Job family framework',         status: 'not_available' },
  { key: 'existing_grades',     label: 'Existing grades',              status: 'not_available' },
  { key: 'internal_regs',       label: 'Internal policies/regulations',status: 'not_available' },
  { key: 'collective',          label: 'Collective agreements',        status: 'not_available' },
  { key: 'performance',         label: 'Performance framework',        status: 'not_available' },
  { key: 'competency',          label: 'Competency model',             status: 'not_available' },
  { key: 'reporting_lines',     label: 'Reporting lines',              status: 'not_available' },
  { key: 'fte_data',            label: 'FTE data',                     status: 'not_available' },
  { key: 'finance_ownership',   label: 'Finance/process ownership',    status: 'not_available' },
];

const EMPTY_PROFILE: CompanyProfile = {
  identity: {
    legalName: '', displayName: '', countryHq: 'PL', countriesInScope: '',
    industry: '', size: 'medium', totalFte: '', jdsInScope: '',
    mainLanguage: 'English', defaultCurrency: 'EUR', timezone: 'Europe/Warsaw',
  },
  project: {
    projectName: '', projectOwner: '', startDate: '', targetCompletion: '',
    countriesInScope: '', legalEntities: '', businessUnits: '',
    employeeGroups: [], exclusions: '', estJdsInScope: '', estFteInScope: '',
  },
  users: [],
  jobArch: {
    currentGradingSystem: 'none',
    rolesPreviouslyEvaluated: false,
    lastEvaluationDate: '',
    hasGradeStructure: null, hasJobFamilies: null, hasCareerLevels: null,
    hasSalaryBands: null, hasOrgStructure: null, hasProcessDocs: null,
    hasInternalRegulations: null,
    collectiveAgreements: 'unknown',
    worksCouncilReviewRequired: 'unknown',
  },
  dataSources: DEFAULT_DATA_SOURCES,
  compliance: {
    mainObjective: 'euptd',
    reportLanguage: 'English',
    reportAudience: [],
    exportFormats: ['PDF', 'Word'],
    confidentiality: 'confidential',
    auditTrailRequired: true,
    humanApprovalRequired: true,
    dataRetentionMonths: '36',
    aiDisclosureText: 'AI assistance was used to draft, validate, and summarise content. All material decisions were reviewed and approved by humans. AI did not assign final job evaluation scores.',
  },
};

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'identity',   label: 'Company Identity' },
  { id: 'project',    label: 'Project Scope' },
  { id: 'users',      label: 'Users & Access' },
  { id: 'jobarch',    label: 'Job Architecture' },
  { id: 'sources',    label: 'Data Sources' },
  { id: 'compliance', label: 'Compliance & Reporting' },
] as const;
type TabId = typeof TABS[number]['id'];

const SIZES: { value: CompanySize; label: string }[] = [
  { value: 'micro',  label: 'Micro (<10)' },
  { value: 'small',  label: 'Small (10–49)' },
  { value: 'medium', label: 'Medium (50–249)' },
  { value: 'large',  label: 'Large (250+)' },
];

const PLATFORM_ROLES: { value: PlatformRole; label: string; desc: string }[] = [
  { value: 'workspace_owner',     label: 'Workspace Owner',     desc: 'Billing, exports, users, settings' },
  { value: 'platform_admin',      label: 'Platform Admin',      desc: 'Invites, access, project settings' },
  { value: 'methodology_owner',   label: 'Methodology Owner',   desc: 'Evaluation logic, weights, grades' },
  { value: 'core_user',           label: 'Core User',           desc: 'Active HR/Reward operator' },
  { value: 'reviewer',            label: 'Reviewer / Approver', desc: 'Comment, approve, request changes' },
  { value: 'viewer',              label: 'Viewer',              desc: 'Read-only' },
  { value: 'external_consultant', label: 'External Consultant', desc: 'Limited, time-bound access' },
];

const EMPLOYEE_GROUPS = ['Employees', 'Managers', 'Executives', 'Blue collar', 'White collar', 'Apprentices'];

const SOURCE_STATUS_PILL: Record<SourceStatus, string> = {
  not_available: 'bg-gray-100 text-gray-600',
  available:     'bg-amber-100 text-amber-700',
  uploaded:      'bg-blue-100 text-blue-700',
  reviewed:      'bg-indigo-100 text-indigo-700',
  approved:      'bg-emerald-100 text-emerald-700',
};

const STORAGE_KEY = 'companyProfile:v1';

// ─── Completion calculation ────────────────────────────────────────────────

function pctIdentity(i: Identity): number {
  const fields = [i.legalName, i.countryHq, i.countriesInScope, i.industry, i.totalFte, i.jdsInScope, i.mainLanguage, i.defaultCurrency, i.timezone];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}
function pctProject(p: ProjectScope): number {
  const fields: (string | string[])[] = [p.projectName, p.projectOwner, p.startDate, p.targetCompletion, p.countriesInScope, p.legalEntities, p.businessUnits, p.employeeGroups, p.estJdsInScope, p.estFteInScope];
  return Math.round((fields.filter((v) => Array.isArray(v) ? v.length > 0 : !!v).length / fields.length) * 100);
}
function pctUsers(u: PlatformUser[]): number {
  if (u.length === 0) return 0;
  const ok = u.filter((x) => x.firstName && x.lastName && x.email && x.platformRole && x.permission).length;
  return Math.round((ok / u.length) * 100);
}
function pctJobArch(j: JobArchSetup): number {
  const decided = [
    j.currentGradingSystem !== 'none',
    j.hasGradeStructure !== null,
    j.hasJobFamilies !== null,
    j.hasCareerLevels !== null,
    j.hasSalaryBands !== null,
    j.hasOrgStructure !== null,
    j.hasProcessDocs !== null,
    j.hasInternalRegulations !== null,
    j.collectiveAgreements !== 'unknown',
    j.worksCouncilReviewRequired !== 'unknown',
  ];
  return Math.round((decided.filter(Boolean).length / decided.length) * 100);
}
function pctSources(s: DataSourceItem[]): number {
  const decided = s.filter((x) => x.status !== 'not_available').length;
  return Math.round((decided / s.length) * 100);
}
function pctCompliance(c: Compliance): number {
  const fields: (string | string[] | boolean | number)[] = [c.mainObjective, c.reportLanguage, c.reportAudience.length > 0, c.exportFormats.length > 0, c.confidentiality, c.dataRetentionMonths, c.aiDisclosureText];
  return Math.round((fields.filter((v) => Array.isArray(v) ? v.length > 0 : !!v).length / fields.length) * 100);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge — pick up any keys we've added since last save
        setProfile({
          ...EMPTY_PROFILE,
          ...parsed,
          identity: { ...EMPTY_PROFILE.identity, ...(parsed.identity ?? {}) },
          project: { ...EMPTY_PROFILE.project, ...(parsed.project ?? {}) },
          jobArch: { ...EMPTY_PROFILE.jobArch, ...(parsed.jobArch ?? {}) },
          compliance: { ...EMPTY_PROFILE.compliance, ...(parsed.compliance ?? {}) },
          users: Array.isArray(parsed.users) ? parsed.users : [],
          dataSources: Array.isArray(parsed.dataSources) && parsed.dataSources.length === DEFAULT_DATA_SOURCES.length
            ? parsed.dataSources
            : DEFAULT_DATA_SOURCES,
        });
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const completion = useMemo(() => ({
    identity:   pctIdentity(profile.identity),
    project:    pctProject(profile.project),
    users:      pctUsers(profile.users),
    jobarch:    pctJobArch(profile.jobArch),
    sources:    pctSources(profile.dataSources),
    compliance: pctCompliance(profile.compliance),
  }), [profile]);

  const overall = Math.round(
    (completion.identity + completion.project + completion.users + completion.jobarch + completion.sources + completion.compliance) / 6,
  );

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updateIdentity = (patch: Partial<Identity>) => setProfile((p) => ({ ...p, identity: { ...p.identity, ...patch } }));
  const updateProject = (patch: Partial<ProjectScope>) => setProfile((p) => ({ ...p, project: { ...p.project, ...patch } }));
  const updateJobArch = (patch: Partial<JobArchSetup>) => setProfile((p) => ({ ...p, jobArch: { ...p.jobArch, ...patch } }));
  const updateCompliance = (patch: Partial<Compliance>) => setProfile((p) => ({ ...p, compliance: { ...p.compliance, ...patch } }));
  const updateUsers = (users: PlatformUser[]) => setProfile((p) => ({ ...p, users }));
  const updateSources = (dataSources: DataSourceItem[]) => setProfile((p) => ({ ...p, dataSources }));

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1080px]">
        {/* Header + overview */}
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text-primary">Company Profile</h1>
          <p className="mt-1 text-[13px] leading-normal text-text-secondary">
            Calibrates EIGE pathway, country overlay, SWP hypotheses, Axiomera signals — and seeds report metadata.
            Backend persistence is queued for the next iteration; values are stored locally for now.
          </p>

          <div className="mt-5 rounded-lg border border-border-default bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Overall completion</div>
              <div className="font-display text-lg font-semibold text-text-primary tabular-nums">{overall}%</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-page">
              <div className="h-full bg-brand-gold transition-[width] duration-300" style={{ width: `${overall}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
              {TABS.map((t) => {
                const pct = completion[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-left transition-colors',
                      activeTab === t.id ? 'border-brand-gold bg-brand-gold-lighter' : 'border-border-default bg-white hover:border-brand-gold/50',
                    )}
                  >
                    <div className="text-[10px] font-medium leading-tight text-text-secondary">{t.label}</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-display text-sm font-semibold tabular-nums text-text-primary">{pct}%</span>
                      {t.id === 'users' && <span className="text-[9px] text-text-muted">({profile.users.length})</span>}
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-page">
                      <div className={cn('h-full transition-[width]', pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-stone-400')} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-3 flex border-b border-border-default">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-[12px] font-medium transition-colors',
                activeTab === t.id ? 'border-brand-gold text-brand-gold' : 'border-transparent text-text-muted hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="rounded-lg border border-border-default bg-white p-5">
          {!hydrated && <div className="text-[12px] text-text-muted">Loading…</div>}
          {hydrated && activeTab === 'identity'   && <IdentityTab v={profile.identity} onChange={updateIdentity} />}
          {hydrated && activeTab === 'project'    && <ProjectTab v={profile.project} onChange={updateProject} />}
          {hydrated && activeTab === 'users'      && <UsersTab v={profile.users} onChange={updateUsers} />}
          {hydrated && activeTab === 'jobarch'    && <JobArchTab v={profile.jobArch} onChange={updateJobArch} />}
          {hydrated && activeTab === 'sources'    && <SourcesTab v={profile.dataSources} onChange={updateSources} />}
          {hydrated && activeTab === 'compliance' && <ComplianceTab v={profile.compliance} onChange={updateCompliance} />}
        </div>

        {/* Save bar */}
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-white hover:bg-brand-gold/90">
            Save Company Profile
          </button>
          {saved && <span className="text-xs font-medium text-success">Saved locally · backend persistence is the next step</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable form atoms ────────────────────────────────────────────────────

const inputCls = 'w-full rounded-md border border-border-default bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-brand-gold';

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-semibold text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[10px] text-text-muted">{hint}</div>}
    </div>
  );
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-lg border border-border-default bg-surface-page p-4">
      <h3 className="mb-1 font-display text-[14px] font-semibold text-text-primary">{title}</h3>
      {hint && <p className="mb-3 text-[11px] text-text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function Chips<T extends string>({ value, options, onToggle }: { value: T[]; options: readonly T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
              active ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold' : 'border-border-default bg-white text-text-secondary hover:border-brand-gold/50',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab: Identity ──────────────────────────────────────────────────────────

function IdentityTab({ v, onChange }: { v: Identity; onChange: (p: Partial<Identity>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Legal & branding" hint="Both names appear on reports — useful when legal entity differs from brand.">
        <Field label="Legal company name" required><input className={inputCls} value={v.legalName} onChange={(e) => onChange({ legalName: e.target.value })} placeholder="e.g. EUPTD Enterprises Sp. z o.o." /></Field>
        <Field label="Display / group name"><input className={inputCls} value={v.displayName} onChange={(e) => onChange({ displayName: e.target.value })} placeholder="e.g. EUPTD Group" /></Field>
        <Field label="Industry / sector"><input className={inputCls} value={v.industry} onChange={(e) => onChange({ industry: e.target.value })} placeholder="e.g. Logistics & Supply Chain" /></Field>
      </Card>

      <Card title="Geography">
        <Field label="Country (HQ)" required><input className={inputCls} value={v.countryHq} onChange={(e) => onChange({ countryHq: e.target.value })} placeholder="PL / DE / CZ…" /></Field>
        <Field label="Countries in scope" hint="Comma-separated ISO codes — e.g. PL, CZ, SK, RO, ES"><input className={inputCls} value={v.countriesInScope} onChange={(e) => onChange({ countriesInScope: e.target.value })} placeholder="PL, CZ, SK, RO" /></Field>
        <Field label="Time zone"><input className={inputCls} value={v.timezone} onChange={(e) => onChange({ timezone: e.target.value })} placeholder="Europe/Warsaw" /></Field>
      </Card>

      <Card title="Size & scale" hint="Drives EIGE pathway selection.">
        <Field label="Organisation size">
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => onChange({ size: value })}
                className={cn('rounded-md border px-3 py-1.5 text-[11px] transition-colors', v.size === value ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold' : 'border-border-default bg-white')}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Total FTE"><input className={inputCls} value={v.totalFte} onChange={(e) => onChange({ totalFte: e.target.value })} placeholder="e.g. 850" /></Field>
        <Field label="Number of JDs / job roles in scope" hint="More useful than FTE for planning JD work."><input className={inputCls} value={v.jdsInScope} onChange={(e) => onChange({ jdsInScope: e.target.value })} placeholder="e.g. 220" /></Field>
      </Card>

      <Card title="Locale & money">
        <Field label="Main language of documentation"><input className={inputCls} value={v.mainLanguage} onChange={(e) => onChange({ mainLanguage: e.target.value })} placeholder="English" /></Field>
        <Field label="Default currency"><input className={inputCls} value={v.defaultCurrency} onChange={(e) => onChange({ defaultCurrency: e.target.value })} placeholder="EUR / PLN / USD" /></Field>
      </Card>
    </div>
  );
}

// ─── Tab: Project ───────────────────────────────────────────────────────────

function ProjectTab({ v, onChange }: { v: ProjectScope; onChange: (p: Partial<ProjectScope>) => void }) {
  const toggleGroup = (g: string) => {
    onChange({ employeeGroups: v.employeeGroups.includes(g) ? v.employeeGroups.filter((x) => x !== g) : [...v.employeeGroups, g] });
  };
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Project basics">
        <Field label="Project name" required><input className={inputCls} value={v.projectName} onChange={(e) => onChange({ projectName: e.target.value })} placeholder="EUPTD Readiness 2026" /></Field>
        <Field label="Project owner"><input className={inputCls} value={v.projectOwner} onChange={(e) => onChange({ projectOwner: e.target.value })} placeholder="Anna Kowalska, CHRO" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={v.startDate} onChange={(e) => onChange({ startDate: e.target.value })} /></Field>
          <Field label="Target completion"><input type="date" className={inputCls} value={v.targetCompletion} onChange={(e) => onChange({ targetCompletion: e.target.value })} /></Field>
        </div>
      </Card>

      <Card title="Geographic + entity scope">
        <Field label="Countries in scope" hint="Independent of HQ — a Polish company may run a project covering several countries."><input className={inputCls} value={v.countriesInScope} onChange={(e) => onChange({ countriesInScope: e.target.value })} placeholder="PL, CZ, SK, RO, ES" /></Field>
        <Field label="Legal entities in scope"><textarea className={inputCls} rows={2} value={v.legalEntities} onChange={(e) => onChange({ legalEntities: e.target.value })} placeholder="EUPTD PL Sp. z o.o.; EUPTD CZ s.r.o.; …" /></Field>
        <Field label="Business units in scope"><input className={inputCls} value={v.businessUnits} onChange={(e) => onChange({ businessUnits: e.target.value })} placeholder="Retail, Logistics, HQ, Shared Services" /></Field>
      </Card>

      <Card title="People in scope">
        <Field label="Employee groups">
          <Chips value={v.employeeGroups} options={EMPLOYEE_GROUPS} onToggle={toggleGroup} />
        </Field>
        <Field label="Exclusions" hint="Contractors, board, temporary workers, etc."><textarea className={inputCls} rows={2} value={v.exclusions} onChange={(e) => onChange({ exclusions: e.target.value })} placeholder="Contractors; board members; temporary workforce" /></Field>
      </Card>

      <Card title="Volume estimate">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated JDs in scope"><input className={inputCls} value={v.estJdsInScope} onChange={(e) => onChange({ estJdsInScope: e.target.value })} placeholder="220" /></Field>
          <Field label="Estimated FTE in scope"><input className={inputCls} value={v.estFteInScope} onChange={(e) => onChange({ estFteInScope: e.target.value })} placeholder="850" /></Field>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Users & Access ────────────────────────────────────────────────────

function UsersTab({ v, onChange }: { v: PlatformUser[]; onChange: (u: PlatformUser[]) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  const blank = (): PlatformUser => ({
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    firstName: '', lastName: '', email: '', phone: '',
    platformRole: 'core_user', businessRole: '', permission: 'edit',
    countriesAssigned: '', notificationPref: 'email', backupContact: '',
    status: 'invited', accessExpiry: '',
  });

  const add = () => {
    const u = blank();
    onChange([...v, u]);
    setOpen(u.id);
  };
  const remove = (id: string) => onChange(v.filter((u) => u.id !== id));
  const update = (id: string, patch: Partial<PlatformUser>) => onChange(v.map((u) => u.id === id ? { ...u, ...patch } : u));

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[14px] font-semibold text-text-primary">Platform Users & Responsibilities</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">Roles supported: workspace owner, platform admin, methodology owner, core user, reviewer, viewer, external consultant. Set an access expiry for external consultants.</p>
        </div>
        <button onClick={add} className="shrink-0 rounded-md bg-brand-gold px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-gold/90">+ Add user</button>
      </div>

      {v.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default bg-surface-page p-6 text-center">
          <div className="text-[12px] text-text-secondary">No users yet. Add at least a Workspace Owner and a Methodology Owner.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {v.map((u) => {
            const role = PLATFORM_ROLES.find((r) => r.value === u.platformRole);
            const expanded = open === u.id;
            const isExpiring = u.accessExpiry && new Date(u.accessExpiry) < new Date(Date.now() + 30 * 86400 * 1000);
            return (
              <li key={u.id} className="rounded-lg border border-border-default bg-white">
                <button onClick={() => setOpen(expanded ? null : u.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', u.status === 'active' ? 'bg-emerald-500' : u.status === 'invited' ? 'bg-amber-500' : 'bg-gray-400')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-text-primary">{(u.firstName || u.lastName) ? `${u.firstName} ${u.lastName}`.trim() : '(unnamed)'}</span>
                      <span className="text-[10px] text-text-muted">{u.email || '(no email)'}</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {role?.label || u.platformRole} · {u.permission} · {u.countriesAssigned || 'all countries'}
                    </div>
                  </div>
                  {isExpiring && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">Expiring</span>}
                  <span className="text-[10px] text-text-muted">{expanded ? '▴' : '▾'}</span>
                </button>
                {expanded && (
                  <div className="border-t border-border-default p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label="First name" required><input className={inputCls} value={u.firstName} onChange={(e) => update(u.id, { firstName: e.target.value })} /></Field>
                      <Field label="Last name" required><input className={inputCls} value={u.lastName} onChange={(e) => update(u.id, { lastName: e.target.value })} /></Field>
                      <Field label="Email" required><input className={inputCls} type="email" value={u.email} onChange={(e) => update(u.id, { email: e.target.value })} /></Field>
                      <Field label="Phone (optional)"><input className={inputCls} value={u.phone} onChange={(e) => update(u.id, { phone: e.target.value })} /></Field>
                      <Field label="Platform role" required>
                        <select className={inputCls} value={u.platformRole} onChange={(e) => update(u.id, { platformRole: e.target.value as PlatformRole })}>
                          {PLATFORM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                        </select>
                      </Field>
                      <Field label="Business role" hint="Reward Lead, HRBP, Legal, Finance, Works Council…"><input className={inputCls} value={u.businessRole} onChange={(e) => update(u.id, { businessRole: e.target.value })} /></Field>
                      <Field label="Permission" required>
                        <select className={inputCls} value={u.permission} onChange={(e) => update(u.id, { permission: e.target.value as Permission })}>
                          <option value="admin">Admin</option><option value="edit">Edit</option><option value="review">Review</option><option value="view">View</option><option value="export">Export</option>
                        </select>
                      </Field>
                      <Field label="Countries / entities assigned"><input className={inputCls} value={u.countriesAssigned} onChange={(e) => update(u.id, { countriesAssigned: e.target.value })} placeholder="PL, CZ" /></Field>
                      <Field label="Notification preference">
                        <select className={inputCls} value={u.notificationPref} onChange={(e) => update(u.id, { notificationPref: e.target.value as PlatformUser['notificationPref'] })}>
                          <option value="email">Email</option><option value="weekly">Weekly summary</option><option value="none">None</option>
                        </select>
                      </Field>
                      <Field label="Backup contact"><input className={inputCls} value={u.backupContact} onChange={(e) => update(u.id, { backupContact: e.target.value })} placeholder="Name or email" /></Field>
                      <Field label="Access expiry" hint="Required for external consultants — leave blank for permanent access."><input type="date" className={inputCls} value={u.accessExpiry} onChange={(e) => update(u.id, { accessExpiry: e.target.value })} /></Field>
                      <Field label="Status">
                        <select className={inputCls} value={u.status} onChange={(e) => update(u.id, { status: e.target.value as UserStatus })}>
                          <option value="active">Active</option><option value="invited">Invited</option><option value="disabled">Disabled</option>
                        </select>
                      </Field>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => remove(u.id)} className="rounded-md border border-danger/30 bg-white px-3 py-1.5 text-[11px] font-medium text-danger hover:bg-danger/5">Remove user</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Tab: Job Architecture Setup ───────────────────────────────────────────

function JobArchTab({ v, onChange }: { v: JobArchSetup; onChange: (p: Partial<JobArchSetup>) => void }) {
  const toggles: { key: keyof JobArchSetup; label: string }[] = [
    { key: 'hasGradeStructure',     label: 'Grade / band structure available?' },
    { key: 'hasJobFamilies',        label: 'Job families available?' },
    { key: 'hasCareerLevels',       label: 'Career levels available?' },
    { key: 'hasSalaryBands',        label: 'Salary bands available?' },
    { key: 'hasOrgStructure',       label: 'Org structure available?' },
    { key: 'hasProcessDocs',        label: 'Process documents available?' },
    { key: 'hasInternalRegulations',label: 'Internal regulations available?' },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Current grading method" hint="If none, the tool will recommend building architecture first.">
        <Field label="Current grading system">
          <select className={inputCls} value={v.currentGradingSystem} onChange={(e) => onChange({ currentGradingSystem: e.target.value as JobArchSetup['currentGradingSystem'] })}>
            <option value="none">None</option>
            <option value="internal">Internal grades</option>
            <option value="hay">Hay / Korn Ferry</option>
            <option value="mercer_ipe">Mercer IPE</option>
            <option value="wtw">Willis Towers Watson</option>
            <option value="custom">Custom / other</option>
          </select>
        </Field>
        <Field label="Roles previously evaluated?">
          <label className="inline-flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={v.rolesPreviouslyEvaluated} onChange={(e) => onChange({ rolesPreviouslyEvaluated: e.target.checked })} />
            Yes
          </label>
        </Field>
        {v.rolesPreviouslyEvaluated && (
          <Field label="Last evaluation date"><input type="date" className={inputCls} value={v.lastEvaluationDate} onChange={(e) => onChange({ lastEvaluationDate: e.target.value })} /></Field>
        )}
      </Card>

      <Card title="Existing artefacts" hint="These flags shape Krystyna's recommendations and the Command Center task list.">
        {toggles.map(({ key, label }) => (
          <div key={key} className="mb-2 flex items-center justify-between gap-3 rounded border border-border-default bg-white px-3 py-1.5">
            <span className="text-[11px] text-text-primary">{label}</span>
            <div className="flex gap-1">
              {([['Yes', true], ['No', false], ['?', null]] as const).map(([lab, val]) => (
                <button key={lab} type="button" onClick={() => onChange({ [key]: val } as Partial<JobArchSetup>)}
                  className={cn('rounded-md border px-2 py-0.5 text-[10px] font-medium', v[key] === val ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold' : 'border-border-default bg-white text-text-muted')}
                >{lab}</button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card title="Legal & social dialogue">
        <Field label="Collective agreements present?">
          <select className={inputCls} value={v.collectiveAgreements} onChange={(e) => onChange({ collectiveAgreements: e.target.value as JobArchSetup['collectiveAgreements'] })}>
            <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
        <Field label="Works council / legal review required?">
          <select className={inputCls} value={v.worksCouncilReviewRequired} onChange={(e) => onChange({ worksCouncilReviewRequired: e.target.value as JobArchSetup['worksCouncilReviewRequired'] })}>
            <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
      </Card>
    </div>
  );
}

// ─── Tab: Data Sources ─────────────────────────────────────────────────────

function SourcesTab({ v, onChange }: { v: DataSourceItem[]; onChange: (s: DataSourceItem[]) => void }) {
  const set = (key: string, status: SourceStatus) => onChange(v.map((x) => x.key === key ? { ...x, status } : x));
  return (
    <div>
      <p className="mb-3 text-[11px] text-text-muted">For each source: indicate availability so the platform can pace the work and the Command Center can generate &quot;upload missing X&quot; tasks.</p>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {v.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 rounded-md border border-border-default bg-white px-3 py-2">
            <span className="text-[12px] text-text-primary">{s.label}</span>
            <select
              className={cn('rounded-md px-2 py-1 text-[10px] font-medium outline-none', SOURCE_STATUS_PILL[s.status])}
              value={s.status}
              onChange={(e) => set(s.key, e.target.value as SourceStatus)}
            >
              <option value="not_available">Not available</option>
              <option value="available">Available</option>
              <option value="uploaded">Uploaded</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Tab: Compliance & Reporting ───────────────────────────────────────────

function ComplianceTab({ v, onChange }: { v: Compliance; onChange: (p: Partial<Compliance>) => void }) {
  const toggleArr = <T extends string>(arr: T[], item: T): T[] => arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Compliance objective">
        <Field label="Main objective" required>
          <select className={inputCls} value={v.mainObjective} onChange={(e) => onChange({ mainObjective: e.target.value as Compliance['mainObjective'] })}>
            <option value="euptd">EU Pay Transparency Directive</option>
            <option value="pay_equity">Pay equity audit</option>
            <option value="restructuring">Restructuring</option>
            <option value="new_pay_system">New pay system</option>
            <option value="audit">General audit</option>
          </select>
        </Field>
        <Field label="Confidentiality level">
          <div className="flex gap-1">
            {(['internal', 'confidential', 'restricted'] as const).map((c) => (
              <button key={c} type="button" onClick={() => onChange({ confidentiality: c })}
                className={cn('rounded-md border px-3 py-1 text-[11px] capitalize', v.confidentiality === c ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold' : 'border-border-default bg-white')}
              >{c}</button>
            ))}
          </div>
        </Field>
        <Field label="Data retention period (months)"><input className={inputCls} value={v.dataRetentionMonths} onChange={(e) => onChange({ dataRetentionMonths: e.target.value })} placeholder="36" /></Field>
      </Card>

      <Card title="Reporting">
        <Field label="Report language"><input className={inputCls} value={v.reportLanguage} onChange={(e) => onChange({ reportLanguage: e.target.value })} placeholder="English / Polski / …" /></Field>
        <Field label="Report audience">
          <Chips
            value={v.reportAudience}
            options={['HR', 'Legal', 'Board', 'Works Council', 'Managers', 'Finance']}
            onToggle={(opt) => onChange({ reportAudience: toggleArr(v.reportAudience, opt) })}
          />
        </Field>
        <Field label="Preferred export formats">
          <Chips
            value={v.exportFormats}
            options={['PDF', 'Word', 'Excel', 'PowerPoint', 'Notion', 'Markdown']}
            onToggle={(opt) => onChange({ exportFormats: toggleArr(v.exportFormats, opt) })}
          />
        </Field>
      </Card>

      <Card title="Governance defaults">
        <label className="mb-2 flex items-start gap-2 text-[12px]">
          <input type="checkbox" checked={v.auditTrailRequired} onChange={(e) => onChange({ auditTrailRequired: e.target.checked })} className="mt-1" />
          <span>Audit trail required for all material changes (recommended)</span>
        </label>
        <label className="flex items-start gap-2 text-[12px]">
          <input type="checkbox" checked={v.humanApprovalRequired} onChange={(e) => onChange({ humanApprovalRequired: e.target.checked })} className="mt-1" />
          <span>Human approval required before any final job evaluation is published (recommended)</span>
        </label>
      </Card>

      <Card title="AI usage disclosure" hint="Appended to final reports.">
        <Field label="Disclosure text">
          <textarea className={inputCls} rows={4} value={v.aiDisclosureText} onChange={(e) => onChange({ aiDisclosureText: e.target.value })} />
        </Field>
      </Card>
    </div>
  );
}
