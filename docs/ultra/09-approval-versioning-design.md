# 09 — Approval Workflow + JDVersion Design

The Pro Max audit identified the approval workflow as a high-value migration. This document designs the integration with Pro's existing `JDVersion` and `JDStatus` so there is **one source of truth** for status changes — no drift.

Flag: `ENABLE_APPROVAL_WORKFLOW`. Default OFF. When OFF, current Pro `JDStatus` simple flow remains.

---

## §1 — Current state in Pro

### `JDStatus` enum
```prisma
enum JDStatus {
  DRAFT
  UNDER_REVISION
  APPROVED
  ARCHIVED
}
```

A `JobDescription` has one `status` field. Transitions are direct: any user with edit rights can change status. No formal multi-stage workflow.

### `JDVersion` model (relevant excerpt)
```prisma
enum ChangeType {
  FIELD_EDIT
  STATUS_CHANGE
  COMMENT
  IMPORT
  AI_ASSIST
  EVALUATION
  EXPORT
}

model JDVersion {
  id           String     @id @default(uuid())
  jdId         String
  authorId     String?
  authorType   String     @default("USER") // USER | GUEST
  data         Json?      // Full JD snapshot (optional, for major changes)
  changeType   ChangeType
  fieldChanged String?    // for FIELD_EDIT
  oldValue     String?
  newValue     String?
  note         String?
  timestamp    DateTime   @default(now())
}
```

Status changes today: when `JobDescription.status` changes, a `JDVersion` row with `changeType = STATUS_CHANGE` is created with `oldValue` and `newValue` storing the enum strings. This is the **existing** audit trail.

---

## §2 — Pro Max approval design (reference)

Pro Max has a 6-stage workflow:
```
draft -> manager_validation -> hr_review -> governance_approval -> published | rejected
```

Stored in `approvalRecords` (Drizzle table) with one row per stage transition. Each row includes `stage`, `action` (approve|reject|delegate|comment|advance), `actorId`, `comment`, `createdAt`. Records are insert-only (immutable ledger).

Pro Max's design is good but creates a **parallel status source** — if not integrated with `JDVersion`, two systems track JD status, and they can drift.

---

## §3 — Ultra design: ApprovalRecord references JDVersion

### Principle
Every approval action **must** correspond to a `JDVersion` row. The `ApprovalRecord` extends — never replaces — the version log.

### Schema (Phase 2)

```prisma
enum ApprovalStage {
  DRAFT
  MANAGER_VALIDATION
  HR_REVIEW
  GOVERNANCE_APPROVAL
  PUBLISHED
  REJECTED
}

enum ApprovalAction {
  ADVANCE       // move to next stage
  APPROVE       // approve at current stage
  REJECT        // reject at current stage
  REQUEST_CHANGES
  DELEGATE
  COMMENT
  WITHDRAW      // author withdraws from review
  RESUBMIT      // after rejection or change request
}

model ApprovalRecord {
  id            String          @id @default(uuid())
  jdId          String
  jdVersionId   String          // FK to the JDVersion row created for this transition
  fromStage     ApprovalStage?
  toStage       ApprovalStage
  action        ApprovalAction
  actorId       String
  comment       String?
  isMandatoryComment Boolean    @default(false) // true for REJECT/REQUEST_CHANGES
  delegatedToUserId String?     // for DELEGATE action
  policyVersion String?         // ApprovalPolicy version applied at this transition
  createdAt     DateTime        @default(now())

  jd        JobDescription @relation(fields: [jdId], references: [id], onDelete: Cascade)
  jdVersion JDVersion      @relation(fields: [jdVersionId], references: [id])
  actor     User           @relation("ApprovalActor", fields: [actorId], references: [id])
  delegatedTo User?        @relation("ApprovalDelegate", fields: [delegatedToUserId], references: [id])

  @@index([jdId, createdAt])
  @@index([jdVersionId])
  @@index([toStage])
  @@map("approval_records")
}
```

### Status field on JobDescription

**Phase 2 changes:** Add `JDStatus` enum value:
```prisma
enum JDStatus {
  DRAFT
  UNDER_REVISION
  APPROVED
  ARCHIVED
  PUBLISHED          // NEW
  REJECTED           // NEW (currently REJECTED was implied by going back to DRAFT)
}
```

**Backward compatibility:** Existing JDs in `UNDER_REVISION` continue to mean exactly what they meant. Adding new values does not break old data. Pro's existing UI surfaces continue to work — they just show new values when an org has approval workflow enabled.

When `ENABLE_APPROVAL_WORKFLOW=false`:
- `JDStatus` remains in {DRAFT, UNDER_REVISION, APPROVED, ARCHIVED}
- New values PUBLISHED, REJECTED never set
- `ApprovalRecord` table exists but is unused

