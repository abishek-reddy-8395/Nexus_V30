'use client';
/**
 * Nexus V30 — Replay / Backtester
 * Fixed: max 50 steps to avoid rate limits, proper abort, LWC v4, dedup candles
 */
import { useEffect, useRef, useState } from 'react';
import { nexusMarket, nexusEngine } from '../../services/api.client';
import { INSTRUMENTS, TIMEFRAMES } from '../../constants/index';
import {
  Card, CardHeader, CardBody, CardTitle, KpiGrid, Kpi, Btn, Sel, SectionHeader,
  LoadingState, EmptyState, BiasBadge, GoldDivider,
} from '../../components/ui/nx';

const MAX_STEPS = 50; // Cap to avoid overwhelming backend

interface ReplaySignal {
  step: number; time: number; price: number;
  bias: string; conviction: number;
  entry: number | null; sl: number | null; tp1: number | null;
  rr: string | null; confluenceTotal: number;
  regime: string; hasBos: boolean; hasChoch: boolean; setup: string | null;
}

function dedupSort(raw: any[]) {
  return raw
    .map((c: any) => ({ time: c.time > 1e10 ? Math.floor(c.time / 1000) : c.time, open: +c.open, high: +c.high, low: +c.low, close: +c.close }))
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
}

let _lwcReady: Promise<void> | null = null;
function loadLWC(): Promise<void> {
  if (_lwcReady) return _lwcReady;
  _lwcReady = new Promise(resolve => {
    if (typeof window === 'undefined' || (window as any).LightweightCharts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js';
    s.onload = () => resolve();
    s.onerror = () => { _lwcReady = null; resolve(); };
    document.head.appendChild(s);
  });
  return _lwcReady;
}

export default function ReplayPage() {
  const [sym,     setSym]    = useState('XAUUSD');
  const [tf,      setTf]     = useState(60);
  const [mode,    setMode]   = useState('intraday');
  const [profile, setProfile]= useState<'retail'|'institutional'>('retail');
  const [running, setRunning]= useState(false);
  const [progress,setProgress]=useState(0);
  const [signals, setSignals]= useState<ReplaySignal[]>([]);
  const [summary, setSummary]= useState<any>(null);
  const [playhead,setPlayhead]=useState(0);
  const [playing, setPlaying]= useState(false);
  const [speed,   setSpeed]  = useState(300);
  const [error,   setError]  = useState('');
  const [candles, setCandles]= useState<any[]>([]);
  const [lwcReady,setLwcReady]=useState(false);
  const playRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const abortRef  = useRef(false);
  const chartRef  = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const sigLines  = useRef<any[]>([]);

  useEffect(() => { loadLWC().then(() => setLwcReady(!!(window as any).LightweightCharts)); }, []);

  useEffect(() => {
    if (!lwcReady || !chartRef.current) return;
    const LWC = (window as any).LightweightCharts;
    if (!LWC?.createChart) return;
    const chart = LWC.createChart(chartRef.current, {
      layout: { background: { type: 'solid', color: '#FAFAF7' }, textColor: '#8A8570', fontFamily: 'DM Mono,monospace' },
      grid: { vertLines: { color: 'rgba(201,168,76,0.06)' }, horzLines: { color: 'rgba(201,168,76,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(201,168,76,0.2)' },
      timeScale: { borderColor: 'rgba(201,168,76,0.2)', timeVisible: true },
      width: chartRef.current.clientWidth, height: 300,
    });
    const series = chart.addCandlestickSeries({
      upColor: '#2E7D52', downColor: '#B5382A', wickUpColor: '#2E7D52', wickDownColor: '#B5382A',
      borderUpColor: '#2E7D52', borderDownColor: '#B5382A',
    });
    chartInst.current = chart; seriesRef.current = series;
    const ro = new ResizeObserver(e => { if (e[0] && chartInst.current) chartInst.current.applyOptions({ width: e[0].contentRect.width }); });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chartInst.current?.remove(); chartInst.current = null; };
  }, [lwcReady]);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    seriesRef.current.setData(dedupSort(candles));
    chartInst.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    if (!seriesRef.current || !signals.length) return;
    sigLines.current.forEach(l => { try { seriesRef.current?.removePriceLine(l); } catch {} });
    sigLines.current = [];
    const sig = signals[playhead];
    if (!sig) return;
    [
      sig.entry && { price: sig.entry, color: '#C9A84C', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'Entry' },
      sig.sl    && { price: sig.sl,    color: '#B5382A', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'SL' },
      sig.tp1   && { price: sig.tp1,   color: '#2E7D52', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'TP1' },
    ].filter(Boolean).forEach((l: any) => {
      try { sigLines.current.push(seriesRef.current.createPriceLine(l)); } catch {}
    });
  }, [playhead, signals]);

  async function runReplay() {
    abortRef.current = false;
    setRunning(true); setError(''); setSignals([]); setSummary(null); setProgress(0); setPlayhead(0);
    stopPlayback();
    try {
      const mkt = await nexusMarket.getPrice(sym, tf);
      const raw: any[] = mkt.candles ?? [];
      if (raw.length < 60) throw new Error(`Need ≥60 candles, got ${raw.length}`);
      setCandles(raw);

      const WINDOW = 50;
      const totalSteps = Math.min(raw.length - WINDOW, MAX_STEPS);
      const collected: ReplaySignal[] = [];

      // Sequential calls — avoids rate limits, shows live progress
      for (let i = 0; i < totalSteps; i++) {
        if (abortRef.current) break;
        try {
          const eng = await nexusEngine.analyze(sym, tf, mode as any, profile);
          const c = raw[i + WINDOW - 1] ?? raw[raw.length - 1];
          collected.push({
            step: i, time: c.time, price: c.close,
            bias: eng.signal?.bias ?? 'WAIT',
            conviction: eng.signal?.conviction ?? 0,
            entry: eng.signal?.entry ?? null,
            sl: eng.signal?.sl ?? null,
            tp1: eng.signal?.tp1 ?? null,
            rr: eng.signal?.rr ?? null,
            confluenceTotal: eng.confluence?.total ?? 0,
            regime: eng.structure?.regime ?? '—',
            hasBos: eng.structure?.hasBos ?? false,
            hasChoch: eng.structure?.hasChoch ?? false,
            setup: eng.signal?.setup ?? null,
          });
        } catch {}
        setProgress(Math.round(((i + 1) / totalSteps) * 100));
        setSignals([...collected]);
      }

      const bull = collected.filter(s => s.bias === 'BULL').length;
      const bear = collected.filter(s => s.bias === 'BEAR').length;
      const wait = collected.filter(s => s.bias === 'WAIT' || s.bias === 'NEUTRAL').length;
      setSummary({
        bullSignals: bull, bearSignals: bear, waitSignals: wait,
        avgConviction: +(collected.reduce((a, s) => a + s.conviction, 0) / (collected.length || 1)).toFixed(1),
        avgConfluence: +(collected.reduce((a, s) => a + s.confluenceTotal, 0) / (collected.length || 1)).toFixed(1),
        highConfluence: collected.filter(s => s.confluenceTotal >= 75).length,
        totalSteps: collected.length,
      });
    } catch (e: any) { setError(e?.error ?? e?.message ?? 'Replay failed'); }
    finally { setRunning(false); }
  }

  function startPlayback() {
    if (!signals.length) return;
    setPlaying(true);
    playRef.current = setInterval(() => {
      setPlayhead(p => { if (p >= signals.length - 1) { stopPlayback(); return p; } return p + 1; });
    }, speed);
  }
  function stopPlayback() { setPlaying(false); if (playRef.current) { clearInterval(playRef.current); playRef.current = null; } }
  function cancelReplay() { abortRef.current = true; setRunning(false); stopPlayback(); }
  useEffect(() => () => stopPlayback(), []);

  const currentSig = signals[playhead];
  const biasCounts = signals.reduce((acc, s) => { acc[s.bias] = (acc[s.bias] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: 'calc(100vh - var(--top-h))', animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Replay / Backtester" right={
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          Candle-by-candle SMC engine · Max {MAX_STEPS} steps per run
        </span>
      } />

      <Card style={{ marginBottom: 14 }}>
        <CardBody style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Sel value={sym} onChange={setSym} style={{ width: 120 }}>
              {INSTRUMENTS.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel value={tf} onChange={v => setTf(Number(v))} style={{ width: 90 }}>
              {TIMEFRAMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Sel>
            <Sel value={mode} onChange={setMode} style={{ width: 110 }}>
              <option value="intraday">Intraday</option>
              <option value="scalp">Scalp</option>
              <option value="positional">Positional</option>
            </Sel>
            <Sel value={speed} onChange={v => setSpeed(Number(v))} style={{ width: 100 }}>
              <option value={600}>0.5×</option>
              <option value={300}>1×</option>
              <option value={150}>2×</option>
              <option value={75}>4×</option>
            </Sel>
            <Btn onClick={running ? cancelReplay : runReplay}>
              {running ? `✕ Cancel (${progress}%)` : '▶ Run Replay'}
            </Btn>
            {signals.length > 0 && <>
              <button onClick={playing ? stopPlayback : startPlayback} style={{ padding: '6px 14px', background: playing ? 'var(--red-light)' : 'var(--green-light)', border: `1px solid ${playing ? 'rgba(181,56,42,0.3)' : 'rgba(46,125,82,0.3)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: playing ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-body)' }}>
                {playing ? '⏸ Pause' : '⏵ Play'}
              </button>
              <button onClick={() => { stopPlayback(); setPlayhead(0); }} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>⏮</button>
            </>}
          </div>
          {running && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
                <span>Processing steps…</span><span>{progress}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--cream-3)', borderRadius: 2 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gold)', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          {error && <div style={{ marginTop: 8, padding: '6px 12px', background: 'var(--red-light)', borderRadius: 6, fontSize: 12, color: 'var(--red)', border: '1px solid rgba(181,56,42,0.2)' }}>⚠ {error}</div>}
        </CardBody>
      </Card>

      {summary && (
        <KpiGrid cols="repeat(auto-fit,minmax(110px,1fr))">
          <Kpi label="Total Steps"    value={summary.totalSteps} />
          <Kpi label="Bull Signals"   value={summary.bullSignals}  color="var(--green)" />
          <Kpi label="Bear Signals"   value={summary.bearSignals}  color="var(--red)" />
          <Kpi label="Wait/Neutral"   value={summary.waitSignals}  color="var(--muted)" />
          <Kpi label="Avg Conviction" value={`${summary.avgConviction}%`} color="var(--gold)" />
          <Kpi label="High Conf ≥75"  value={summary.highConfluence} color="var(--green)" />
        </KpiGrid>
      )}

      {signals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 14, marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card>
              <CardHeader>
                <CardTitle>Candle Chart</CardTitle>
                {currentSig && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BiasBadge bias={currentSig.bias} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>Step {playhead + 1}/{signals.length}</span>
                </div>}
              </CardHeader>
              <div ref={chartRef} style={{ width: '100%', height: 300 }} />
            </Card>

            <Card>
              <CardBody style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Step {playhead + 1}/{signals.length}</span>
                  <input type="range" min={0} max={signals.length - 1} value={playhead}
                    onChange={e => { stopPlayback(); setPlayhead(Number(e.target.value)); }}
                    style={{ flex: 1, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {currentSig ? new Date(currentSig.time * (currentSig.time < 1e10 ? 1000 : 1)).toLocaleString() : '—'}
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Bias timeline */}
            <Card>
              <CardHeader><CardTitle>Bias Timeline</CardTitle></CardHeader>
              <CardBody style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', height: 32, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                  {signals.map((s, i) => (
                    <div key={i} onClick={() => { stopPlayback(); setPlayhead(i); }}
                      style={{ flex: 1, background: s.bias === 'BULL' ? '#2E7D52' : s.bias === 'BEAR' ? '#B5382A' : '#EDE9DE', opacity: i === playhead ? 1 : 0.6, cursor: 'pointer', outline: i === playhead ? '2px solid var(--gold)' : 'none', minWidth: 2 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
                  <span style={{ color: '#2E7D52' }}>■ Bull ({biasCounts['BULL'] || 0})</span>
                  <span style={{ color: '#B5382A' }}>■ Bear ({biasCounts['BEAR'] || 0})</span>
                  <span>■ Wait ({(biasCounts['WAIT'] || 0) + (biasCounts['NEUTRAL'] || 0)})</span>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Step detail */}
          <div>
            <Card>
              <CardHeader><CardTitle>Step Detail</CardTitle></CardHeader>
              <CardBody>
                {!currentSig ? <EmptyState title="Select a step" /> : (
                  <>
                    <BiasBadge bias={currentSig.bias} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--gold)', margin: '6px 0 2px' }}>{currentSig.conviction}%</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>conviction</div>
                    <GoldDivider />
                    <div style={{ marginTop: 10 }}>
                      {[['Price', currentSig.price?.toFixed(5)], ['Entry', currentSig.entry?.toFixed(5) ?? '—'], ['SL', currentSig.sl?.toFixed(5) ?? '—'], ['TP1', currentSig.tp1?.toFixed(5) ?? '—'], ['R:R', currentSig.rr ?? '—'], ['Confluence', `${currentSig.confluenceTotal}/100`], ['Regime', currentSig.regime], ['BOS', currentSig.hasBos ? '✓' : '—'], ['CHoCH', currentSig.hasChoch ? '✓' : '—']].map(([l, v]) => (
                        <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-2)', fontSize: 12 }}>
                          <span style={{ color: 'var(--muted)' }}>{l}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink)' }}>{v ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    {currentSig.setup && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--cream-2)', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.6 }}>{currentSig.setup}</div>}
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {!signals.length && !running && (
        <EmptyState icon="⏵" title="Configure and run replay" sub={`Select instrument, timeframe, and mode — then click Run Replay. Max ${MAX_STEPS} steps per run to ensure fast results.`} />
      )}
    </div>
  );
}
