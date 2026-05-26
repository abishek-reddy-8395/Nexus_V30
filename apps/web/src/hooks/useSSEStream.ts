/**
 * Nexus V30 — useSSEStream Hook
 *
 * Consumes a Server-Sent Events endpoint and accumulates streamed text.
 * Used by AiAssistantPage to show AI narrative as it generates.
 *
 * v5: localStorage removed — token sourced from nexusAuth.getToken() (cookie-based)
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { nexusAuth } from '../services/api.client';

interface SSEStreamState {
  text:      string;
  streaming: boolean;
  error:     string | null;
}

export function useSSEStream(buildUrl: (params: Record<string, string>) => string) {
  const [state,   setState]   = useState<SSEStreamState>({ text: '', streaming: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (params: Record<string, string> = {}) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState({ text: '', streaming: true, error: null });

    const url   = buildUrl(params);
    const token = nexusAuth.getToken() ?? '';

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal:  abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setState(s => ({ ...s, streaming: false, error: `HTTP ${res.status}` }));
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { setState(s => ({ ...s, streaming: false })); return; }
          try {
            const { chunk } = JSON.parse(data);
            if (chunk) setState(s => ({ ...s, text: s.text + chunk }));
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(s => ({ ...s, streaming: false, error: err.message }));
      }
    } finally {
      setState(s => ({ ...s, streaming: false }));
    }
  }, [buildUrl]);

  const stop  = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setState({ text: '', streaming: false, error: null }), []);

  return { ...state, start, stop, reset };
}
