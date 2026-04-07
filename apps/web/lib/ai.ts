import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

export const JD_SYSTEM_PROMPT = `You are GPTs-JD-Suite_v4, a specialist assistant for JD Suite by Quadrance.

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

export async function callClaude(
  system: string,
  userMessage: string,
  maxTokens: number = 3000,
): Promise<string> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text;
}
