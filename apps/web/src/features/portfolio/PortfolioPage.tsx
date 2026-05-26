'use client';
/**
 * Nexus V30 — Portfolio & Equity
 * Fixed: equity curve now has Y-axis labels (min/zero/max), X-axis date labels
 * (start/end), mouse-follow tooltip via SVG mousemove, by-symbol PnL scale.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { nexusPortfolio } from '../../services/api.client';
import { Card,CardHeader,CardBody,CardTitle,KpiGrid,Kpi,Sel,SectionHeader,SkeletonPanel,EmptyState,ErrorBanner } from '../../components/ui/nx';

export default function PortfolioPage() {
  const [summary,   setSummary]   = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [curve,     setCurve]     = useState<any[]>([]);
  const [bySym,     setBySym]     = useState<any>({});
  const [range,     setRange]     = useState('30d');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tooltip,   setTooltip]   = useState<{ x:number; y:number; text:string; visible:boolean }>({ x:0,y:0,text:'',visible:false });
  const svgRef   = useRef<SVGSVGElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const curveMeta = useRef<{ xs:number[]; ys:number[]; pnls:number[]; dates:string[] }>({ xs:[],ys:[],pnls:[],dates:[] });

  useEffect(() => { load(); }, [range]);

  async function load() {
    setLoading(true);
    try {
      const [s, p, h] = await Promise.allSettled([nexusPortfolio.summary(), nexusPortfolio.positions(), nexusPortfolio.history(range)]);
      if (s.status==='fulfilled') { setSummary(s.value?.summary ?? s.value); setBySym(s.value?.bySymbol ?? {}); }
      if (p.status==='fulfilled') setPositions(p.value?.positions ?? []);
      if (h.status==='fulfilled') setCurve(h.value?.curve ?? []);
    } catch (e: any) { setError(e?.error ?? e?.message ?? 'Failed'); }
    finally { setLoading(false); }
  }

  const drawCurve = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !curve.length) return;
    const W = svg.clientWidth || 600;
    const H = 140;
    const PAD = { top:20, right:60, bottom:24, left:10 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const pnls = curve.map((c: any) => c.cumPnl ?? 0);
    const dates = curve.map((c: any) => c.date ?? c.day ?? '');
    const minP = Math.min(0, ...pnls), maxP = Math.max(0, ...pnls), rng = maxP - minP || 1;
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const xs = curve.map((_: any, i: number) => PAD.left + (i / ((curve.length - 1) || 1)) * chartW);
    const ys = pnls.map((p: number) => PAD.top + chartH - ((p - minP) / rng) * chartH);
    const zero = PAD.top + chartH - ((0 - minP) / rng) * chartH;

    curveMeta.current = { xs, ys, pnls, dates };

    const pathD  = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
    const fillD  = `${pathD} L${xs[xs.length-1]!.toFixed(1)},${zero.toFixed(1)} L${xs[0]!.toFixed(1)},${zero.toFixed(1)} Z`;
    const pos    = pnls[pnls.length - 1] >= 0;
    const col    = pos ? '#2E7D52' : '#B5382A';

    // Format helper
    const fmt = (v: number) => v >= 0 ? `+$${v.toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`;

    // Y axis labels
    const yLabels = [
      { v: maxP, y: PAD.top },
      { v: 0,    y: zero    },
      { v: minP, y: PAD.top + chartH },
    ].filter((l, i, arr) => i === 0 || Math.abs(l.y - arr[i-1]!.y) > 16);

    const yLabelsSvg = yLabels.map(l => `<text x="${W - PAD.right + 5}" y="${(l.y + 4).toFixed(1)}" fill="#6B6455" font-size="9" font-family="DM Mono,monospace">${fmt(l.v)}</text>`).join('');

    // X date labels (start + end)
    const startDate = dates[0] ? dates[0].slice(5) : '';
    const endDate   = dates[dates.length - 1] ? dates[dates.length - 1].slice(5) : '';
    const xLabelsSvg = [
      `<text x="${PAD.left}" y="${H - 5}" fill="#6B6455" font-size="9" font-family="DM Mono,monospace">${startDate}</text>`,
      `<text x="${(PAD.left + chartW).toFixed(1)}" y="${H - 5}" fill="#6B6455" font-size="9" font-family="DM Mono,monospace" text-anchor="end">${endDate}</text>`,
    ].join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="0.02"/>
        </linearGradient>
        <clipPath id="chart-clip"><rect x="${PAD.left}" y="${PAD.top}" width="${chartW}" height="${chartH}"/></clipPath>
      </defs>
      <line x1="${PAD.left}" y1="${zero.toFixed(1)}" x2="${(PAD.left+chartW).toFixed(1)}" y2="${zero.toFixed(1)}" stroke="#EDE9DE" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="${(W-PAD.right).toFixed(1)}" y1="${PAD.top}" x2="${(W-PAD.right).toFixed(1)}" y2="${(PAD.top+chartH).toFixed(1)}" stroke="#EDE9DE" stroke-width="0.5"/>
      <path d="${fillD}" fill="url(#eq)" clip-path="url(#chart-clip)"/>
      <path d="${pathD}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#chart-clip)"/>
      ${yLabelsSvg}
      ${xLabelsSvg}
    `;
  }, [curve]);

  useEffect(() => { drawCurve(); }, [drawCurve]);

  // Mouse-follow tooltip
  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const { xs, pnls, dates } = curveMeta.current;
    if (!xs.length) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let minDist = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(x - mouseX); if (d < minDist) { minDist = d; closest = i; } });
    const pnl = pnls[closest] ?? 0;
    const date = dates[closest] ?? '';
    setTooltip({ x: mouseX, y: e.clientY - rect.top - 28, text: `${date}  ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, visible: true });
  }

  const bySymArr = Object.entries(bySym).sort(([, a]: any, [, b]: any) => b.pnl - a.pnl);
  const maxAbsPnl = Math.max(1, ...bySymArr.map(([, v]: any) => Math.abs(v.pnl ?? 0)));

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:400, color:'var(--ink)' }}>Portfolio & Equity</div>
        <div style={{ flex:1, height:1, background:'linear-gradient(to right,var(--border),transparent)' }}/>
        <Sel value={range} onChange={setRange} style={{ width:110 }}>
          <option value="7d">7 days</option><option value="30d">30 days</option>
          <option value="90d">90 days</option><option value="all">All time</option>
        </Sel>
      </div>

      <ErrorBanner msg={error} onRetry={load}/>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
            {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:66, borderRadius:'var(--radius-sm)' }}/>)}
          </div>
          <div className="skeleton" style={{ height:180, borderRadius:'var(--radius)' }}/>
        </div>
      ) : <>
        <KpiGrid cols="repeat(auto-fit,minmax(130px,1fr))">
          <Kpi label="Total PnL"    value={summary?.totalPnl != null ? `$${summary.totalPnl.toFixed(2)}` : '—'} color={(summary?.totalPnl??0)>=0?'var(--green)':'var(--red)'}/>
          <Kpi label="Win Rate"     value={summary?.winRate != null ? `${summary.winRate.toFixed(1)}%` : '—'}    color="var(--green)"/>
          <Kpi label="Profit Factor" value={summary?.profitFactor?.toFixed(2) ?? '—'}                             color="var(--gold)"/>
          <Kpi label="Expectancy"   value={summary?.expectancy != null ? `$${summary.expectancy.toFixed(2)}` : '—'}/>
          <Kpi label="Total Trades" value={summary?.totalTrades ?? 0}/>
        </KpiGrid>

        {/* Equity Curve with tooltip */}
        <Card style={{ marginTop:14 }}>
          <CardHeader><CardTitle>Equity Curve</CardTitle></CardHeader>
          <div style={{ padding:'10px 16px 14px', position:'relative' }} ref={wrapRef}>
            {curve.length ? (
              <>
                <svg ref={svgRef} style={{ width:'100%', height:140, display:'block', cursor:'crosshair' }}
                  onMouseMove={handleSvgMouseMove}
                  onMouseLeave={() => setTooltip(t => ({ ...t, visible:false }))}
                />
                {tooltip.visible && (
                  <div style={{ position:'absolute', left:tooltip.x + 10, top:tooltip.y, background:'var(--ink)', color:'#BAB5A0', fontSize:11, fontFamily:'var(--font-mono)', padding:'4px 9px', borderRadius:'var(--radius-sm)', pointerEvents:'none', whiteSpace:'nowrap', border:'1px solid rgba(201,168,76,0.2)', zIndex:20 }}>
                    {tooltip.text}
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon="◉" title="No equity data" sub="Connect a broker or log trades to see your equity curve"/>
            )}
          </div>
        </Card>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14 }}>

          {/* Open positions */}
          <Card>
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
              <span style={{ marginLeft:8, fontSize:10, color:'var(--muted)' }}>{positions.length} active</span>
            </CardHeader>
            {!positions.length ? <EmptyState icon="○" title="No open positions"/> : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['Symbol','Dir','Qty','Entry','P&L'].map(h => (
                    <th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'left' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{positions.map((p: any, i: number) => (
                    <tr key={i} style={{ transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12 }}>{p.sym}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',color:p.dir==='BUY'?'var(--green)':'var(--red)',fontWeight:700,fontSize:11 }}>{p.dir}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11 }}>{p.qty}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11 }}>{p.entryPrice?.toFixed(5)}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color:(p.unrealizedPnl??0)>=0?'var(--green)':'var(--red)' }}>
                        {p.unrealizedPnl != null ? `${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          {/* By symbol with proper PnL scale */}
          <Card>
            <CardHeader><CardTitle>Performance by Symbol</CardTitle></CardHeader>
            {!bySymArr.length ? <EmptyState title="No symbol data"/> : (
              <CardBody style={{ padding:0 }}>
                {bySymArr.map(([sym, v]: any, i: number) => {
                  const pos = (v.pnl ?? 0) >= 0;
                  const winPct  = v.winRate ?? 0;
                  const pnlPct  = Math.abs(v.pnl ?? 0) / maxAbsPnl * 100;
                  return (
                    <div key={sym} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid var(--border-2)' }}>
                      <strong style={{ fontFamily:'var(--font-mono)', fontSize:12, width:68, flexShrink:0 }}>{sym}</strong>
                      <div style={{ flex:1 }}>
                        {/* Win rate bar */}
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                          <div style={{ flex:1, height:3, background:'var(--cream-3)', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ width:`${winPct}%`, height:'100%', background:winPct>=50?'var(--green)':'var(--red)' }}/>
                          </div>
                          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--muted)', width:30, textAlign:'right' }}>{winPct.toFixed(0)}%</span>
                        </div>
                        {/* PnL bar */}
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:3, background:'var(--cream-3)', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ width:`${pnlPct}%`, height:'100%', background:pos?'var(--green)':'var(--red)' }}/>
                          </div>
                          <span style={{ fontSize:9, color:'var(--muted)', width:30, textAlign:'right' }}>{v.trades}T</span>
                        </div>
                      </div>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color:pos?'var(--green)':'var(--red)', flexShrink:0, width:70, textAlign:'right' }}>
                        {pos ? '+' : ''}${(v.pnl ?? 0).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            )}
          </Card>
        </div>
      </>}
    </div>
  );
}
