# 10 — i18n Migration Rules

Ultra MUST stay multilingual. Every migrated feature must respect Pro's `next-intl` system. Hardcoded Pro Max strings (Polish-only or Polish/English/German trilingual constants) are NOT to be copied into Ultra UI.

---

## §1 — Current Pro i18n setup

### Tech
- Library: `next-intl` (server + client)
- Config: `apps/web/i18n/request.ts`
- Locale storage: `locale` cookie (no URL prefix)
- Fallback: English

### Supported locales (9 total)
- `en` — English (source language)
- `pl` — Polish
- `de` — German
- `fr` — French
- `es` — Spanish
- `sk` — Slovak
- `cs` — Czech
- `ro` — Romanian
- `sv` — Swedish

### Files
- Translation source: `apps/web/messages/{locale}.json`
- Locale switcher component: `apps/web/components/layout/language-switcher.tsx`
- Hooks: `useTranslations(namespace)` (client), `getTranslations(namespace)` (server)

### Top-level message namespaces (existing)
```
common, auth, nav, workspace, builder, analyser, evaluation, ...
```

---

## §2 — Rules for migration

### Rule i18n-1 — No hardcoded user-facing strings
Every UI string visible to a user MUST be a translation key. This includes:
- Page titles, headings, labels
- Button text
- Form placeholders
- Error messages, validation messages
- Toast notifications
- Empty states ("No items", "Create your first…")
- Loading states ("Loading…", "Saving…")
- Confirmation modal text
- Tooltips
- Sidebar nav labels
- Breadcrumbs
- Status badges (e.g., "Draft", "Approved" — translated; the underlying enum value stays English)

**Anti-pattern (rejected):**
```tsx
<button>Submit for review</button>
```

**Correct:**
```tsx
const t = useTranslations('approval');
<button>{t('actions.submitForReview')}</button>
```

### Rule i18n-2 — All locale files updated together
When adding a new translation key:
1. Add to `en.json` (source language)
2. Add to all 8 other locale files
3. For locales without immediate translation: copy English with `[TODO:locale]` prefix, e.g., `"submitForReview": "[TODO:fr] Submit for review"`. This is a **temporary placeholder** flagged for human translator review.
4. Optionally: add an automated check in CI that fails if any locale file is missing a key present in `en.json`.

### Rule i18n-3 — No new "lib/" data with hardcoded multi-language strings
Pro Max has files like `lib/hypotheses/r-hypotheses.ts` with `label_pl`, `label_en`, `label_de` triplets. **Do not copy this pattern into Ultra `lib/`.** Instead:

- The hypothesis ID (e.g., `r_01_strategic_planning`) lives in the `lib/` data
- The labels live in translation files: `messages/{locale}.json` under `hypotheses.r.r_01_strategic_planning.label`

This way:
- Methodology data is i18n-language-independent
- Adding a 10th locale is a translation file edit, not a code change
- Translators don't have to read TypeScript

### Rule i18n-4 — Methodology constants stay in English
Enum values, status codes, hypothesis IDs, criterion IDs, internal flags — these stay in English. They are **identifiers**, not labels. Example:

```typescript
// CORRECT
type JDStatus = 'DRAFT' | 'UNDER_REVISION' | 'APPROVED' | 'ARCHIVED' | 'PUBLISHED' | 'REJECTED';

// WRONG
type JDStatus = 'BROUILLON' | 'EN_REVISION' | ...  // do not localize identifiers
```

The translated label for `DRAFT` in French is fetched via `t('jdStatus.DRAFT')` returning `"Brouillon"`.

### Rule i18n-5 — Plurals and ICU messages
For counts and complex sentences, use ICU MessageFormat (next-intl supports it natively):

```json
{
  "library": {
    "jdCount": "{count, plural, =0 {No JDs} =1 {1 JD} other {# JDs}}"
  }
}
```

```tsx
const t = useTranslations('library');
<span>{t('jdCount', { count: jds.length })}</span>
```

### Rule i18n-6 — Date / number formatting via Intl
For dates and numbers, use `next-intl`'s formatters or browser `Intl`:

```tsx
const format = useFormatter();
<span>{format.dateTime(jd.updatedAt, 'short')}</span>
<span>{format.number(score, { style: 'percent' })}</span>
```

### Rule i18n-7 — Polish gendered persona for Krystyna
Krystyna is a feminine Polish name. Polish translations referencing the assistant MUST use feminine grammatical forms:
- "Krystyna pracuje" (she is working) NOT "Asystent pracuje" (assistant masc. is working)
- "Zapytaj Krystynę" NOT "Zapytaj Krystyna"

Other locales follow their own grammatical conventions.

### Rule i18n-8 — Long-form content (regulation excerpts, prompts)
Regulations and AI prompts may be in any language. Do not auto-translate them. The Internal Regulations module ([06](06-internal-regulations-module-plan.md)) stores regulation text in its **original language** with a `language` field. UI labels around the content stay localized.

### Rule i18n-9 — Test coverage
For each new UI surface, add a Playwright test that:
1. Switches locale to a non-English value
2. Verifies the page renders without `[TODO:`, missing-key errors, or untranslated English fallbacks in a critical user-facing area
3. Verifies date/number formatting respects the locale

---

## §3 — Translation key namespace plan for migrated features

