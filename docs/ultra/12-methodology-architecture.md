# 12 — Methodology Architecture

The single source of truth for how Ultra exposes evaluation methodologies to users. Resolves the "Pro 16-criterion vs Pro Max R+E vs Axiomera" tension by giving each its own clearly-named, clearly-scoped surface.

---

## §1 — Five methodology surfaces in Ultra

| Surface | Methodology | User-facing label | Phase | Audience | Output |
|---------|-------------|---------------------|-------|----------|--------|
| **A** | 16-criterion (Hay-style EUPTD) | "Legacy 16-Criterion Evaluation" | (existing in Pro) | All users | `EvalResult` with `criteria[]` and `overallCompleteness` |
| **B** | Axiomera v1.0 (R/S/E/WC) | "Axiomera Evaluation" | 1 (shadow), 2 (UI) | Admin (shadow), all users (Phase 2) | `AxiomeraRun` with R/S/E/WC scores, grade, band, CI |
| **C** | JDQ Quality Layer (R+E hypotheses, language scoring, edge cases) | "JDQ Quality / Readiness Layer" | 1 | Admin + author | `JdqRun` with quality components |
| **D** | EUPTD Readiness (compliance self-assessment) | "EUPTD Readiness" | (existing in Pro) | Compliance officer | `EuptdReadinessResponse` |
| **E** | Pay Groups (EUPTD Article 4 grouping) | "Pay Groups" | (existing in Pro) | HR / Total Rewards | `PayGroup` + members |

**Rule:** these are five SEPARATE surfaces. They run on the same JD, produce different outputs, address different questions. Users never see them collapsed into one score. Each is clearly labeled with its purpose.

---

## §2 — Why each exists

### A. Legacy 16-Criterion Evaluation
- **Question answered:** "Does this JD contain enough information for a pay-equity comparison? Where are the gaps?"
- **Strength:** Familiar to HR teams; aligns with Hay-tradition consulting.
- **Limitation:** No grade output; no validated empirical anchors; subjective severity.
- **Why keep:** Existing customers depend on it. Simpler than Axiomera. Comparison anchor.

### B. Axiomera Evaluation
- **Question answered:** "What is the objective grade of this role, with audit-defensible reasoning?"
- **Strength:** Validated against O*NET + EWCS; EU AI Act compliant; deterministic post-extraction.
- **Output:** Grade (1-30+), Band (A1-E5), per-dimension scores (R/S/E/WC), confidence intervals, evidence quotes per hypothesis.
- **Why new:** Customer ask for premium evaluation depth. Differentiator vs. competitors.

### C. JDQ Quality Layer
- **Question answered:** "Is this JD well-written enough to be evaluated reliably? What gaps and biases exist?"
- **Strength:** Fast (some components deterministic, no LLM), cheap, runs on every save.
- **Output:** Language score (passive voice, jargon, sentence length), bias flags, structure completeness, edge-case codes.
- **Why new:** Quality gate BEFORE running expensive Axiomera. Catches problems early.

### D. EUPTD Readiness
- **Question answered:** "Is our organization ready for the EU Pay Transparency Directive?"
- **Strength:** Compliance-focused; cross-organizational, not per-JD.
- **Why keep:** Already exists in Pro. Different scope than per-JD evaluation. Don't conflate.

### E. Pay Groups
- **Question answered:** "Which roles are in the same pay-equity group under EUPTD Article 4?"
- **Strength:** Already shipped in Pro.
- **Why keep:** Core compliance feature.

---

## §3 — Mapping: 4 EUPTD criteria -> Axiomera dimensions

The EU Pay Transparency Directive Article 4 names 4 criteria. Axiomera maps directly:

