/**
 * Nexus Final — Model Router
 *
 * Updated to Gemini 3.x generation (May 2026):
 *   DEFAULT:    gemini-3.5-flash         (standard + free plans)
 *   PREMIUM:    gemini-3.1-pro-preview   (enterprise + white_label)
 *   ECONOMY:    gemini-3.1-flash-lite    (scanner bulk calls)
 *   FALLBACK:   gemini-2.5-flash         (GA stable)
 *   LEGACY GPT: gpt-4o                   (if OPENAI_API_KEY set, no Gemini key)
 *
 * NOTE: gemini-pro / gemini-flash (1.x) are deprecated — removed entirely.
 *       gemini-2.0-flash retiring June 2026 — not used.
 */
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('ModelRouter');

export type ModelId =
  | 'gemini-3.5-flash'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gpt-4o'
  | 'local';

export interface ModelConfig {
  id:           ModelId;
  apiName:      string;
  maxTokens:    number;
  costPer1kIn:  number;
  costPer1kOut: number;
  tier:         'economy' | 'standard' | 'premium';
  plans:        string[];
}

export const MODELS: Record<ModelId, ModelConfig> = {
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash', apiName: 'gemini-3.5-flash',
    maxTokens: 65536, costPer1kIn: 0.000075, costPer1kOut: 0.0003,
    tier: 'standard', plans: ['free','starter','growth','pro','enterprise','white_label'],
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview', apiName: 'gemini-3.1-pro-preview',
    maxTokens: 65536, costPer1kIn: 0.00125, costPer1kOut: 0.01,
    tier: 'premium', plans: ['enterprise','white_label'],
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite', apiName: 'gemini-3.1-flash-lite',
    maxTokens: 32768, costPer1kIn: 0.000025, costPer1kOut: 0.0001,
    tier: 'economy', plans: ['free','starter','growth','pro','enterprise','white_label'],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash', apiName: 'gemini-2.5-flash',
    maxTokens: 32768, costPer1kIn: 0.000075, costPer1kOut: 0.0003,
    tier: 'standard', plans: ['free','starter','growth','pro','enterprise','white_label'],
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', apiName: 'gemini-2.5-pro',
    maxTokens: 65536, costPer1kIn: 0.00125, costPer1kOut: 0.01,
    tier: 'premium', plans: ['enterprise','white_label'],
  },
  'gpt-4o': {
    id: 'gpt-4o', apiName: 'gpt-4o',
    maxTokens: 4096, costPer1kIn: 0.005, costPer1kOut: 0.015,
    tier: 'premium', plans: ['pro','enterprise','white_label'],
  },
  'local': {
    id: 'local', apiName: 'local',
    maxTokens: 1024, costPer1kIn: 0, costPer1kOut: 0,
    tier: 'economy', plans: ['free','starter','growth','pro','enterprise','white_label'],
  },
};

export class ModelRouter {
  selectModel(plan = 'free', use: 'default'|'scanner'|'premium' = 'default'): ModelId {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    if (geminiKey) {
      if (use === 'scanner')  return 'gemini-3.1-flash-lite';
      if (use === 'premium' || ['enterprise','white_label'].includes(plan)) return 'gemini-3.1-pro-preview';
      return 'gemini-2.5-flash';
    }
    if (openAiKey) return 'gpt-4o';
    return 'local';
  }

  async call(model: ModelId, system: string, user: string, maxTokens = 800): Promise<string> {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    try {
      if (model.startsWith('gemini') && geminiKey) return await this._callGemini(model, system, user, maxTokens, geminiKey);
      if (model === 'gpt-4o' && openAiKey) return await this._callOpenAI(model, system, user, maxTokens, openAiKey);
    } catch (err: any) {
      logger.warn(`[ModelRouter] ${model} failed: ${err.message} — cascading`);
    }
    // Fallback cascade
    const cascade: ModelId[] = ['gemini-2.5-flash','gemini-2.5-pro'];
    if (geminiKey) {
      for (const fb of cascade) {
        if (fb === model) continue;
        try { return await this._callGemini(fb, system, user, maxTokens, geminiKey); } catch {}
      }
    }
    return 'AI analysis unavailable. Configure GEMINI_API_KEY to enable AI features.';
  }

  async streamUrl(model: ModelId, key: string): Promise<string> {
    const name = MODELS[model]?.apiName ?? 'gemini-3.5-flash';
    return `https://generativelanguage.googleapis.com/v1beta/models/${name}:streamGenerateContent?alt=sse&key=${key}`;
  }

  private async _callGemini(model: ModelId, system: string, user: string, maxTokens: number, key: string): Promise<string> {
    const apiName = MODELS[model]?.apiName ?? 'gemini-3.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiName}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, topP: 0.95 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${apiName} error ${res.status}: ${(await res.text()).slice(0,200)}`);
    const data = await res.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Empty response from ${apiName}`);
    return text;
  }

  private async _callOpenAI(model: ModelId, system: string, user: string, maxTokens: number, key: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODELS[model].apiName, messages: [{ role: 'system', content: system },{ role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.7 }),
    });
    const data = await res.json() as any;
    return data?.choices?.[0]?.message?.content ?? 'No response from OpenAI.';
  }
}
