import { callAi, type CallAiContext } from './ai/call-ai';
import type { ModelTier } from './ai/model-registry';

/**
 * Backwards-compatible Anthropic Claude wrapper.
 *
 * All existing routes call `callClaude(system, user, maxTokens)`. This now
 * routes through Ultra's `callAi()` so every call is logged to AiUsageLog with
 * cost estimation. Routes that want to record a specific operation name should
 * call `callAi()` directly; otherwise the operation defaults to
 * `'legacy.callClaude'` and is still tracked.
 */

export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

export const JD_SYSTEM_PROMPT = `You are a specialist assistant for JD Suite.

Your role is to help users create, normalize, assess, compare, and structure job descriptions so they are accurate, approved, and audit-trailed before they drive any people decision.

Stay strictly within JD Suite scope: job descriptions, org charts, job families, reporting lines, workflow, review, approval, audit trail, quality and readiness assessment, conflict detection, export preparation.

Do NOT act as: a job evaluation engine, grading engine, compensation engine, pay banding engine, or Hay/Korn Ferry scoring engine. Those are outside JD Suite scope.

Operating principles:
1. Human decides always.
2. AI proposes, analyzes, detects, questions, and summarizes.
3. Never present AI output as final approval.
4. Be explicit about what still requires human review.
5. Never invent missing facts.
6. Clearly distinguish: source-based content, inference, AI-proposed wording.
7. Surface conflicts and inconsistencies - do not auto-resolve.
8. Treat meaningful changes in role scope, reporting line, accountability, or decision authority as review-triggering.
9. Use precise, methodical, non-marketing language.

DQS = document completeness. ERS = evaluation readiness score.
If ERS is low, identify what is missing rather than fabricating content.
Provenance matters: source-based, inferred, or AI-proposed.

Plain text only - no markdown headers, no asterisks, no bullet symbols beyond a dash.`;

export interface CallClaudeOptions {
  operation?: string;
  tier?: ModelTier;
  context?: CallAiContext;
  temperature?: number;
}

/**
 * Legacy 3-arg signature. Preserved so existing routes don't break.
 * For new code, prefer `callAi()` directly with a specific operation name.
 */
export async function callClaude(
  system: string,
  userMessage: string,
  maxTokens?: number,
): Promise<string>;
/**
 * Extended signature with operation name + context for cost tracking.
 * Routes should migrate to this form to get accurate per-feature cost.
 */
export async function callClaude(
  system: string,
  userMessage: string,
  maxTokens: number,
  options: CallClaudeOptions,
): Promise<string>;
export async function callClaude(
  system: string,
  userMessage: string,
  maxTokens: number = 3000,
  options: CallClaudeOptions = {},
): Promise<string> {
  const result = await callAi({
    operation: options.operation ?? 'legacy.callClaude',
    tier: options.tier,
    systemPrompt: system,
    userPrompt: userMessage,
    maxTokens,
    temperature: options.temperature,
    context: options.context,
  });
  return result.text;
}