When `ENABLE_APPROVAL_WORKFLOW=true`:
- Status transitions write BOTH `JDVersion` (changeType=STATUS_CHANGE) AND `ApprovalRecord`
- The two are linked: `ApprovalRecord.jdVersionId -> JDVersion.id`
- `JobDescription.status` is updated to match `ApprovalRecord.toStage`

### One-source-of-truth invariant

For any JD with `ENABLE_APPROVAL_WORKFLOW=true`:
```
JobDescription.status === (latest ApprovalRecord by createdAt).toStage
```

This invariant is enforced at write-time in the API layer (transaction wraps the update + insert). Read-time, queries can use either field; they should always agree.

---

## §4 — Workflow state machine

### Default policy (per-org configurable)

```
DRAFT
  |
  | ADVANCE (author submits)
  v
MANAGER_VALIDATION
  |---- APPROVE (manager) -----> HR_REVIEW
  |---- REQUEST_CHANGES -------> DRAFT (mandatory comment)
  |---- DELEGATE -------------> MANAGER_VALIDATION (different actor)
  |---- WITHDRAW (author) ----> DRAFT
  |
HR_REVIEW
  |---- APPROVE -------------> GOVERNANCE_APPROVAL
  |---- REQUEST_CHANGES ------> DRAFT (mandatory comment)
  |---- WITHDRAW -------------> DRAFT
  |
GOVERNANCE_APPROVAL
  |---- APPROVE -------------> APPROVED
  |---- REJECT ---------------> REJECTED (mandatory comment)
  |
APPROVED
  |---- ADVANCE (publish) ---> PUBLISHED
  |---- (re-edit) -----------> DRAFT (creates new approval cycle)
  |
PUBLISHED
  |---- ARCHIVE ------------> ARCHIVED
  |---- RESUBMIT (with major edit) ----> DRAFT
  |
REJECTED
  |---- RESUBMIT ------------> DRAFT
  |
ARCHIVED
  | (terminal)
```

### Per-org configuration

Small clients should not be forced into 6 stages. Each org has an `ApprovalPolicy`:

```prisma
model ApprovalPolicy {
  id             String  @id @default(uuid())
  orgId          String  @unique
  version        String  // bump when policy changes; old approvals retain old policy
  stages         Json    // ordered array of stage configs
  requireCommentOnReject Boolean @default(true)
  requireCommentOnRequestChanges Boolean @default(true)
  allowDelegation Boolean @default(true)
  publishRequiresAdditionalApproval Boolean @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdById    String?

  @@map("approval_policies")
}
```

`stages` example for small client:
```json
[
  { "stage": "DRAFT", "label": "Draft", "approvers": ["any_member"] },
  { "stage": "APPROVED", "label": "Approved", "approvers": ["role:OWNER", "role:ADMIN"] }
]
```
For enterprise:
```json
[
  { "stage": "DRAFT", "label": "Draft", "approvers": ["author"] },
  { "stage": "MANAGER_VALIDATION", "label": "Manager review", "approvers": ["jd.lineManager"] },
  { "stage": "HR_REVIEW", "label": "HR review", "approvers": ["role:HR"] },
  { "stage": "GOVERNANCE_APPROVAL", "label": "Governance", "approvers": ["role:GOVERNANCE_BOARD"] },
  { "stage": "APPROVED", "label": "Approved", "approvers": [] },
  { "stage": "PUBLISHED", "label": "Published", "approvers": ["role:ADMIN"] }
]
```

---

## §5 — UI requirements

### JD detail page additions (when flag ON)

| Element | Behavior |
|---------|----------|
| Stage badge | Shows current stage with color (DRAFT=gray, MANAGER=blue, HR=teal, GOVERNANCE=purple, APPROVED=green, PUBLISHED=gold, REJECTED=red, ARCHIVED=stone) |
| "Next allowed actions" panel | Lists buttons for actions current user can take (per role + per stage) |
| Comment input | Required when action is REJECT or REQUEST_CHANGES |
| Approval timeline | Vertical list of all `ApprovalRecord` rows for this JD, with actor, stage, action, comment, timestamp. Latest at top. |
| "Withdraw" button | Author can withdraw at any pending stage |

### Read-only mode during review

When status is in `MANAGER_VALIDATION`, `HR_REVIEW`, or `GOVERNANCE_APPROVAL`:
- Author cannot edit content (can only WITHDRAW)
- Reviewers can comment but not edit content
- Edits during these stages would create a content vs review mismatch

