/**
 * Central AI wrapper. Every AI call in Ultra MUST go through this.
 *
 * Responsibilities:
 *  - Resolve model tier -> modelId from MODEL_REGISTRY
 *  - Estimate input tokens before the call (rough heuristic ~4 chars/token)
 *  - Call provider (Anthropic for now; OpenAI hook reserved)
 *  - Parse usage from response if available; fall back to estimates
 *  - Compute estimatedCostUsd from current pricing
 *  - Insert a row into AiUsageLog (insert-only)
 *  - Return { text, inputTokens, outputTokens, estimatedCostUsd, durationMs, cacheStatus }
 *
 * Failures still log a row (status='error') so retries don't hide cost.
 */

import { db } from '@jd-suite/db';
import {
  MODEL_REGISTRY,
  defaultTierFor,
  estimateCost,
  type ModelEntry,
  type ModelTier,
} from './model-registry';
import { promptVersionFor } from './prompt-versions';

export interface CallAiContext {
  orgId?: string;
  userId?: string;
  jdId?: string;
  programId?: string;
}

export interface CallAiOptions {
  operation: string;
  tier?: ModelTier;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  context?: CallAiContext;
  /** Reserved for Phase 6 caching layer. Currently unused. */
  cacheKey?: string;
}

export interface CallAiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  cacheStatus: 'hit' | 'miss' | 'n/a';
  modelId: string;
  modelTier: ModelTier;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function estimateTokens(s: string): number {
  // Rough: 4 characters per token. Underestimates code, overestimates compact text.
  return Math.ceil(s.length / 4);
}

async function callAnthropic(
  model: ModelEntry,
  opts: CallAiOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const body: Record<string, unknown> = {
    model: model.modelId,
    max_tokens: opts.maxTokens ?? 3000,
    temperature: opts.temperature ?? 0,
    messages: [{ role: 'user', content: opts.userPrompt }],
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as AnthropicResponse;
  const block = data.content?.[0];
  const text = block?.type === 'text' ? (block.text ?? '') : '';
  const inputTokens = data.usage?.input_tokens ?? estimateTokens(opts.userPrompt + (opts.systemPrompt ?? ''));
  const outputTokens = data.usage?.output_tokens ?? estimateTokens(text);
  return { text, inputTokens, outputTokens };
}

async function logUsage(args: {
  operation: string;
  model: ModelEntry;
  promptVersion: string;
  context?: CallAiContext;
  inputTokensEstimate: number;
  inputTokensActual: number | null;
  outputTokensEstimate: number;
  outputTokensActual: number | null;
  estimatedCostUsd: number;
  durationMs: number;
  status: 'ok' | 'error';
  errorMessage?: string;
  cacheStatus: 'hit' | 'miss' | 'n/a';
  cacheKey?: string;
}): Promise<void> {
  // Use any to bypass strict typing until prisma client regenerated post-migration.
  // The model is created in this same Phase 1 migration.
  const dbAny = db as unknown as { aiUsageLog?: { create: (args: unknown) => Promise<unknown> } };
  if (!dbAny.aiUsageLog) {
    // Migration not yet applied — skip logging (still works at dev-time).
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[callAi] AiUsageLog model not present; skipping log row');
    }
    return;
  }
  try {
    await dbAny.aiUsageLog.create({
      data: {
        operation: args.operation,
        modelId: args.model.modelId,
        modelTier: args.model.tier,
        promptVersion: args.promptVersion,
        orgId: args.context?.orgId ?? null,
        userId: args.context?.userId ?? null,
        jdId: args.context?.jdId ?? null,
        programId: args.context?.programId ?? null,
        inputTokensEstimate: args.inputTokensEstimate,
        inputTokensActual: args.inputTokensActual,
        outputTokensEstimate: args.outputTokensEstimate,
        outputTokensActual: args.outputTokensActual,
        estimatedCostUsd: args.estimatedCostUsd,
        cacheStatus: args.cacheStatus,
        cacheKey: args.cacheKey ?? null,
        durationMs: args.durationMs,
        status: args.status,
        errorMessage: args.errorMessage ?? null,
      },
    });
  } catch (e) {
    // Never let logging failures crash the AI call.
    // eslint-disable-next-line no-console
    console.error('[callAi] failed to write AiUsageLog row:', e);
  }
}

export async function callAi(opts: CallAiOptions): Promise<CallAiResult> {
  const start = Date.now();
  const tier = opts.tier ?? defaultTierFor(opts.operation);
  const model = MODEL_REGISTRY[tier];
  const promptVersion = promptVersionFor(opts.operation);

  const inputTokensEstimate = estimateTokens(opts.userPrompt + (opts.systemPrompt ?? ''));

  if (model.tier === 'deterministic') {
    // Operation is non-AI; log a zero-cost row for cost visibility and return empty text.
    const durationMs = Date.now() - start;
    await logUsage({
      operation: opts.operation,
      model,
      promptVersion,
      context: opts.context,
      inputTokensEstimate: 0,
      inputTokensActual: 0,
      outputTokensEstimate: 0,
      outputTokensActual: 0,
      estimatedCostUsd: 0,
      durationMs,
      status: 'ok',
      cacheStatus: 'n/a',
    });
    return {
      text: '',
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      durationMs,
      cacheStatus: 'n/a',
      modelId: model.modelId,
      modelTier: model.tier,
    };
  }

  let response;
  try {
    response = await callAnthropic(model, opts);
  } catch (e) {
    const durationMs = Date.now() - start;
    const cost = estimateCost(model, inputTokensEstimate, 0);
    await logUsage({
      operation: opts.operation,
      model,
      promptVersion,
      context: opts.context,
      inputTokensEstimate,
      inputTokensActual: null,
      outputTokensEstimate: 0,
      outputTokensActual: null,
      estimatedCostUsd: cost,
      durationMs,
      status: 'error',
      errorMessage: e instanceof Error ? e.message : String(e),
      cacheStatus: 'miss',
    });
    throw e;
  }

  const durationMs = Date.now() - start;
  const cost = estimateCost(model, response.inputTokens, response.outputTokens);

  await logUsage({
    operation: opts.operation,
    model,
    promptVersion,
    context: opts.context,
    inputTokensEstimate,
    inputTokensActual: response.inputTokens,
    outputTokensEstimate: estimateTokens(response.text),
    outputTokensActual: response.outputTokens,
    estimatedCostUsd: cost,
    durationMs,
    status: 'ok',
    cacheStatus: 'miss',
  });

  return {
    text: response.text,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    estimatedCostUsd: cost,
    durationMs,
    cacheStatus: 'miss',
    modelId: model.modelId,
    modelTier: model.tier,
  };
}

/** Extract JSON object from Claude text response. Handles markdown fences. */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(jsonText) as T;
}
