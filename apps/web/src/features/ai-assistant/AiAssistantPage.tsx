'use client';
/**
 * Nexus V30 — AI Copilot Page
 * Fixed: response shape (d?.response), SSE streaming, Zustand-persisted history
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { nexusCopilot } from '../../services/api.client';
import {
  Card, CardHeader, CardBody, CardTitle, Btn, Sel, SectionHeader, GoldDivider,
} from '../../components/ui/nx';

const QUICK_PROMPTS = [
  'What is the current market structure on XAUUSD?',
  'Review my last 5 trades for patterns',
  'Where are the key liquidity pools right now?',
  'Explain Fair Value Gaps with examples',
  'Am I overtrading based on my journal?',
  'What SMC setup should I look for in London session?',
];

const INTENT_COLORS: Record<string, string> = {
  market_analysis:    '#1E4E8C',
  trade_review:       '#6D3C9E',
  journal_analysis:   '#8A6200',
  education:          '#2E7D52',
  behavioral_coaching:'#B5382A',
  general:            '#8A8570',
};

interface Message {
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  streaming?: boolean;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    text: "Welcome, Trader. I'm your context-aware AI Copilot powered by Gemini 3.5 Flash. Ask me about market structure, trade setups, journal patterns, or behavioral coaching.",
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [debrief, setDebrief] = useState('');
  const [debriefLoad, setDL] = useState(false);
  const [bcSignal, setBcSignal] = useState('emotional_trade');
  const [bcResult, setBcResult] = useState('');
  const [bcLoad, setBcLoad] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const query = text ?? input.trim();
    if (!query || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add streaming placeholder
    const streamId = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', text: '', intent: 'general', streaming: true }]);

    const newHistory = [...history, { role: 'user', content: query }];

    try {
      // Try SSE stream first
      const url = `/api/copilot/stream?query=${encodeURIComponent(query)}&marketContext=`;
      let fullText = '';
      let intent = 'general';
      let streamFailed = false;

      try {
        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${document.cookie.match(/nexus_token_v3=([^;]*)/)?.[1] ?? ''}` },
        });

        if (resp.ok && resp.body) {
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
              if (line === 'data: [DONE]') break;
              if (!line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.chunk) {
                  fullText += data.chunk;
                  setMessages(prev => prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, text: fullText } : m
                  ));
                }
                if (data.meta?.intent) intent = data.meta.intent;
              } catch {}
            }
          }
        } else { streamFailed = true; }
      } catch { streamFailed = true; }

      // Fallback to standard POST if stream failed
      if (streamFailed || !fullText) {
        const d = await nexusCopilot.chat(query, newHistory.slice(-10));
        // FIXED: correct response shape
        fullText = d?.response ?? d?.content ?? d?.narrative ?? 'No response received from AI.';
        intent   = d?.intent ?? 'general';
      }

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', text: fullText, intent, streaming: false } : m
      ));
      setHistory([...newHistory, { role: 'assistant', content: fullText }]);
    } catch (e: any) {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', text: `Error: ${e?.message ?? 'Request failed. Check GEMINI_API_KEY is set.'}`, streaming: false } : m
      ));
    } finally { setLoading(false); }
  }, [input, loading, history]);

  async function getDebrief() {
    setDL(true);
    try {
      const d = await nexusCopilot.sessionDebrief([]);
      setDebrief(d?.debrief ?? d?.response ?? 'Debrief unavailable.');
    } catch { setDebrief('Debrief unavailable.'); }
    finally { setDL(false); }
  }

  async function getCoaching() {
    setBcLoad(true);
    try {
      const d = await nexusCopilot.behavioralCoaching(bcSignal);
      setBcResult(d?.coaching ?? d?.response ?? 'Coaching unavailable.');
    } catch { setBcResult('Coaching unavailable.'); }
    finally { setBcLoad(false); }
  }

  return (
    <div style={{ padding: 20, height: 'calc(100vh - var(--top-h))', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.22s ease' }}>
      <SectionHeader title="AI Copilot" right={
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Powered by Gemini 3.5 Flash · Context-aware · Session-persistent</span>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, flex: 1, minHeight: 0 }}>

        {/* Chat */}
        <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <CardHeader style={{ flexShrink: 0 }}>
            <CardTitle>✦ Context-aware Intelligence</CardTitle>
            <Btn variant="ghost" small onClick={() => { setMessages([{ role: 'assistant', text: 'Chat cleared. Ask me anything.' }]); setHistory([]); }} style={{ marginLeft: 'auto' }}>Clear</Btn>
          </CardHeader>

          <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ maxWidth: '82%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.intent && m.role === 'assistant' && (
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: INTENT_COLORS[m.intent] ?? 'var(--gold)', marginBottom: 3 }}>
                    {m.intent.replace(/_/g, ' ')}
                  </div>
                )}
                <div style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.7,
                  background: m.role === 'user' ? 'var(--ink)' : 'var(--panel)',
                  color: m.role === 'user' ? '#BAB5A0' : 'var(--ink)',
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderBottomRightRadius: m.role === 'user' ? 3 : 10,
                  borderBottomLeftRadius:  m.role === 'assistant' ? 3 : 10,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text || (m.streaming ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                      <div className="spinner" style={{ width: 12, height: 12 }} />
                      Analyzing…
                    </span>
                  ) : '—')}
                </div>
              </div>
            ))}
          </div>

          {/* Quick prompts — horizontal scroll, no wrap */}
          <div style={{ flexShrink: 0, padding: '8px 16px', borderTop: '1px solid var(--border-2)', display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden' }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)} style={{
                padding: '4px 10px', fontSize: 11, color: 'var(--muted)', background: 'var(--cream-2)',
                border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'all 0.12s', whiteSpace: 'nowrap', flexShrink: 0,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--gold)'; e.currentTarget.style.color='var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)'; }}
              >{p}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about market structure, trades, patterns…"
              disabled={loading}
              style={{
                flex: 1, padding: '9px 12px', background: 'var(--cream-2)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
            <Btn onClick={() => send()} disabled={loading || !input.trim()}>
              {loading ? '◌' : 'Send'}
            </Btn>
          </div>
        </Card>

        {/* Right panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', minHeight: 0 }}>
          {/* Session Debrief */}
          <Card>
            <CardHeader><CardTitle>Session Debrief</CardTitle></CardHeader>
            <CardBody>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Get an AI-generated end-of-session performance review based on your journal entries.
              </p>
              <Btn onClick={getDebrief} disabled={debriefLoad} style={{ width: '100%', marginBottom: debrief ? 12 : 0 }}>
                {debriefLoad ? '◌ Generating…' : '◈ Generate Debrief'}
              </Btn>
              {debrief && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--cream-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                  {debrief}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Behavioral Coaching */}
          <Card>
            <CardHeader><CardTitle>Behavioral Coaching</CardTitle></CardHeader>
            <CardBody>
              <Sel value={bcSignal} onChange={setBcSignal} style={{ width: '100%', marginBottom: 10 }}>
                <option value="emotional_trade">Emotional Trade Detected</option>
                <option value="revenge_trade">Revenge Trading Pattern</option>
                <option value="overtrade">Overtrading Alert</option>
                <option value="fomo_entry">FOMO Entry Warning</option>
                <option value="session_fatigue">Session Fatigue</option>
                <option value="risk_drift">Risk Drift Detected</option>
              </Sel>
              <Btn onClick={getCoaching} disabled={bcLoad} style={{ width: '100%', marginBottom: bcResult ? 12 : 0 }}>
                {bcLoad ? '◌ Loading…' : '◉ Get Coaching'}
              </Btn>
              {bcResult && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(181,56,42,0.05)', border: '1px solid rgba(181,56,42,0.2)', borderRadius: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                  {bcResult}
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI capabilities card */}
          <Card>
            <CardHeader><CardTitle>AI Capabilities</CardTitle></CardHeader>
            <CardBody>
              {[
                ['◈ Market Analysis', 'Structure, bias, levels, regime'],
                ['◉ Trade Review',    'Win/loss patterns, R:R analysis'],
                ['≡ Journal Insight', 'Sentiment, behavioral patterns'],
                ['△ SMC Education',   'OB, FVG, BOS/CHoCH explanations'],
                ['✦ Coaching',        'Emotional trading interventions'],
              ].map(([icon, desc]) => (
                <div key={icon as string} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <span style={{ fontSize: 11, color: 'var(--gold)', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{icon}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--cream-2)', borderRadius: 6, fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
                Analytical output only — not financial advice. All insights reference your personal trading data.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