When status is `APPROVED` or `PUBLISHED`:
- Direct edits create `JDVersion` with `changeType=FIELD_EDIT` AND auto-transition status to `DRAFT` (new approval cycle)
- Optional config: `lockApprovedJds` flag prevents post-approval edits without explicit "create amendment" action

---

## §6 — API surface

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/jd/[id]/approval/advance` | Author submits for review (DRAFT -> MANAGER_VALIDATION) |
| `POST` | `/api/jd/[id]/approval/approve` | Reviewer approves at current stage |
| `POST` | `/api/jd/[id]/approval/reject` | Reviewer rejects (mandatory comment) |
| `POST` | `/api/jd/[id]/approval/request-changes` | Reviewer requests changes (mandatory comment) |
| `POST` | `/api/jd/[id]/approval/delegate` | Reviewer delegates to another user |
| `POST` | `/api/jd/[id]/approval/withdraw` | Author withdraws |
| `POST` | `/api/jd/[id]/approval/resubmit` | After rejection, author resubmits |
| `POST` | `/api/jd/[id]/approval/publish` | Admin publishes APPROVED JD |
| `GET` | `/api/jd/[id]/approval/history` | Returns ApprovalRecord list for this JD |
| `GET` | `/api/jd/[id]/approval/next-actions` | Returns array of {action, label, requiresComment} for current user + stage |
| `GET` | `/api/orgs/[id]/approval-policy` | Get current policy |
| `PATCH` | `/api/orgs/[id]/approval-policy` | Update policy (admin only, bumps version) |

### Transactional integrity

Every action endpoint wraps the work in a Prisma transaction:
1. Read current `JobDescription.status`
2. Validate transition allowed (state machine)
3. Validate actor permission (per stage policy)
4. Create `JDVersion` (changeType=STATUS_CHANGE)
5. Create `ApprovalRecord` (jdVersionId references the JDVersion)
6. Update `JobDescription.status` = newStage
7. (Optional) emit notification event

If any step fails, all roll back.

---

## §7 — Sonification interaction

Per [04-sonification-contract.md](04-sonification-contract.md) Rule SC-4:
- When `ENABLE_APPROVAL_WORKFLOW=true`: broadcaster UI shows confirmation dialog if status is DRAFT or UNDER_REVISION (or any non-APPROVED/PUBLISHED state).
- When `ENABLE_APPROVAL_WORKFLOW=false`: no gating.

---

## §8 — JDQ/Axiomera engine interaction

When `ENABLE_APPROVAL_WORKFLOW=true`:
- JDQ/Axiomera scoring CAN run on any JD regardless of stage (informational use)
- BUT: "Sealed" Axiomera evaluations (using a sealed JdqProgram) should only be created on APPROVED or PUBLISHED JDs — to avoid sealing a score against a draft that may still change
- This rule is server-side enforced in `POST /api/jdq/run` when `programId` is set: if program is sealed AND `jd.status NOT IN {APPROVED, PUBLISHED}`, return 400

---

## §9 — Acceptance tests

| Test | Pass criteria |
|------|---------------|
| AW-T1 | With flag OFF, no `ApprovalRecord` rows are created for status changes. `JDVersion` records still created. |
| AW-T2 | With flag ON, every `JobDescription.status` change has a corresponding `ApprovalRecord` AND a `JDVersion` row, linked. |
| AW-T3 | Reject without comment is rejected by API (400). |
| AW-T4 | Author cannot APPROVE their own JD at MANAGER_VALIDATION (assuming policy doesn't allow self-approval). |
| AW-T5 | Configure org with 2-stage policy. Submit JD. Only 2 stages appear in timeline. |
| AW-T6 | Configure org with 6-stage policy. Submit JD. All 6 stages appear correctly. |
| AW-T7 | After APPROVED, edit JD content. Status auto-transitions to DRAFT. New ApprovalRecord chain begins. |
| AW-T8 | Sealed JdqProgram cannot be applied to DRAFT JD. |
| AW-T9 | Approval timeline displays correctly in all 9 locales. |
| AW-T10 | Migration of an org from policy v1 to policy v2 does not break ApprovalRecord history. Old records retain `policyVersion='v1'`. |

---

## §10 — Backward compatibility commitment

When this feature ships:
- Pro instances upgrading to Ultra default to `ENABLE_APPROVAL_WORKFLOW=false`
- Existing JDs continue to use the simple JDStatus flow
- Orgs opt in via admin settings UI (which calls `PATCH /api/orgs/[id]/approval-policy`)
- Once opted in, existing JDs keep their current status (DRAFT/UNDER_REVISION/APPROVED/ARCHIVED) and start using the workflow on next status change
- No retroactive ApprovalRecord creation
