# 06 — Internal Regulations Module Plan

A new module for Ultra. Neither Pro nor Pro Max implements this. **NOT to be built in Phase 1.** This document defines the product spec so future phases can implement against it.

Flag: `ENABLE_INTERNAL_REGULATIONS`. Default OFF.

---

## Purpose

Organizations have internal regulations (HR policies, code of conduct, compensation policies, GDPR, OHS, IT policy, etc.) that JDs and org structure must be consistent with. Today, this consistency is enforced manually. Krystyna and the JDQ engine could surface relevant regulations, flag inconsistencies, and cite source paragraphs in audits.

## Use cases

| Persona | Use case |
|---------|----------|
| HR Business Partner | "Show me regulations relevant to this JD's decision rights." |
| JD Author | "Is the proposed approval threshold consistent with the Authority Matrix policy?" |
| Auditor | "Show me which regulation supports this JD's confidentiality clause." |
| Krystyna | "Cite Section 4.2 of the Compensation Policy when explaining why this role's bonus is capped." |
| Compliance Officer | "Flag JDs that reference outdated policy versions." |

---

## Core capabilities

| Capability | Priority | Notes |
|------------|----------|-------|
| Upload PDF/DOCX/MD regulations | P0 | Use existing parsing libs (`mammoth` for DOCX, `pdf-parse` for PDF) |
| Extract structured rules from text (sections, paragraphs) | P0 | Claude-powered chunking |
| Tag regulations by topic (compensation, OHS, GDPR, authority, …) | P0 | AI-suggested + user-confirmed tags |
| Link a regulation to one or more JDs | P0 | Many-to-many `JobDescription <-> Regulation` |
| Link to org units (PMOA Department/Position) | P1 | Many-to-many |
| Link to process steps (PMOA Process / PmoaProcessStep) | P1 | Many-to-many |
| Cite evidence (paragraph quote + section reference) | P0 | Stored on link record |
| Confidence score (0–100) | P0 | Per link |
| "Outdated" warning (regulation has been superseded) | P1 | Version tracking on Regulation |
| Krystyna semantic retrieval | P2 | Vector embeddings of regulation chunks |
| Inclusion in audit reports | P1 | Add "Referenced Regulations" section to PPTX/PDF |
| Approval workflow for adding/changing regulations | P2 | Reuse existing approval workflow |

---

## Prisma schema (proposed, NOT applied yet)

```prisma
enum RegulationKind {
  HR_POLICY
  COMPENSATION
  AUTHORITY_MATRIX
  CODE_OF_CONDUCT
  OHS
  GDPR
  IT_POLICY
  OTHER
}

enum RegulationStatus {
  DRAFT
  ACTIVE
  SUPERSEDED
  ARCHIVED
}

model Regulation {
  id             String           @id @default(uuid())
  orgId          String
  title          String
  kind           RegulationKind
  version        String           // e.g. "2.1", "2026-04"
  status         RegulationStatus @default(DRAFT)
  effectiveFrom  DateTime?
  effectiveUntil DateTime?
  supersedesId   String?          // points to previous version
  sourceFileId   String?          // optional, link to uploaded file
  rawText        String           // full extracted text
  chunks         RegulationChunk[]
  jdLinks        RegulationJdLink[]
  positionLinks  RegulationPositionLink[]
  processLinks   RegulationProcessLink[]
  createdAt      DateTime         @default(now())
  createdById    String?

  @@index([orgId])
  @@index([kind])
  @@index([status])
  @@map("regulations")
}

// Chunked sections for retrieval
model RegulationChunk {
  id           String   @id @default(uuid())
  regulationId String
  sectionRef   String?  // e.g. "Section 4.2", "Annex A"
  text         String
  embedding    Json?    // [number, ...] vector for semantic search (Phase 2 of module)
  topicTags    String[]
  createdAt    DateTime @default(now())

  regulation Regulation @relation(fields: [regulationId], references: [id], onDelete: Cascade)

  @@index([regulationId])
  @@map("regulation_chunks")
}

model RegulationJdLink {
  id            String   @id @default(uuid())
  regulationId  String
  jdId          String
  evidence      String?  // quoted excerpt
  sectionRef    String?
  confidence    Int      // 0–100
  linkedById    String?
  linkedAt      DateTime @default(now())

  regulation Regulation     @relation(fields: [regulationId], references: [id], onDelete: Cascade)
  jd         JobDescription @relation(fields: [jdId], references: [id], onDelete: Cascade)

  @@unique([regulationId, jdId])
  @@map("regulation_jd_links")
}

model RegulationPositionLink {
  id           String  @id @default(uuid())
  regulationId String
  positionId   String  // PmoaPosition
  evidence     String?
  sectionRef   String?
  confidence   Int

  regulation Regulation   @relation(fields: [regulationId], references: [id], onDelete: Cascade)
  position   PmoaPosition @relation(fields: [positionId], references: [id], onDelete: Cascade)

  @@unique([regulationId, positionId])
  @@map("regulation_position_links")
}

model RegulationProcessLink {
  id           String  @id @default(uuid())
  regulationId String
  processId    String  // PmoaProcess
  evidence     String?
  sectionRef   String?
  confidence   Int

  regulation Regulation  @relation(fields: [regulationId], references: [id], onDelete: Cascade)
  process    PmoaProcess @relation(fields: [processId], references: [id], onDelete: Cascade)

  @@unique([regulationId, processId])
  @@map("regulation_process_links")
}
```

