/**
 * Nexus V30 — AI Narrative Engine (with streaming + prompt versioning)
 *
 * Generates market narratives, war room intelligence, and trade reasoning.
 * - Streaming: uses SSE-compatible async generators for low-latency responses
 * - Prompt versioning: all prompts managed via PromptOrchestrator (versioned)
 * - Model routing: plan-aware via ModelRouter
 * - Token budgeting: per-request maxTokens cap
 * - Fallback chain: Gemini → OpenAI → local
 */

import { Logger }             from '../../shared/helpers/logger';
import { ModelRouter }        from '../model-routing/index';
import { PromptOrchestrator } from '../prompt-orchestration/index';
import type { PromptKey }     from '../prompt-orchestration/index';

const logger           = new Logger('NarrativeEngine');
const modelRouter      = new ModelRouter();
const promptOrchestrator = new PromptOrchestrator();

export interface NarrativeRequest {
  instrument:  string;
  timeframe:   number;
  price:       number;
  structure?:  string;
  liquidity?:  string;
  fvgs?:       string;
  obs?:        string;
  session?:    string;
  regime?:     string;
  confluence?: number;
  signal?:     string;
  entry?:      number | null;
  sl?:         number | null;
  rr?:         string | null;
  plan?:       'free' | 'pro' | 'enterprise';
}

export interface NarrativeResponse {
  narrative:   string;
  brief:       string;
  riskNote:    string;
  model:       string;
  promptKey:   string;
  promptVersion: number;
  tokensUsed?: number;
}

export class NarrativeEngine {
  async generate(req: NarrativeRequest): Promise<NarrativeResponse> {
    const model   = modelRouter.selectModel(req.plan ?? 'free');
    const { system, user } = promptOrchestrator.build('market_narrative', {
      sym:       req.instrument,
      tf:        req.timeframe,
      price:     req.price,
      session:   req.session ?? 'Unknown',
      regime:    req.regime  ?? 'Unknown',
      confluence:req.confluence ?? 0,
      bias:      req.signal  ?? 'NEUTRAL',
      structure: req.structure ?? 'Unknown',
      liquidity: req.liquidity ?? 'Unknown',
      entry:     req.entry,
      sl:        req.sl,
      rr:        req.rr,
    });

    try {
      const raw    = await modelRouter.call(model, system, user, 500);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return {
        narrative:     parsed.narrative   ?? 'Analysis unavailable.',
        brief:         parsed.brief       ?? '',
        riskNote:      parsed.riskNote    ?? 'Monitor session transitions.',
        model,
        promptKey:     'market_narrative',
        promptVersion: 3,
      };
    } catch (err: any) {
      logger.warn(`NarrativeEngine failed (${model}): ${err.message}`);
      return this._fallback(req, model);
    }
  }

  /**
   * Streaming narrative generation using async generator.
   * Caller pipes this to an SSE response.
   *
   * Usage:
   *   for await (const chunk of engine.stream(req)) {
   *     res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
   *   }
   */
  async *stream(req: NarrativeRequest): AsyncGenerator<string> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      yield this._fallback(req, 'local').narrative;
      return;
    }

    const { system, user } = promptOrchestrator.build('market_narrative', {
      sym:       req.instrument,
      tf:        req.timeframe,
      price:     req.price,
      session:   req.session ?? 'Unknown',
      regime:    req.regime  ?? 'Unknown',
      confluence:req.confluence ?? 0,
      bias:      req.signal  ?? 'NEUTRAL',
      structure: req.structure ?? 'Unknown',
      liquidity: req.liquidity ?? 'Unknown',
    });

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?alt=sse&key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents:           [{ parts: [{ text: user }] }],
          generationConfig:   { maxOutputTokens: 500, temperature: 0.7 },
        }),
      });

      if (!res.body) { yield this._fallback(req, 'gemini-pro').narrative; return; }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (text) yield text;
          } catch {}
        }
      }
    } catch (err: any) {
      logger.warn(`Streaming failed: ${err.message}`);
      yield this._fallback(req, 'gemini-pro').narrative;
    }
  }

  async analyzePrompt(prompt: string, maxTokens = 600): Promise<{ text: string; model: string }> {
    const model = modelRouter.selectModel('free');
    const { system } = promptOrchestrator.build('market_narrative', {});
    try {
      const raw = await modelRouter.call(model, system, prompt, maxTokens);
      return { text: raw, model };
    } catch {
      return { text: 'AI analysis unavailable. Add an API key in settings.', model: 'local' };
    }
  }

  private _fallback(req: NarrativeRequest, model: string): NarrativeResponse {
    return {
      narrative: `${req.instrument} is trading at ${req.price}. SMC analysis running — add a Gemini or OpenAI API key for AI narratives.`,
      brief:     'SMC analysis active. AI narrative requires API key.',
      riskNote:  'Monitor session transitions and high-impact news.',
      model,
      promptKey:     'market_narrative',
      promptVersion: 3,
    };
  }
}
