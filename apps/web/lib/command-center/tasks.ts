/**
 * Command Center — task computation engine.
 *
 * Tasks are computed dynamically from JD state. No new DB tables needed in v1
 * (which keeps deploys simple). When we want assignment + due dates + manual
 * tasks, we'll add a `Task` model with `assignedToId`, `dueAt`, `priority`,
 * `kind`, `targetJdId`, `targetSlotId`. Until then, every task in this list
 * is derivable from existing JD / slot / eval state.
 *
 * Task kinds:
 *   - PREPARE_JD          — JD doesn't exist for an org-required role
 *   - REVIEW_JD           — JD is in DRAFT and has not been opened in N days
 *   - APPROVE_JD          — JD is UNDER_REVISION and waiting for approval
 *   - SEND_FOR_EVALUATION — JD is APPROVED but has no EvalResult
 *   - PROVIDE_EVALUATION  — Evaluation is pending (placeholder for Axiomera)
 *   - PLACE_IN_MATRIX     — JD is APPROVED + evaluated but not in architecture
 *   - VERIFY_PLACEMENT    — JD is placed but its grade doesn't match its eval score
 *   - REFRESH_JD          — JD has not been touched in 12+ months
 */

export type TaskKind =
  | 'PREPARE_JD'
  | 'REVIEW_JD'
  | 'APPROVE_JD'
  | 'SEND_FOR_EVALUATION'
  | 'PROVIDE_EVALUATION'
  | 'PLACE_IN_MATRIX'
  | 'VERIFY_PLACEMENT'
  | 'REFRESH_JD';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface CommandCenterTask {
  id: string;
  kind: TaskKind;
  title: string;
  description: string;
  priority: TaskPriority;
  jdId?: string;
  jdTitle?: string;
  href: string;
  /** ISO date when this state was first observed (best effort: JD updatedAt) */
  observedAt?: string;
}

export const TASK_KIND_META: Record<TaskKind, { label: string; icon: string; color: string }> = {
  PREPARE_JD:          { label: 'Prepare JD',           icon: '✎', color: '#8A7560' },
  REVIEW_JD:           { label: 'Review JD',            icon: '◇', color: '#1F6FEB' },
  APPROVE_JD:          { label: 'Approve JD',           icon: '✓', color: '#2DA44E' },
  SEND_FOR_EVALUATION: { label: 'Send to evaluation',   icon: '⇪', color: '#8250DF' },
  PROVIDE_EVALUATION:  { label: 'Provide evaluation',   icon: '⚖', color: '#BC4C00' },
  PLACE_IN_MATRIX:     { label: 'Place in matrix',      icon: '⊞', color: '#0969DA' },
  VERIFY_PLACEMENT:    { label: 'Verify placement',     icon: '⚐', color: '#9B2C2C' },
  REFRESH_JD:          { label: 'Refresh JD',           icon: '⟳', color: '#5C6BC0' },
};

interface JDInput {
  id: string;
  jobTitle: string;
  status: 'DRAFT' | 'UNDER_REVISION' | 'APPROVED' | 'ARCHIVED';
  updatedAt: Date | string;
  hasSlot: boolean;
  hasEval: boolean;
  evalScore?: number;
  slotLevel?: number;
}

interface OrgChartPositionInput {
  /** Role name in the org chart that has no matching JD */
  positionTitle: string;
  positionId: string;
}

/**
 * Compute the current task list for an org.
 *
 * @param jds - All non-archived JDs for the org
 * @param orgChartGaps - Positions in the org chart that have no JD attached (optional)
 */
