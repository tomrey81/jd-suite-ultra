/**
 * Tiny word-level diff — no external deps.
 * Returns segments tagged 'eq' | 'add' | 'del'.
 */
export type DiffSegment = { op: 'eq' | 'add' | 'del'; text: string };

export function wordDiff(a: string, b: string): DiffSegment[] {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  const n = A.length;
  const m = B.length;

  // LCS matrix
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const segs: DiffSegment[] = [];
  let i = n, j = m;
  const push = (op: DiffSegment['op'], text: string) => {
    const last = segs[segs.length - 1];
    if (last && last.op === op) last.text = text + last.text;
    else segs.unshift({ op, text });
  };
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) { push('eq', A[i - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { push('del', A[i - 1]); i--; }
    else { push('add', B[j - 1]); j--; }
  }
  while (i > 0) { push('del', A[i - 1]); i--; }
  while (j > 0) { push('add', B[j - 1]); j--; }

  return segs;
}
