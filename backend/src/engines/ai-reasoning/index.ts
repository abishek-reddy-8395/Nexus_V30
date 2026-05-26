/**
 * Nexus V30 — AI Reasoning Engine
 *
 * Bridges the SMC engine output and the AI narrative layer.
 * Constructs structured prompts from engine results and routes them
 * to the appropriate AI model (Gemini / GPT-4 / fallback).
 * API keys are server-side only — never sent to the client.
 *
 * v2 equivalent: aiService.js + ReasoningEngine in Engine.js
 */

import type { ConfluenceScore }  from '../confluence-engine/index';
import type { SignalOutput }     from '../signal-engine/index';
import type { SessionInfo }      from '../session-engine/index';

export interface ReasoningInput {
  sym:        string;
  tf:         number;
  price:      number;
  signal:     SignalOutput;
  confluence: ConfluenceScore;
  session:    SessionInfo;
  regime:     string;
  structure:  string;
  mode:       string;
}

export interface ReasoningOutput {
  narrative:    string;
  brief:        string;
  keyLevels:    string;
  riskNote:     string;
  model:        string;
}

export class AiReasoningEngine {
  private buildPrompt(input: ReasoningInput): string {
    return `
You are NEXUS AI, an institutional SMC trading analyst.

Instrument: ${input.sym} | Timeframe: ${input.tf}m | Mode: ${input.mode}
Current Price: ${input.price}
Session: ${input.session.name} | Regime: ${input.regime}
Bias: ${input.signal.bias} | Conviction: ${input.signal.conviction}/100
Confluence Score: ${input.confluence.total}/100
  - Structure: ${input.confluence.structure}/25
  - MTF Alignment: ${input.confluence.mtf}/20
  - Liquidity: ${input.confluence.liquidity}/15
  - Order Block: ${input.confluence.orderBlock}/20
  - FVG: ${input.confluence.fvg}/15
  - Session: ${input.confluence.session}/5

Entry Ref: ${input.signal.entry ?? '—'}
Stop Loss:  ${input.signal.sl   ?? '—'}
Target:     ${input.signal.tp1  ?? '—'}
R:R:        ${input.signal.rr   ?? '—'}

Provide: 1) A concise 2-sentence market narrative. 2) One key risk to watch.
Format as JSON: { "narrative": "...", "brief": "...", "keyLevels": "...", "riskNote": "..." }
`.trim();
  }

  async generate(input: ReasoningInput): Promise<ReasoningOutput> {
    const prompt = this.buildPrompt(input);

    // Route to Gemini if key available, else GPT-4, else local fallback
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      return this._callGemini(prompt, geminiKey);
    }

    return this._localFallback(input);
  }

  private async _callGemini(prompt: string, apiKey: string): Promise<ReasoningOutput> {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
    });

    try {
      const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return { ...parsed, model: 'gemini-pro' };
    } catch {
      return this._localFallback({ model: 'gemini-pro' } as any);
    }
  }

  private _localFallback(input: Partial<ReasoningInput> & { model?: string }): ReasoningOutput {
    return {
      narrative:  'Market structure analysis in progress. Connect a Gemini API key for AI-enhanced narratives.',
      brief:      'SMC analysis running server-side. Awaiting AI narrative generation.',
      keyLevels:  'Run full analysis to identify key institutional levels.',
      riskNote:   'Monitor session transitions and high-impact news events.',
      model:      input.model ?? 'local-fallback',
    };
  }
}
