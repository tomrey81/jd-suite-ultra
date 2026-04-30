# JD Suite v5 — Master Product Specification

**Owner:** Tomasz Rey
**Status:** Build-ready spec — committed 2026-04-29
**Implementation:** parallel module under `/v5/*` until feature-complete, then deprecates v4.

This is the canonical product spec. Every change to a hypothesis, lexicon, rubric, or scoring axis must reference a section number here.

---

> See the conversation thread for the full original 25-section text.
> This file should be updated in lock-step with v5 development.

## Phase 0a (shipped 2026-04-29)
- Bias engine v0 at `/v5/bias-check`
- EN + PL lexicons under `apps/web/lib/bias/lexicon/`
- Lexical layer (Layer 1 of §11.2) — agentic/communal scoring + span highlighting
- Title-form layer (Layer 2 of §11.2) — Polish feminative pair detection, EN gendered nouns
- Structural layer (Layer 3, basic) — EIGE coverage of E1/E2/E3 visibility

## Phase 0b — pending (next sessions)
- Block model migration (§6, §19) — TipTap/ProseMirror, replaces flat `data: Json`
- Article 4 Pack export (§12)
- Hypothesis library v0 (§10.2)
- Library hierarchy: Family + Function + Level (§14.1)

The spec proper lives in the conversation log + the original markdown payload.
This file is the index/changelog.