export function computeTasks(
  jds: JDInput[],
  orgChartGaps: OrgChartPositionInput[] = [],
): CommandCenterTask[] {
  const tasks: CommandCenterTask[] = [];
  const now = Date.now();
  const STALE_DRAFT_DAYS = 14;
  const STALE_REFRESH_MONTHS = 12;

  // 1. PREPARE_JD — org-chart positions without a JD
  for (const gap of orgChartGaps) {
    tasks.push({
      id: `prepare:${gap.positionId}`,
      kind: 'PREPARE_JD',
      title: `Prepare JD: ${gap.positionTitle}`,
      description: 'This position appears in the org chart but has no Job Description on file.',
      priority: 'high',
      href: `/jd/new?jobTitle=${encodeURIComponent(gap.positionTitle)}`,
    });
  }

  for (const jd of jds) {
    if (jd.status === 'ARCHIVED') continue;
    const updatedAt = typeof jd.updatedAt === 'string' ? new Date(jd.updatedAt) : jd.updatedAt;
    const ageDays = Math.floor((now - updatedAt.getTime()) / 86_400_000);

    // 2. REVIEW_JD — DRAFT for too long
    if (jd.status === 'DRAFT' && ageDays >= STALE_DRAFT_DAYS) {
      tasks.push({
        id: `review:${jd.id}`,
        kind: 'REVIEW_JD',
        title: jd.jobTitle || 'Untitled',
        description: `Draft has not been touched in ${ageDays} days. Review and move to "Under revision" or approve.`,
        priority: ageDays >= 60 ? 'high' : 'medium',
        jdId: jd.id,
        jdTitle: jd.jobTitle,
        href: `/jd/${jd.id}`,
        observedAt: updatedAt.toISOString(),
      });
    }

    // 3. APPROVE_JD — Under revision, waiting on someone
    if (jd.status === 'UNDER_REVISION') {
      tasks.push({
        id: `approve:${jd.id}`,
        kind: 'APPROVE_JD',
        title: jd.jobTitle || 'Untitled',
        description: 'Under revision — waiting for final approval.',
        priority: ageDays >= 14 ? 'high' : 'medium',
        jdId: jd.id,
        jdTitle: jd.jobTitle,
        href: `/jd/${jd.id}`,
        observedAt: updatedAt.toISOString(),
      });
    }

    // 4. SEND_FOR_EVALUATION — Approved but no eval
    if (jd.status === 'APPROVED' && !jd.hasEval) {
      tasks.push({
        id: `send-eval:${jd.id}`,
        kind: 'SEND_FOR_EVALUATION',
        title: jd.jobTitle || 'Untitled',
        description: 'Approved JD has no evaluation score. Send to Axiomera for grading.',
        priority: 'high',
        jdId: jd.id,
        jdTitle: jd.jobTitle,
        href: `/jd/${jd.id}?action=evaluate`,
      });
    }

    // 5. PLACE_IN_MATRIX — Approved + evaluated but no slot
    if (jd.status === 'APPROVED' && jd.hasEval && !jd.hasSlot) {
      tasks.push({
        id: `place:${jd.id}`,
        kind: 'PLACE_IN_MATRIX',
        title: jd.jobTitle || 'Untitled',
        description: `Evaluated (${jd.evalScore ?? '?'}%) but not yet placed in the Job Architecture matrix.`,
        priority: 'medium',
        jdId: jd.id,
        jdTitle: jd.jobTitle,
        href: '/architecture',
      });
    }

    // 6. VERIFY_PLACEMENT — Slot grade doesn't match suggested grade
    if (jd.hasSlot && jd.hasEval && jd.evalScore != null && jd.slotLevel != null) {
      const suggested = Math.max(6, Math.min(30, Math.round(6 + (jd.evalScore / 100) * 24)));
      const drift = Math.abs(suggested - jd.slotLevel);
      if (drift >= 3) {
        tasks.push({
          id: `verify:${jd.id}`,
          kind: 'VERIFY_PLACEMENT',
          title: jd.jobTitle || 'Untitled',
          description: `Placed at grade ${jd.slotLevel}, but evaluation suggests grade ${suggested} (drift ${drift}). Verify placement.`,
          priority: drift >= 5 ? 'high' : 'medium',
          jdId: jd.id,
          jdTitle: jd.jobTitle,
          href: '/architecture',
        });
      }
    }

    // 7. REFRESH_JD — Approved but stale
    if (jd.status === 'APPROVED' && ageDays >= STALE_REFRESH_MONTHS * 30) {
      tasks.push({
        id: `refresh:${jd.id}`,
        kind: 'REFRESH_JD',
        title: jd.jobTitle || 'Untitled',
        description: `Approved ${Math.floor(ageDays / 30)} months ago. Consider refreshing for accuracy.`,
        priority: 'low',
        jdId: jd.id,
        jdTitle: jd.jobTitle,
        href: `/jd/${jd.id}`,
        observedAt: updatedAt.toISOString(),
      });
    }
  }

  // Sort: high priority first, then medium, then low; tiebreak by kind
  const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.kind.localeCompare(b.kind));

  return tasks;
}