Note: `RegulationPositionLink` and `RegulationProcessLink` reference existing PMOA models (`PmoaPosition`, `PmoaProcess`).

---

## API surface (proposed)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/regulations/upload` | Upload PDF/DOCX/MD; returns extracted text + suggested chunks |
| `POST` | `/api/regulations` | Create Regulation record |
| `GET` | `/api/regulations` | List regulations (filtered by org, kind, status) |
| `GET` | `/api/regulations/[id]` | Get regulation with chunks |
| `PATCH` | `/api/regulations/[id]` | Update metadata, version, status |
| `DELETE` | `/api/regulations/[id]` | Archive (soft delete) |
| `POST` | `/api/regulations/[id]/extract` | Run Claude chunking on rawText |
| `POST` | `/api/regulations/links/jd` | Create RegulationJdLink |
| `DELETE` | `/api/regulations/links/jd/[id]` | Remove link |
| `POST` | `/api/regulations/[id]/supersede` | Mark as superseded by new version |
| `POST` | `/api/ai/regulations-suggest` | Given a JD, suggest relevant regulations + confidence + evidence |

All routes require auth. All writes require role check (admin or designated `policy_owner`).

---

## UI surface (proposed)

| Route | Purpose |
|-------|---------|
| `/regulations` | List view, filter by kind, status, version |
| `/regulations/new` | Upload + metadata form |
| `/regulations/[id]` | Detail view with chunks, linked JDs, linked org units |
| `/jd/[id]/regulations` | Tab on JD detail showing linked regulations + suggest button |

---

## Krystyna integration (Phase 5)

When `ENABLE_INTERNAL_REGULATIONS=true` AND a JD is open:
- Krystyna's context includes top-3 regulations linked to that JD
- User can ask: "What does our compensation policy say about this role's bonus?" -> Krystyna retrieves chunks with embedding similarity, cites section
- Krystyna NEVER invents regulation text. Always quotes verbatim from `RegulationChunk.text`.

---

## Audit / report inclusion (Phase 5)

PPTX/PDF reports gain a "Referenced Regulations" section listing:
- Regulation title, version, effective date
- Linked sections per JD
- Confidence per link
- Outdated warnings (if status = SUPERSEDED)

---

## Risks & open questions

| Risk | Mitigation |
|------|-----------|
| Embedding model cost | Use cheap embedding model (e.g., text-embedding-3-small) and cache per chunk |
| GDPR — regulations may contain personal data | Treat as confidential; org-scoped access; redact UI for non-admin if needed |
| Outdated regulations linked to active JDs | "supersedesId" chain; UI surfaces warning when showing JD links |
| OCR quality on scanned PDFs | Reject PDFs with no text layer; offer Claude Vision as paid fallback (later) |
| Translation — regulation in PL, JD in EN | Out of scope for v1; same-language only |

---

## Phase scoping

| Phase | Scope |
|-------|-------|
| Phase 5.1 | Schema + upload + manual link from JD |
| Phase 5.2 | AI extraction (chunking + tagging) |
| Phase 5.3 | AI suggestions (regulation -> JD relevance) |
| Phase 5.4 | Embedding-backed semantic search; Krystyna integration |
| Phase 5.5 | Report inclusion; supersession workflow |

**NOT in Phase 1.** Phase 1 includes only the schema migration **placeholder** (commented-out models in `schema.prisma`) so the structure is documented, not the implementation.
