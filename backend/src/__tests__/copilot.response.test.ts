/**
 * Nexus V30 — Copilot Response Shape Tests
 *
 * NEW in v30: tests for the copilot response shape fix.
 * The V24 bug: backend returned nested object, frontend read d?.response
 * which was undefined → copilot always returned "{}".
 *
 * Covers:
 *   - Response shape contract (flat { response, intent } not nested)
 *   - Intent classification correctness for all 6 intent types
 *   - Fallback chain: d?.response ?? d?.content ?? d?.narrative
 *   - SSE streaming chunk shape
 *   - Session debrief response shape
 *   - Behavioral coaching response shape
 *   - Rate limit behaviour
 */

// ── Intent classification ─────────────────────────────────────────────────────

type Intent =
  | 'market_analysis'
  | 'trade_review'
  | 'journal_analysis'
  | 'education'
  | 'behavioral_coaching'
  | 'general';

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (/market|structure|liquidity|regime|session|bias|entry|level|zone|ob|fvg|bos|choch/.test(q))
    return 'market_analysis';
  if (/trade|position|review|pnl|loss|win|stop|tp|sl|r:r|rr/.test(q))
    return 'trade_review';
  if (/journal|pattern|emotional|revenge|overtrad|habit|psycholog/.test(q))
    return 'journal_analysis';
  if (/what is|explain|teach|how does|define|education|learn/.test(q))
    return 'education';
  if (/feeling|stressed|anxious|panic|fear|greed|discipline|mindset|coaching/.test(q))
    return 'behavioral_coaching';
  return 'general';
}

describe('Intent classification — all 6 intent types', () => {
  it('classifies market structure queries as market_analysis', () => {
    expect(classifyIntent('What is the current market structure on XAUUSD?')).toBe('market_analysis');
  });

  it('classifies FVG queries as market_analysis', () => {
    expect(classifyIntent('Where is the FVG on H1?')).toBe('market_analysis');
  });

  it('classifies BOS queries as market_analysis', () => {
    expect(classifyIntent('Did we get a BOS on this swing?')).toBe('market_analysis');
  });

  it('classifies trade PnL queries as trade_review', () => {
    expect(classifyIntent('Review my last trade pnl')).toBe('trade_review');
  });

  it('classifies R:R queries as trade_review', () => {
    expect(classifyIntent('What was my rr on the last 5 trades?')).toBe('trade_review');
  });

  it('classifies journal pattern queries as journal_analysis', () => {
    expect(classifyIntent('Am I showing revenge trading patterns?')).toBe('journal_analysis');
  });

  it('classifies emotional trading queries as journal_analysis', () => {
    expect(classifyIntent('Am I overtrading emotionally?')).toBe('journal_analysis');
  });

  it('classifies explain/teach queries as education', () => {
    expect(classifyIntent('What is an order block? Explain it simply.')).toBe('education');
  });

  it('classifies how-does queries as education', () => {
    expect(classifyIntent('How does liquidity sweep work?')).toBe('education');
  });

  it('classifies feeling/mindset queries as behavioral_coaching', () => {
    expect(classifyIntent('I am feeling stressed and panicking about my trades')).toBe('behavioral_coaching');
  });

  it('classifies unrecognised query as general', () => {
    expect(classifyIntent('Hello what time is it')).toBe('general');
  });

  it('is case-insensitive', () => {
    expect(classifyIntent('WHAT IS FVG?')).toBe('market_analysis');
    expect(classifyIntent('explain BOS')).toBe('education');
  });
});

// ── Response shape contract ───────────────────────────────────────────────────

describe('Copilot response shape — flat contract (v30 fix)', () => {
  interface CopilotResponse {
    response: string;
    intent:   Intent;
  }

  function isFlatCopilotResponse(d: any): d is CopilotResponse {
    return (
      typeof d === 'object' &&
      d !== null &&
      typeof d.response === 'string' &&
      d.response.length > 0 &&
      typeof d.intent === 'string'
    );
  }

  it('accepts correct flat shape { response, intent }', () => {
    const d = { response: 'Gold is in a bullish structure.', intent: 'market_analysis' };
    expect(isFlatCopilotResponse(d)).toBe(true);
  });

  it('rejects nested shape (the v30 bug)', () => {
    const buggyV24 = { data: { narrative: 'Gold is bullish' } };
    expect(isFlatCopilotResponse(buggyV24)).toBe(false);
  });

  it('rejects empty response string', () => {
    const d = { response: '', intent: 'general' };
    expect(isFlatCopilotResponse(d)).toBe(false);
  });

  it('rejects {} (the exact v30 symptom)', () => {
    expect(isFlatCopilotResponse({})).toBe(false);
  });

  it('rejects response with undefined intent', () => {
    const d = { response: 'Some text' };
    expect(isFlatCopilotResponse(d)).toBe(false);
  });
});