### Phase 1 (methodology architecture)
```json
{
  "axiomera": {
    "title": "Axiomera Evaluation",
    "subtitle": "EU-compliant pay equity evaluation",
    "dimensions": {
      "R": "Responsibility",
      "S": "Skills",
      "E": "Effort",
      "WC": "Working Conditions"
    },
    "rZones": {
      "Z1": "Own actions",
      "Z2": "Own task",
      "Z3": "Own area",
      "Z4": "Project / process",
      "Z5": "Team results",
      "Z6": "Function results",
      "Z7": "Division results",
      "Z8": "Multiple functions",
      "Z9": "Whole organization"
    },
    "grade": {
      "label": "Grade",
      "band": "Band {band}"
    }
  },
  "jdq": {
    "title": "JDQ Quality Layer",
    "components": {
      "structure": "Structure",
      "language": "Language",
      "factors": "Factors",
      "decision": "Decision Readiness"
    }
  },
  "hypotheses": {
    "r": {
      "r_01_strategic_planning": {
        "label": "Strategic planning responsibility",
        "guidance": "Look for evidence of long-term strategic ownership, multi-year horizons, board-level reporting."
      },
      // ... 18 more
    },
    "e": {
      "e_cog_problem_solving": {
        "label": "Solves problems without precedent",
        "dimension": "COG"
      },
      // ... 44 more
    }
  }
}
```

### Phase 2 (approval workflow + Krystyna)
```json
{
  "approval": {
    "stages": {
      "DRAFT": "Draft",
      "MANAGER_VALIDATION": "Manager validation",
      "HR_REVIEW": "HR review",
      "GOVERNANCE_APPROVAL": "Governance approval",
      "APPROVED": "Approved",
      "PUBLISHED": "Published",
      "REJECTED": "Rejected",
      "ARCHIVED": "Archived"
    },
    "actions": {
      "submitForReview": "Submit for review",
      "approve": "Approve",
      "reject": "Reject",
      "requestChanges": "Request changes",
      "delegate": "Delegate",
      "withdraw": "Withdraw",
      "resubmit": "Resubmit",
      "publish": "Publish"
    },
    "validation": {
      "rejectRequiresComment": "Please provide a reason for rejection.",
      "requestChangesRequiresComment": "Please describe the changes needed."
    }
  },
  "krystyna": {
    "name": "Krystyna",
    "openLauncher": "Talk to Krystyna",
    "tagline": "Your JD work assistant",
    "thinking": "Krystyna is thinking…",
    "errorFallback": "Krystyna is unavailable right now."
  }
}
```

### Phase 3 (PPTX, Intake, Readiness)
```json
{
  "intake": {
    "title": "Project Intake Checklist",
    "subtitle": "Confirm readiness before starting JD work",
    "items": {
      "i_01_scope_defined": { "question": "Has the project scope been defined?" },
      "i_02_stakeholders_identified": { "question": "Have key stakeholders been identified?" }
      // ... 12 more
    }
  },
  "jdProjectReadiness": {
    "title": "JD Project Readiness",
    "subtitle": "14-dimension readiness assessment",
    "dimensions": {
      "d_01_role_purpose_clarity": { "label": "Role purpose clarity" },
      // ... 13 more
    },
    "verdicts": {
      "ready": "Ready",
      "conditional": "Conditional",
      "notReady": "Not ready"
    }
  }
}
```

### Phase 5 (Internal Regulations)
```json
{
  "regulations": {
    "title": "Internal Regulations",
    "kinds": {
      "HR_POLICY": "HR Policy",
      "COMPENSATION": "Compensation",
      "AUTHORITY_MATRIX": "Authority Matrix",
      "CODE_OF_CONDUCT": "Code of Conduct",
      "OHS": "Occupational Health & Safety",
      "GDPR": "Data Protection (GDPR)",
      "IT_POLICY": "IT Policy",
      "OTHER": "Other"
    }
  }
}
```

---

## §4 — Tooling

### CI check (Phase 2)
Add a script: `pnpm i18n:verify` that:
1. Reads `messages/en.json` (source)
2. Walks every other locale file
3. Reports keys missing from each
4. Exits non-zero if any keys missing

```bash
# package.json
"scripts": {
  "i18n:verify": "tsx scripts/i18n-verify.ts"
}
```

Run in CI alongside `typecheck` and `lint`.

### Translator workflow (Phase 3+)
- Source language updates (EN) trigger a translation request
- Use `[TODO:locale]` placeholders to mark untranslated keys
- Periodic export to translator (CSV or JSON), then import back
- (Optional) Use a localization platform (Crowdin, Lokalise) — out of scope for v1

---

## §5 — Anti-patterns (DO NOT DO)

| Anti-pattern | Why bad | Correct |
|--------------|---------|---------|
| Hardcoded English in JSX: `<button>Save</button>` | Breaks non-EN UI | `t('common.save')` |
| Pro Max-style multi-language constants in lib/: `{ label_pl, label_en, label_de }` | Doesn't extend to 9 locales; couples data with i18n | ID in lib/, label in messages/ |
| Conditional language switch in component: `if (locale === 'pl') ...` | Not maintainable | Use `useTranslations` hook |
| Translating enum values: `'BROUILLON'` instead of `'DRAFT'` | Database key chaos | Keep enums English; translate labels |
| Date hardcoded format: `jd.updatedAt.toLocaleDateString('en-US')` | Ignores user locale | Use `useFormatter().dateTime()` |

---

## §6 — Acceptance tests

| Test | Pass criteria |
|------|---------------|
| I18N-T1 | `pnpm i18n:verify` exits 0 (all keys present in all locales). |
| I18N-T2 | Switch locale to PL. Open `/admin/jds/[id]`. No English text visible in primary UI. |
| I18N-T3 | Switch locale to FR. Open Krystyna. Tagline reads in French. |
| I18N-T4 | Open `/jd/[id]/approval` (when flag ON). Approval stages display in current locale. |
| I18N-T5 | Date "2026-05-01" formats as "May 1, 2026" in EN, "1 maja 2026" in PL, "1. Mai 2026" in DE. |
| I18N-T6 | An untranslated key with `[TODO:fr]` placeholder is detected by the i18n CI script. |
