/**
 * Ultra feature flags. All flags default OFF.
 * When all flags are OFF, Ultra MUST behave identically to Pro.
 *
 * Read once at module load. Server-only — for client visibility,
 * mirror via NEXT_PUBLIC_* in next.config.ts.
 */

function flag(name: string, defaultOn = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultOn;
  return v.toLowerCase() === 'true' || v === '1';
}

export const FLAGS = {
  // Phase 1
  AXIOMERA_ENGINE: flag('ENABLE_AXIOMERA_ENGINE'),
  AXIOMERA_SHADOW_MODE: flag('ENABLE_AXIOMERA_SHADOW_MODE', true), // default ON when engine is on
  JDQ_LAYER: flag('ENABLE_JDQ_LAYER'),
  R_E_HYPOTHESES_PANEL: flag('ENABLE_R_E_HYPOTHESES_PANEL'),

  // Phase 2
  SEALED_PROGRAMS: flag('ENABLE_SEALED_PROGRAMS'),
  APPROVAL_WORKFLOW: flag('ENABLE_APPROVAL_WORKFLOW'),
  KRYSTYNA_RENAME: flag('ENABLE_KRYSTYNA_RENAME'),

  // Phase 3
  PPTX_EXPORT: flag('ENABLE_PPTX_EXPORT'),
  INTAKE_CHECKLIST: flag('ENABLE_INTAKE_CHECKLIST'),
  JD_PROJECT_READINESS: flag('ENABLE_JD_PROJECT_READINESS'),

  // Phase 4
  METHOD_MATRIX: flag('ENABLE_METHOD_MATRIX'),
  SPEC_DASHBOARD: flag('ENABLE_SPEC_DASHBOARD'),
  FAMILY_DIAGNOSTICS: flag('ENABLE_FAMILY_DIAGNOSTICS'),

  // Phase 5+
  INTERNAL_REGULATIONS: flag('ENABLE_INTERNAL_REGULATIONS'),
  COST_DASHBOARD: flag('ENABLE_COST_DASHBOARD'),
  AI_RESPONSE_CACHE: flag('ENABLE_AI_RESPONSE_CACHE'),
} as const;

export type FlagName = keyof typeof FLAGS;