| EUPTD Article 4 | Axiomera dimension | Evidence in code |
|-----------------|---------------------|-------------------|
| Skills / qualifications | **S** (Skills) | Edu × Exp 5×5 matrix; ESCO/Job Zone fallback |
| Effort | **E** (Effort) | 35 binary hypotheses, COG/EMO/PHY |
| Responsibility | **R** (Responsibility) | 9 zones, Jaques TSD |
| Working conditions | **WC** (Working Conditions) | EWCS 2024, ISCO_2 -> W1-W5 |

The 16-criterion engine groups these the same way (Knowledge & Skills, Effort, Responsibility, Work Environment) but uses different sub-criteria.

---

## §4 — Axiomera engine specification (Phase 1)

### Inputs
- JD text (raw or canonical sections)
- Optional: declared Edu, Exp, ISCO_2 code, ESCO code

### Pipeline

```
1. PARSE
   - Extract text from JD
   - (Optional) Bielik 11B / regex parsing for fields
   - Output: { rawText, fieldExtractions: { jobTitle, purpose, responsibilities, ... } }

2. R-ZONE CLASSIFICATION
   - Call Claude with R-extraction prompt
   - Returns activations for 19 R-hypotheses (binary + level + evidence quote)
   - Filter: drop activations whose evidence is not in source text
   - Compute weighted zone using R_HYPOTHESES weights (m_zone, n_anchors)
   - Output: { rZone: 1-9, rPoints, confidence: CI_R }

3. S-CLASSIFICATION
   - Detect Edu and Exp from text
   - If both detected with confidence -> use 5x5 matrix (Table 14)
   - Else if ESCO match >= 0.7 -> use Job Zone -> S_pkt
   - Else -> use ISCO_2 median Job Zone -> S_pkt
   - Output: { sLevel: S1-S5, sPkt: 50/90/150/230/333, source: 'primary'|'esco'|'isco_median' }

4. E-EXTRACTION
   - Call Claude with E-extraction prompt
   - Returns activations for 35 hypotheses (subset of 54 with O*NET benchmarks)
   - Filter evidence
   - Compute COG_hyp, EMO_hyp, PHY_hyp using P/I weights (P=1.0, I=1.5)
   - Compute E_score = 0.45*COG + 0.25*EMO + 0.30*PHY
   - Compute E_pkt = E_score * 430
   - Output: { cog, emo, phy, eScore, ePkt, confidence: CI_E }

5. WC-DETERMINATION
   - Use ISCO_2 code (from S step) -> WC_pkt from Table 20
   - Compute WC_level (W1-W5)
   - Output: { wcPkt, wcLevel }

6. COMPOSITE
   - Grade = round((R_pkt + S_pkt + E_pkt) / 50)
   - Band = mapGradeToBand(Grade) (A1-A5 -> 6-10, B1-B5 -> 11-15, etc.)
   - CI_global = 0.65 * CI_R + 0.35 * CI_E
   - Contradiction flag = |CI_R - CI_E| > 0.30 (requires expert review)
   - Output: { rPkt, sPkt, ePkt, wcPkt, totalRSE, grade, band, ciGlobal, contradictionFlag }

7. PERSIST
   - Write to AxiomeraRun
   - Write per-criterion scores to AxiomeraCriterionScore
   - Write validation gate results to AxiomeraValidationGate
   - Log AI usage to AiUsageLog
```

### Output: `AxiomeraRun` row
```typescript
{
  id: string,
  jdId: string,
  jdVersionId: string,         // links to specific JDVersion
  programId: string | null,    // sealed program if applicable
  engineVersion: 'axiomera-v1.0',
  promptVersion: { extractR: 'v1.0.0', extractE: 'v1.0.0', ... },
  rPkt: number, rZone: number, rConfidence: number,
  sPkt: number, sLevel: 'S1'..'S5', sSource: 'primary'|'esco'|'isco_median',
  ePkt: number, cogScore: number, emoScore: number, phyScore: number, eConfidence: number,
  wcPkt: number, wcLevel: 'W1'..'W5',
  totalRSE: number, grade: number, band: 'A1'|'A2'|...,
  ciGlobal: number, contradictionFlag: boolean,
  createdAt: Date, createdById: string,
}
```