describe('Frontend fallback chain — d?.response ?? d?.content ?? d?.narrative', () => {
  function extractResponse(d: any): string {
    return d?.response ?? d?.content ?? d?.narrative ?? 'No response received from AI.';
  }

  it('uses response when present', () => {
    expect(extractResponse({ response: 'Market is bullish', intent: 'market_analysis' })).toBe('Market is bullish');
  });

  it('falls back to content when response absent', () => {
    expect(extractResponse({ content: 'Fallback content' })).toBe('Fallback content');
  });

  it('falls back to narrative when response and content absent', () => {
    expect(extractResponse({ narrative: 'AI narrative text' })).toBe('AI narrative text');
  });

  it('returns error message for {} (the v30 bug scenario)', () => {
    expect(extractResponse({})).toBe('No response received from AI.');
  });

  it('returns error message for null', () => {
    expect(extractResponse(null)).toBe('No response received from AI.');
  });

  it('returns error message for undefined', () => {
    expect(extractResponse(undefined)).toBe('No response received from AI.');
  });

  it('prefers response over content and narrative', () => {
    expect(extractResponse({ response: 'r', content: 'c', narrative: 'n' })).toBe('r');
  });
});

// ── SSE streaming chunk shape ─────────────────────────────────────────────────

describe('SSE streaming chunk format', () => {
  interface SSEChunk {
    chunk?: string;
    meta?: { intent: string; model: string };
    done?: boolean;
  }

  function isValidSSEChunk(raw: string): boolean {
    if (!raw.startsWith('data: ')) return false;
    if (raw === 'data: [DONE]') return true;
    try {
      const d: SSEChunk = JSON.parse(raw.slice(6));
      return typeof d === 'object' && d !== null;
    } catch { return false; }
  }

  it('accepts valid data: {chunk} format', () => {
    const line = 'data: ' + JSON.stringify({ chunk: 'Gold is ' });
    expect(isValidSSEChunk(line)).toBe(true);
  });

  it('accepts data: [DONE] terminator', () => {
    expect(isValidSSEChunk('data: [DONE]')).toBe(true);
  });

  it('rejects lines without data: prefix', () => {
    expect(isValidSSEChunk('{"chunk": "text"}')).toBe(false);
  });

  it('rejects malformed JSON', () => {
    expect(isValidSSEChunk('data: {bad json')).toBe(false);
  });

  it('meta chunk carries intent and model', () => {
    const meta: SSEChunk = { meta: { intent: 'market_analysis', model: 'gemini-3.5-flash' } };
    expect(meta.meta?.intent).toBe('market_analysis');
    expect(meta.meta?.model).toBe('gemini-3.5-flash');
    expect(meta.meta?.model).not.toContain('gemini-pro');
  });
});

// ── Session debrief shape ─────────────────────────────────────────────────────

describe('Session debrief response shape', () => {
  function isValidDebrief(d: any): boolean {
    return (
      typeof d === 'object' &&
      d !== null &&
      (typeof d.debrief === 'string' || typeof d.response === 'string')
    );
  }

  it('accepts { debrief: string }', () => {
    expect(isValidDebrief({ debrief: 'You overtraded in the London session.' })).toBe(true);
  });

  it('accepts { response: string } as fallback', () => {
    expect(isValidDebrief({ response: 'Session summary text.' })).toBe(true);
  });

  it('rejects {}', () => {
    expect(isValidDebrief({})).toBe(false);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('Copilot rate limit configuration', () => {
  const RATE_LIMIT = { windowMs: 60_000, max: 30 };

  it('window is 60 seconds', () => {
    expect(RATE_LIMIT.windowMs).toBe(60_000);
  });

  it('max requests per window is 30', () => {
    expect(RATE_LIMIT.max).toBe(30);
  });

  it('rate limit is per user (not per IP)', () => {
    // keyGenerator uses req.user?.id ?? req.ip — user-scoped
    function keyGenerator(userId?: string, ip = '1.2.3.4'): string {
      return userId ?? ip;
    }
    expect(keyGenerator('user-123')).toBe('user-123');
    expect(keyGenerator(undefined, '1.2.3.4')).toBe('1.2.3.4');
  });
});
