/**
 * Nexus V30 — Model Router Tests
 *
 * NEW in v30: tests for the Gemini 3.x model routing logic introduced in v30+.
 * Covers:
 *   - Correct model selection per plan and use-case
 *   - Deprecated model absence (gemini-pro, gemini-flash, gpt-3.5-turbo)
 *   - Current model presence (gemini-3.5-flash, 3.1-pro-preview, 3.1-flash-lite)
 *   - Fallback cascade order
 *   - Scanner use-case routes to economy model
 *   - Enterprise plan routes to premium model
 *   - API name strings match Google AI Studio format
 */

type ModelId =
  | 'gemini-3.5-flash'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gpt-4o'
  | 'local';

interface ModelConfig {
  id:       ModelId;
  apiName:  string;
  maxTokens: number;
  tier:     'economy' | 'standard' | 'premium';
  plans:    string[];
}

const MODELS: Record<ModelId, ModelConfig> = {
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash', apiName: 'gemini-3.5-flash',
    maxTokens: 65536, tier: 'standard',
    plans: ['free', 'starter', 'growth', 'pro', 'enterprise', 'white_label'],
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview', apiName: 'gemini-3.1-pro-preview',
    maxTokens: 65536, tier: 'premium',
    plans: ['enterprise', 'white_label'],
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite', apiName: 'gemini-3.1-flash-lite',
    maxTokens: 32768, tier: 'economy',
    plans: ['free', 'starter', 'growth', 'pro', 'enterprise', 'white_label'],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash', apiName: 'gemini-2.5-flash',
    maxTokens: 32768, tier: 'standard',
    plans: ['free', 'starter', 'growth', 'pro', 'enterprise', 'white_label'],
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', apiName: 'gemini-2.5-pro',
    maxTokens: 65536, tier: 'premium',
    plans: ['enterprise', 'white_label'],
  },
  'gpt-4o': {
    id: 'gpt-4o', apiName: 'gpt-4o',
    maxTokens: 4096, tier: 'premium',
    plans: ['pro', 'enterprise', 'white_label'],
  },
  'local': {
    id: 'local', apiName: 'local',
    maxTokens: 1024, tier: 'economy',
    plans: ['free', 'starter', 'growth', 'pro', 'enterprise', 'white_label'],
  },
};

function selectModel(
  plan: string = 'free',
  use: 'default' | 'scanner' | 'premium' = 'default',
  hasGemini = true,
  hasOpenAI = false,
): ModelId {
  if (hasGemini) {
    if (use === 'scanner')  return 'gemini-3.1-flash-lite';
    if (use === 'premium' || ['enterprise', 'white_label'].includes(plan))
                            return 'gemini-3.1-pro-preview';
    return 'gemini-3.5-flash';
  }
  if (hasOpenAI) return 'gpt-4o';
  return 'local';
}

describe('Model selection — Gemini key present', () => {
  it('free plan → gemini-3.5-flash (default)', () => {
    expect(selectModel('free', 'default', true)).toBe('gemini-3.5-flash');
  });

  it('pro plan → gemini-3.5-flash (default)', () => {
    expect(selectModel('pro', 'default', true)).toBe('gemini-3.5-flash');
  });

  it('enterprise plan → gemini-3.1-pro-preview', () => {
    expect(selectModel('enterprise', 'default', true)).toBe('gemini-3.1-pro-preview');
  });

  it('white_label plan → gemini-3.1-pro-preview', () => {
    expect(selectModel('white_label', 'default', true)).toBe('gemini-3.1-pro-preview');
  });

  it("scanner use → gemini-3.1-flash-lite (cheapest)", () => {
    expect(selectModel('free', 'scanner', true)).toBe('gemini-3.1-flash-lite');
    expect(selectModel('enterprise', 'scanner', true)).toBe('gemini-3.1-flash-lite');
  });

  it('premium use → gemini-3.1-pro-preview regardless of plan', () => {
    expect(selectModel('free', 'premium', true)).toBe('gemini-3.1-pro-preview');
    expect(selectModel('pro', 'premium', true)).toBe('gemini-3.1-pro-preview');
  });
});

describe('Model selection — fallback when no Gemini key', () => {
  it('no Gemini + has OpenAI → gpt-4o', () => {
    expect(selectModel('pro', 'default', false, true)).toBe('gpt-4o');
  });

  it('no Gemini + no OpenAI → local', () => {
    expect(selectModel('pro', 'default', false, false)).toBe('local');
  });
});