### Confidence intervals
- `CI_R` = pewność klasyfikacji zone (LoRA1 in whitepaper; Claude uncertainty heuristic in our impl)
- `CI_E` = pewność klasyfikacji hipotez (LoRA2 + DeBERTa NLI in whitepaper; we use evidence-quote validation rate)
- `CI_global` = 0.65 * CI_R + 0.35 * CI_E
- Threshold: if `CI_global < 0.60`, mark for human review

---

## §5 — Reconciliation: Pro test-hypotheses (56) vs Pro Max R+E (19+45)

This is **the critical methodology decision** for Phase 1.

### What exists in Pro today
- `apps/web/app/api/ai/test-hypotheses/route.ts` — uses 56 binary hypotheses
- Categories: COG_LOW, COG_HIGH, EMO, PHY, R1_PEOPLE, R3_FIN, R4_STRAT, RISK, S2_COMM, OTHER (10 cats)
- Used by `/v5/bias-check` HypothesisPanel
- System prompt mentions "Axiomera/PRISM evaluation framework"

### What exists in Pro Max
- `lib/hypotheses/r-hypotheses.ts` — 19 R-markers
- `lib/hypotheses/e-hypotheses.ts` — 45 E-markers (18 COG + 15 EMO + 12 PHY)
- Total: 64 hypotheses
- Has weights (P=1.0, I=1.5), m_zone mapping, statistical validation (Cronbach α)

### What the whitepaper says
- 54 total hypotheses (35 with O*NET benchmark)
- Validated with Spearman ρ COG 0.702, EMO 0.472, PHY 0.587

### Reconciliation strategy
The three sets overlap but are not identical. **Decision:**

1. **Pro Max R+E (64 markers) is the canonical Axiomera implementation** for Ultra Phase 1. It has:
   - Per-marker weights and zone mapping
   - Documented statistical validation
   - Direct use in `compose.ts` for grade calculation
2. **Pro's 56-hypothesis test-hypotheses panel stays in `/v5/bias-check`** as is. It serves a different use case (4-layer bias diagnostic, not full grading).
3. **Phase 1 task:** map the 56 Pro hypotheses to the 64 Pro Max markers. Most should overlap. Differences:
   - Pro's bias-related categories (RISK, S2_COMM) may be specific to bias use case
   - Pro Max has interaction (I) hypotheses Pro lacks
4. **Output:** a mapping document `lib/axiomera/hypothesis-mapping.ts` showing which Pro hypothesis IDs correspond to which Pro Max marker IDs, and which are unique to each.
5. **Long-term:** consolidate into a single 60-80 marker set (the Pro Max set extended with bias-specific markers from Pro). Out of scope for Phase 1.

### Validation — must match whitepaper
- Phase 1 acceptance: validate Pro Max E-marker count against whitepaper. If Pro Max has 45 and whitepaper says 35 validated, document the 10 extra markers and either:
  - Mark them as "experimental" (not used in scoring)
  - Get user signoff to use them with disclaimer

---

## §6 — User-visible UX

### JD detail page (Phase 2+)
Tabs:
- "Content" — JD text and metadata (default)
- "Quality" — JDQ Quality Layer output (language score, bias, structure)
- "Evaluation"
  - "Legacy 16-Criterion" — existing engine
  - "Axiomera" — new engine (gated by flag)
  - "Comparison" (admin only) — side by side
- "Approval" — when flag ON, approval timeline
- "Sonification" — broadcast and fingerprint
- "Versions" — JDVersion history

### Distinctions
- "Quality" answers "is the JD ready?"
- "Evaluation" answers "what is the role's grade?"
- These are NEVER conflated. Distinct tabs, distinct results.

