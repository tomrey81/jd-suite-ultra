// ── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = ['ADMIN', 'OWNER', 'MEMBER', 'GUEST'] as const;
export type Role = (typeof ROLES)[number];

// ── JD Status ────────────────────────────────────────────────────────────────
export const JD_STATUSES = ['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED'] as const;
export type JDStatus = (typeof JD_STATUSES)[number];

// ── Export Formats ───────────────────────────────────────────────────────────
export const EXPORT_FORMATS = ['TXT', 'MD', 'PDF', 'DOCX', 'JSON', 'XLSX'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// ── Template Purposes ────────────────────────────────────────────────────────
export const TEMPLATE_PURPOSES = [
  { id: 'general', label: 'General Purpose', desc: 'Covers all use cases' },
  { id: 'evaluation', label: 'Job Evaluation', desc: 'Optimised for Axiomera grading and pay equity' },
  { id: 'recruitment', label: 'Recruitment', desc: 'External job posting and candidate attraction' },
  { id: 'career', label: 'Career Paths', desc: 'Career development and progression frameworks' },
  { id: 'skills', label: 'Skills Mapping', desc: 'Competence models and capability frameworks' },
  { id: 'custom', label: 'Custom', desc: 'Define your own purpose' },
] as const;
export type TemplatePurpose = (typeof TEMPLATE_PURPOSES)[number]['id'];

// ── 16 Pay Equity Criteria ───────────────────────────────────────────────────
export const CRITERIA = [
  { id: 1, cat: 'Knowledge and Skills', col: '#2E7D88', name: 'Knowledge and Experience', max: 9 },
  { id: 2, cat: 'Knowledge and Skills', col: '#2E7D88', name: 'Finding Solutions', max: 7 },
  { id: 3, cat: 'Knowledge and Skills', col: '#2E7D88', name: 'Planning and Organisation', max: 6 },
  { id: 4, cat: 'Knowledge and Skills', col: '#2E7D88', name: 'Communication and Inclusion', max: 6 },
  { id: 5, cat: 'Knowledge and Skills', col: '#2E7D88', name: 'Practical Skills', max: 5 },
  { id: 6, cat: 'Effort', col: '#6B3FA0', name: 'Physical Effort', max: 5 },
  { id: 7, cat: 'Effort', col: '#6B3FA0', name: 'Mental Effort', max: 5 },
  { id: 8, cat: 'Effort', col: '#6B3FA0', name: 'Emotional Effort', max: 6 },
  { id: 9, cat: 'Effort', col: '#6B3FA0', name: 'Initiative and Independence', max: 8 },
  { id: 10, cat: 'Responsibility', col: '#C05A0A', name: 'Welfare of People Responsibility', max: 6 },
  { id: 11, cat: 'Responsibility', col: '#C05A0A', name: 'Management Responsibility', max: 7 },
  { id: 12, cat: 'Responsibility', col: '#C05A0A', name: 'Information and Confidentiality', max: 5 },
  { id: 13, cat: 'Responsibility', col: '#C05A0A', name: 'Physical and Financial Resources', max: 5 },
  { id: 14, cat: 'Responsibility', col: '#C05A0A', name: 'Strategic Planning Responsibility', max: 6 },
  { id: 15, cat: 'Responsibility', col: '#C05A0A', name: 'Equality and Inclusion', max: 5 },
  { id: 16, cat: 'Work Environment', col: '#1B5E86', name: 'Working Conditions', max: 5 },
] as const;

export const EVAL_CATEGORIES = [
  { name: 'Knowledge and Skills', col: '#2E7D88', ids: [1, 2, 3, 4, 5] },
  { name: 'Effort', col: '#6B3FA0', ids: [6, 7, 8, 9] },
  { name: 'Responsibility', col: '#C05A0A', ids: [10, 11, 12, 13, 14, 15] },
  { name: 'Work Environment', col: '#1B5E86', ids: [16] },
] as const;

// ── Supported Locales ────────────────────────────────────────────────────────
export const LOCALES = [
  'en', 'pl', 'de', 'fr', 'es', 'pt', 'it', 'sk', 'cs', 'sv', 'nl', 'da',
] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const FALLBACK_LOCALE: Locale = 'en';

// ── Guest Token Settings ─────────────────────────────────────────────────────
export const GUEST_EXPIRY_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
] as const;

export const GUEST_PERMISSIONS = ['VIEWER', 'REVIEWER'] as const;
export type GuestPermission = (typeof GUEST_PERMISSIONS)[number];
