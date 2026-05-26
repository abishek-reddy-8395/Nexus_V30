'use client';
/**
 * Nexus V30 — SMC Intelligence Chart
 * Fixed: resizable right panel via drag handle, legend overflow guard,
 * page fadeUp animation, ProfileToggle + TfPills from shared components.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { nexusEngine, nexusMarket } from '../../services/api.client';
import { useMarketStore, useUIStore } from '../../state/store';
import { useWsStore } from '../../state/ws-store';
import { INSTRUMENTS } from '../../constants/index';
import { Btn, Sel, BiasBadge, ProfileToggle, TfPills, ModePills } from '../../components/ui/nx';

interface OverlayToggle {
  ob: boolean; fvg: boolean; liq: boolean; bos: boolean; signal: boolean; demand: boolean;
}

const C = {
  entry: '#C9A84C', sl: '#B5382A', tp: '#2E7D52', bos: '#2E7D52', choch: '#C9A84C',
};

let _lwcPromise: Promise<void> | null = null;
function loadLWC(): Promise<void> {
  if (_lwcPromise) return _lwcPromise;
  _lwcPromise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') { resolve(); return; }
    if ((window as any).LightweightCharts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js';
    s.onload = () => resolve();
    s.onerror = () => { _lwcPromise = null; resolve(); };
    document.head.appendChild(s);
  });
  return _lwcPromise;
}

function dedup(raw: any[]) {
  return raw
    .map((c: any) => ({ time: c.time > 1e10 ? Math.floor(c.time / 1000) : c.time, open: +c.open, high: +c.high, low: +c.low, close: +c.close }))
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1]!.time);
}

const PANEL_MIN = 200;
const PANEL_DEFAULT = 264;
const PANEL_MAX = 380;

export default function SmcChartPage() {
  const chartRef  = useRef<HTMLDivElement>(null);
  const chartInst = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const linesRef  = useRef<any[]>([]);
  const dragRef   = useRef<{ dragging: boolean; startX: number; startW: number }>({ dragging: false, startX: 0, startW: PANEL_DEFAULT });

  const { sym, tf } = useMarketStore();
  const { mode }    = useUIStore();
  const { priceMap } = useWsStore();

  const [localSym,  setLocalSym]  = useState(sym);
  const [localTf,   setLocalTf]   = useState(tf);
  const [analysis,  setAnalysis]  = useState<any>(null);
  const [candles,   setCandles]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [overlays,  setOverlays]  = useState<OverlayToggle>({ ob:false, fvg:true, liq:true, bos:true, signal:true, demand:false });
  const [profile,   setProfile]   = useState<'retail'|'institutional'>('retail');
  const [lwcReady,  setLwcReady]  = useState(false);
  const [panelW,    setPanelW]    = useState(PANEL_DEFAULT);

  useEffect(() => { loadLWC().then(() => setLwcReady(!!(window as any).LightweightCharts)); }, []);

  useEffect(() => {
    if (!lwcReady || !chartRef.current) return;
    const LWC = (window as any).LightweightCharts;
    if (!LWC?.createChart) return;
    const chart = LWC.createChart(chartRef.current, {
      layout: { background: { type: 'solid', color: '#FAFAF7' }, textColor: '#6B6455', fontFamily: 'DM Mono, monospace' },
      grid: { vertLines: { color: 'rgba(201,168,76,0.06)' }, horzLines: { color: 'rgba(201,168,76,0.06)' } },
      crosshair: { mode: 0, vertLine: { color: 'rgba(201,168,76,0.5)', labelBackgroundColor: '#C9A84C' }, horzLine: { color: 'rgba(201,168,76,0.5)', labelBackgroundColor: '#C9A84C' } },
      rightPriceScale: { borderColor: 'rgba(201,168,76,0.2)', scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { borderColor: 'rgba(201,168,76,0.2)', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true },
      width:  chartRef.current.clientWidth,
      height: chartRef.current.clientHeight || 520,
    });
    const series = chart.addCandlestickSeries({ upColor:'#2E7D52', downColor:'#B5382A', wickUpColor:'#2E7D52', wickDownColor:'#B5382A', borderUpColor:'#2E7D52', borderDownColor:'#B5382A' });
    chartInst.current = chart; seriesRef.current = series;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e && chartInst.current) chartInst.current.applyOptions({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chartInst.current?.remove(); chartInst.current = null; };
  }, [lwcReady]);

  const fetchAndRender = useCallback(async (s = localSym, t = localTf) => {
    if (!seriesRef.current) return;
    setLoading(true); setError('');
    try {
      const [mkt, eng] = await Promise.all([nexusMarket.getPrice(s, t), nexusEngine.analyze(s, t, mode, profile)]);
      const sorted = dedup(mkt.candles ?? []);
      setCandles(mkt.candles ?? []); setAnalysis(eng);
      seriesRef.current.setData(sorted);
      chartInst.current?.timeScale().fitContent();
      drawOverlays(eng, sorted);
    } catch (e: any) { setError(e?.error ?? e?.message ?? 'Analysis failed'); }
    finally { setLoading(false); }
  }, [localSym, localTf, mode, profile]);

  useEffect(() => { if (lwcReady && seriesRef.current) fetchAndRender(); }, [lwcReady]);

  useEffect(() => {
    const p = priceMap[localSym];
    if (!p || !seriesRef.current || !candles.length) return;
    const last = candles[candles.length - 1];
    if (!last) return;
    const lastTime = last.time > 1e10 ? Math.floor(last.time / 1000) : last.time;
    try { seriesRef.current.update({ time: lastTime, open: last.open, high: Math.max(last.high, p.price), low: Math.min(last.low, p.price), close: p.price }); } catch {}
  }, [priceMap, localSym]);

  function clearDecorations() {
    linesRef.current.forEach(l => { try { seriesRef.current?.removePriceLine(l); } catch {} });
    linesRef.current = [];
  }
  function addLine(pl: any) { try { linesRef.current.push(seriesRef.current.createPriceLine(pl)); } catch {} }

  function drawOverlays(eng: any, sorted: any[]) {
    if (!seriesRef.current || !eng) return;
    clearDecorations();
    const sig = eng.signal ?? {}, levels = eng.levels ?? {}, struct = eng.structure ?? {};
    if (overlays.signal) {
      if (sig.entry != null) addLine({ price: sig.entry, color: C.entry, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `Entry ${sig.entry?.toFixed(5)}` });
      if (sig.sl    != null) addLine({ price: sig.sl,    color: C.sl,    lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `SL` });
      if (sig.tp1   != null) addLine({ price: sig.tp1,   color: C.tp,    lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `TP1` });
    }
    if (overlays.ob && levels.obHigh) { addLine({ price: levels.obHigh, color: '#2E7D52', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'OB Hi' }); }
    if (overlays.ob && levels.obLow)  { addLine({ price: levels.obLow,  color: '#2E7D52', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'OB Lo' }); }
    if (levels.resistance) addLine({ price: levels.resistance, color: '#B5382A', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'R' });
    if (levels.support)    addLine({ price: levels.support,    color: '#2E7D52', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'S' });
    if (overlays.fvg && levels.fvgHigh) addLine({ price: levels.fvgHigh, color: '#1E4E8C', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'FVG Hi' });
    if (overlays.fvg && levels.fvgLow)  addLine({ price: levels.fvgLow,  color: '#1E4E8C', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'FVG Lo' });
    if (overlays.bos && struct.hasBos   && levels.resistance) addLine({ price: levels.resistance, color: C.bos,   lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'BOS' });
    if (overlays.bos && struct.hasChoch && sig.entry)          addLine({ price: sig.entry * 0.9995, color: C.choch, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'CHoCH' });
    if (overlays.liq && levels.resistance) addLine({ price: levels.resistance * 1.001, color: C.entry, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: 'BSL' });
    if (overlays.liq && levels.support)    addLine({ price: levels.support * 0.999,    color: '#BAB5A0', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: 'SSL' });
  }

  useEffect(() => { if (analysis && candles.length && seriesRef.current) drawOverlays(analysis, dedup(candles)); }, [overlays]);

  // ── Drag to resize right panel ───────────────────────────────────────
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startW: panelW };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const delta = dragRef.current.startX - ev.clientX;
      const newW = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragRef.current.startW + delta));
      setPanelW(newW);
    };
    const onUp = () => { dragRef.current.dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const sig    = analysis?.signal    ?? {};
  const conf   = analysis?.confluence ?? {};
  const struct = analysis?.structure  ?? {};
  const levels = analysis?.levels     ?? {};
  const bias   = sig.bias ?? 'WAIT';

  const OV_BTNS: { key: keyof OverlayToggle; label: string; color: string }[] = [
    { key: 'signal', label: 'Signal',     color: '#C9A84C' },
    { key: 'bos',    label: 'BOS/CHoCH',  color: '#2E7D52' },
    { key: 'fvg',    label: 'FVG',        color: '#1E4E8C' },
    { key: 'liq',    label: 'Liquidity',  color: '#C9A84C' },
    { key: 'ob',     label: 'OB Zones',   color: '#2E7D52' },
    { key: 'demand', label: 'D/S Zones',  color: '#B5382A' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - var(--top-h))', overflow:'hidden', background:'var(--cream)', animation:'fadeIn 0.18s ease' }}>

      {/* Toolbar */}
      <div style={{ flexShrink:0, background:'var(--panel)', borderBottom:'1px solid var(--border)', padding:'8px 14px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <Sel value={localSym} onChange={v => { setLocalSym(v); fetchAndRender(v, localTf); }} style={{ width:120 }}>
          {INSTRUMENTS.map(s => <option key={s}>{s}</option>)}
        </Sel>
        <TfPills value={localTf} onChange={v => { setLocalTf(v); fetchAndRender(localSym, v); }}/>
        <ModePills value={mode} onChange={() => {}}/>
        <div style={{ width:1, height:24, background:'var(--border)', flexShrink:0 }}/>
        <ProfileToggle value={profile} onChange={p => { setProfile(p); setTimeout(() => fetchAndRender(), 0); }}/>
        {OV_BTNS.map(b => (
          <button key={b.key} onClick={() => setOverlays(p => ({ ...p, [b.key]: !p[b.key] }))} style={{
            display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:14,
            border:`1px solid ${overlays[b.key] ? b.color : 'var(--border)'}`,
            background:overlays[b.key] ? `${b.color}14` : 'transparent',
            color:overlays[b.key] ? b.color : 'var(--muted)',
            fontSize:11, fontWeight:overlays[b.key]?600:400, cursor:'pointer',
            fontFamily:'var(--font-body)', transition:'all 0.14s',
          }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:overlays[b.key] ? b.color : 'var(--cream-3)', flexShrink:0 }}/>
            {b.label}
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <Btn onClick={() => fetchAndRender()} disabled={loading} small>
          {loading ? '◌' : '▶'} Analyze
        </Btn>
      </div>

      {/* Main: chart + resizable panel */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

        {/* Chart */}
        <div style={{ flex:1, position:'relative', overflow:'hidden', minWidth:0 }}>
          {!lwcReady && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--muted)' }}>
              <div className="spinner"/>
              <span style={{ fontSize:12 }}>Loading chart engine…</span>
            </div>
          )}
          {error && (
            <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', background:'var(--red-light)', border:'1px solid rgba(181,56,42,0.28)', borderRadius:'var(--radius-sm)', padding:'7px 14px', fontSize:12, color:'var(--red)', zIndex:10, whiteSpace:'nowrap' }}>
              ⚠ {error}
            </div>
          )}
          {loading && (
            <div style={{ position:'absolute', top:12, right:12, zIndex:10, display:'flex', alignItems:'center', gap:6, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'5px 10px', fontSize:11, color:'var(--muted)' }}>
              <div className="spinner" style={{ width:12, height:12 }}/>Analyzing…
            </div>
          )}
          {/* Legend — capped height to prevent overflow */}
          <div style={{ position:'absolute', bottom:10, left:10, zIndex:10, display:'flex', gap:5, flexWrap:'wrap', maxWidth:'calc(100% - 20px)' }}>
            {[['#2E7D52','Bull OB'],['#B5382A','Bear OB'],['#1E4E8C','FVG'],['#C9A84C','Liquidity'],['#2E7D52','BOS'],['#C9A84C','CHoCH']].map(([c,l])=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(250,250,247,0.92)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 7px', fontSize:9, fontWeight:600, color:'var(--ink-2)', backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:c, flexShrink:0 }}/>
                {l}
              </div>
            ))}
          </div>
          <div ref={chartRef} style={{ width:'100%', height:'100%' }}/>
        </div>

        {/* Drag handle */}
        <div onMouseDown={onDragStart} style={{
          width:5, cursor:'col-resize', background:'transparent', flexShrink:0, zIndex:10,
          transition:'background 0.1s',
          borderLeft:'1px solid var(--border)',
        }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
        />

        {/* Right panel — fixed width, user-resizable */}
        <div style={{ width:panelW, flexShrink:0, borderLeft:'1px solid var(--border)', background:'var(--panel)', overflowY:'auto', display:'flex', flexDirection:'column' }}>
          
          {/* Bias */}
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-2)', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:7 }}>Nexus Bias</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <BiasBadge bias={bias}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color:'var(--gold)' }}>{sig.conviction ?? 0}%</span>
            </div>
            {sig.setup && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, fontStyle:'italic' }}>{sig.setup}</div>}
          </div>

          {/* Signal levels */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-2)' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Signal</div>
            {[['Entry', sig.entry, '#C9A84C'],['SL', sig.sl, '#B5382A'],['TP1', sig.tp1, '#2E7D52'],['R:R', sig.rr, 'var(--ink)']].map(([l,v,c])=>(
              <div key={l as string} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:11, borderBottom:'1px solid var(--border-2)' }}>
                <span style={{ color:'var(--muted)' }}>{l}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:c as string }}>
                  {v != null ? (typeof v === 'number' ? (v as number).toFixed(5) : v) : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* SMC Zones */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-2)' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>SMC Zones</div>
            {[
              { label:'Order Block', hi:levels.obHigh, lo:levels.obLow,    color:'#2E7D52', icon:'▪' },
              { label:'FVG',         hi:levels.fvgHigh,lo:levels.fvgLow,   color:'#1E4E8C', icon:'◈' },
              { label:'Resistance',  hi:levels.resistance,lo:null,          color:'#B5382A', icon:'△' },
              { label:'Support',     hi:null,lo:levels.support,             color:'#2E7D52', icon:'▽' },
            ].map(z => (
              <div key={z.label} style={{ padding:'7px 0', borderBottom:'1px solid var(--border-2)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                  <span style={{ color:z.color, fontSize:10 }}>{z.icon}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-2)' }}>{z.label}</span>
                </div>
                {z.hi && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'var(--muted)' }}>High</span><span style={{ fontFamily:'var(--font-mono)', color:z.color }}>{(z.hi as number).toFixed(5)}</span></div>}
                {z.lo && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'var(--muted)' }}>Low</span><span style={{ fontFamily:'var(--font-mono)', color:z.color }}>{(z.lo as number).toFixed(5)}</span></div>}
                {!z.hi && !z.lo && <div style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>Not detected</div>}
              </div>
            ))}
          </div>

          {/* Structure */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-2)' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Structure</div>
            {[['Trend',struct.trend,'var(--ink)'],['Regime',struct.regime,'var(--ink)'],['BOS',struct.hasBos?'✓ Detected':'—',struct.hasBos?'#2E7D52':'var(--muted)'],['CHoCH',struct.hasChoch?'✓ Detected':'—',struct.hasChoch?'#C9A84C':'var(--muted)']].map(([l,v,c])=>(
              <div key={l as string} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:11, borderBottom:'1px solid var(--border-2)' }}>
                <span style={{ color:'var(--muted)' }}>{l}</span>
                <span style={{ fontWeight:600, color:c as string }}>{v ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Confluence bars */}
          <div style={{ padding:'10px 14px', flex:1 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>Confluence</div>
            {[['Structure',conf.structure??0,25],['MTF',conf.mtf??0,22],['Liquidity',conf.liquidity??0,18],['OB',conf.orderBlock??0,12],['FVG',conf.fvg??0,5],['Session',conf.session??0,10]].map(([l,s,m])=>{
              const pct = Math.min(((s as number)/(m as number))*100,100);
              const col = pct>=70?'var(--green)':pct>=40?'var(--gold)':'var(--red)';
              return (
                <div key={l as string} style={{ marginBottom:7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                    <span style={{ color:'var(--ink-3)' }}>{l}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:col }}>{s}/{m}</span>
                  </div>
                  <div style={{ height:3, background:'var(--cream-3)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:col, borderRadius:2, transition:'width 0.5s' }}/>
                  </div>
                </div>
              );
            })}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border-2)', marginTop:4 }}>
              <span style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)' }}>Total</span>
              <span style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:500, color:'var(--gold)' }}>{conf.total ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