### Default view per role
- **Author:** sees Content + Quality (immediate feedback)
- **Manager (reviewer):** sees Content + Quality + Evaluation > Legacy
- **HR:** sees all tabs except Comparison
- **Admin:** sees all tabs including Comparison

---

## §7 — Comparison and audit

When both engines run on the same JD:
- 16-criterion overall score (0-100) is `EvalResult.overallScore`
- Axiomera grade (1-30+) is `AxiomeraRun.grade`
- These are different scales but both have meaningful interpretation
- Comparison page shows them side by side with translation:
  - "16-criterion 78/100" approximately = "Axiomera Grade 17 (Band C2)" -- approximate, not literal
- Disclaimer: "These methodologies use different scales. Direct comparison is approximate."

### Audit defensibility
- Axiomera output includes per-hypothesis evidence quotes
- 16-criterion output includes per-criterion gaps
- Both are stored immutably (`EvalResult` and `AxiomeraRun` records are insert-only in normal flow)
- Sealed JdqProgram (Phase 2) freezes weights for an Axiomera evaluation, providing audit-grade reproducibility

---

## §8 — Forward path: convergence (Phase 6+, optional)

If, after observing both engines in production for 6+ months, we determine:
- 16-criterion adds little beyond Axiomera once Axiomera is mature
- Customers prefer Axiomera as primary

Then a future phase could:
- Mark 16-criterion as deprecated (still works, but new orgs default to Axiomera)
- Eventually remove 16-criterion endpoint (with 12-month notice)
- Migrate `EvalResult` history to a read-only archive view

But this is NOT in Phase 1-5 scope. The principle is preservation.

---

## §9 — Naming convention summary

To avoid user confusion, every methodology surface uses these exact labels in UI:

| Internal name | UI label EN | UI label PL |
|---------------|-------------|-------------|
| 16-criterion | "Legacy 16-Criterion Evaluation" | "Klasyczna ocena 16-kryterialna" |
| Axiomera | "Axiomera Evaluation" | "Ocena Axiomera" |
| JDQ | "JDQ Quality / Readiness Layer" | "JDQ — warstwa jakości i gotowości" |
| EUPTD Readiness | "EUPTD Readiness" | "Gotowość EUPTD" |
| JD Project Readiness | "JD Project Readiness" | "Gotowość projektu JD" |
| Pay Groups | "Pay Groups" | "Grupy płacowe" |

These are translation keys. See [10-i18n-migration-rules.md](10-i18n-migration-rules.md).

---

## §10 — Phase 1 acceptance criteria for methodology architecture

1. Prisma schema additions applied: `AxiomeraRun`, `AxiomeraCriterionScore`, `AxiomeraValidationGate`, `JdqRun`, `RHypothesisRecord`, `EHypothesisRecord`, `RZoneEstimate`, `EScoreSummary`, `JdqProgram`, `JdqProgramVersion`, `ApprovalRecord` (table only, not used until Phase 2), `AiUsageLog`, `IntakeSession` (table only), `ReadinessScore` (table only)
2. `lib/axiomera/` directory created with engine code ported from Pro Max `lib/jdq/` and `lib/hypotheses/`, translated from Drizzle to Prisma queries
3. `lib/axiomera/hypothesis-mapping.ts` documents Pro 56 vs Pro Max 64 reconciliation
4. API route `POST /api/jd/[id]/axiomera/run` runs the engine, gated by `ENABLE_AXIOMERA_ENGINE`
5. Admin comparison page `/admin/jds/[id]/comparison` exists, gated by flag
6. All AI calls go through `callAi()` from [07-ai-cost-model.md](07-ai-cost-model.md)
7. Golden test set ([11](11-quality-gates-and-uat.md) §4) produces stable expected outputs
8. Existing 16-criterion engine UNCHANGED; verified by running on golden set, comparing output to baseline
9. `/v5/*` routes UNCHANGED; verified by smoke tests
10. Sonification UNCHANGED; verified by SC-T1 (fingerprint byte-identical)