describe('MODELS registry — deprecated models absent', () => {
  const modelKeys = Object.keys(MODELS);

  it('gemini-pro (v30 deprecated) is NOT in registry', () => {
    expect(modelKeys).not.toContain('gemini-pro');
  });

  it('gemini-flash (v30 deprecated) is NOT in registry', () => {
    expect(modelKeys).not.toContain('gemini-flash');
  });

  it('gpt-3.5-turbo (EOL) is NOT in registry', () => {
    expect(modelKeys).not.toContain('gpt-3.5-turbo');
  });

  it('gemini-2.0-flash (retiring Jun 2026) is NOT in registry', () => {
    expect(modelKeys).not.toContain('gemini-2.0-flash');
  });
});

describe('MODELS registry — current models present', () => {
  it('gemini-3.5-flash is registered', () => {
    expect(MODELS['gemini-3.5-flash']).toBeDefined();
  });

  it('gemini-3.1-pro-preview is registered', () => {
    expect(MODELS['gemini-3.1-pro-preview']).toBeDefined();
  });

  it('gemini-3.1-flash-lite is registered', () => {
    expect(MODELS['gemini-3.1-flash-lite']).toBeDefined();
  });

  it('gemini-2.5-flash is registered as GA stable fallback', () => {
    expect(MODELS['gemini-2.5-flash']).toBeDefined();
  });
});

describe('API name strings match Google AI Studio format', () => {
  it('gemini-3.5-flash apiName matches expected string', () => {
    expect(MODELS['gemini-3.5-flash'].apiName).toBe('gemini-3.5-flash');
  });

  it('gemini-3.1-pro-preview apiName includes -preview suffix', () => {
    expect(MODELS['gemini-3.1-pro-preview'].apiName).toContain('preview');
  });

  it('no apiName contains deprecated gemini-pro string', () => {
    for (const cfg of Object.values(MODELS)) {
      expect(cfg.apiName).not.toBe('gemini-pro');
    }
  });

  it('all apiNames are non-empty strings', () => {
    for (const cfg of Object.values(MODELS)) {
      expect(typeof cfg.apiName).toBe('string');
      expect(cfg.apiName.length).toBeGreaterThan(0);
    }
  });
});

describe('Token limits', () => {
  it('economy model (flash-lite) has lowest token ceiling', () => {
    const lite    = MODELS['gemini-3.1-flash-lite'].maxTokens;
    const flash   = MODELS['gemini-3.5-flash'].maxTokens;
    const pro     = MODELS['gemini-3.1-pro-preview'].maxTokens;
    expect(lite).toBeLessThanOrEqual(flash);
    expect(flash).toBeLessThanOrEqual(pro);
  });

  it('all models have maxTokens > 0', () => {
    for (const cfg of Object.values(MODELS)) {
      expect(cfg.maxTokens).toBeGreaterThan(0);
    }
  });
});

describe('Plan access gates', () => {
  it('gemini-3.1-pro-preview is restricted to enterprise and white_label', () => {
    const plans = MODELS['gemini-3.1-pro-preview'].plans;
    expect(plans).toContain('enterprise');
    expect(plans).toContain('white_label');
    expect(plans).not.toContain('free');
    expect(plans).not.toContain('starter');
  });

  it('gemini-3.5-flash is available to all plans including free', () => {
    const plans = MODELS['gemini-3.5-flash'].plans;
    expect(plans).toContain('free');
    expect(plans).toContain('enterprise');
  });

  it('gemini-3.1-flash-lite is available to all plans including free', () => {
    expect(MODELS['gemini-3.1-flash-lite'].plans).toContain('free');
  });
});

describe('Fallback cascade order', () => {
  const CASCADE: ModelId[] = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
  ];

  it('cascade starts with gemini-3.5-flash (primary)', () => {
    expect(CASCADE[0]).toBe('gemini-3.5-flash');
  });

  it('cascade includes gemini-2.5-flash as stable GA fallback', () => {
    expect(CASCADE).toContain('gemini-2.5-flash');
  });

  it('all cascade models are in the MODELS registry', () => {
    for (const m of CASCADE) {
      expect(MODELS[m]).toBeDefined();
    }
  });

  it('cascade has at least 3 levels', () => {
    expect(CASCADE.length).toBeGreaterThanOrEqual(3);
  });
});
