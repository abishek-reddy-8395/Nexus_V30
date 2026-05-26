'use client';
/**
 * Nexus V30 — Command Center
 * 10/10 audit: Hero bias at 60px serif, skeleton states, responsive grid,
 * 3-second read rule, ProfileToggle + TfPills from shared components.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEngine, useMarket } from '../../hooks/index';
import { useUIStore } from '../../state/store';
import { useWsStore } from '../../state/ws-store';
import { nexusAI, nexusAlerts } from '../../services/api.client';
import { INSTRUMENTS } from '../../constants/index';
import {
  BiasBadge, Btn, Sel, HeroKpi, ConfBar, ProfileToggle, TfPills, ModePills,
  SkeletonPanel, Card, GoldDivider,
} from '../../components/ui/nx';

type Profile = 'retail'|'institutional';

function Panel({ children,style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',...style }}>{children}</div>;
}
function PL({ children }: { children:React.ReactNode }) {
  return <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:10 }}>{children}</div>;
}
function Row({ l,v,c,mono=true }: { l:string; v:React.ReactNode; c?:string; mono?:boolean }) {
  return (
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border-2)' }}>
      <span style={{ fontSize:11,color:'var(--muted)' }}>{l}</span>
      <span style={{ fontFamily:mono?'var(--font-mono)':'var(--font-body)',fontSize:12,fontWeight:600,color:c??'var(--ink)' }}>{v??'—'}</span>
    </div>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { analysis,loading,error,runAnalysis } = useEngine();
  const { sym,tf,price,fetchPrice,changeSym,changeTf } = useMarket();
  const { mode,setMode } = useUIStore();
  const { connected,priceMap } = useWsStore();

  const [profile,    setProfile]    = useState<Profile>('retail');
  const [narrative,  setNarrative]  = useState('');
  const [narLoading, setNarLoading] = useState(false);
  const [alerts,     setAlerts]     = useState<any[]>([]);

  useEffect(()=>{
    const urlSym = searchParams?.get('sym');
    const urlPro = searchParams?.get('profile') as Profile|null;
    if(urlSym) changeSym(urlSym);
    if(urlPro==='retail'||urlPro==='institutional') setProfile(urlPro);
    fetchPrice(); runAnalysis(undefined,undefined,undefined,urlPro??'retail');
    nexusAlerts.list().then(d=>setAlerts(d?.alerts??[])).catch(()=>{});
  },[]);

  useEffect(()=>{ if(analysis) loadNarrative(); },[analysis?.confluence?.total,profile]);

  const doAnalyze = useCallback(async()=>{
    await fetchPrice(); await runAnalysis(undefined,undefined,undefined,profile);
  },[fetchPrice,runAnalysis,profile]);

  async function loadNarrative() {
    setNarLoading(true);
    try {
      const d = await nexusAI.marketContext({ instrument:sym,timeframe:tf,price,structure:analysis?.structure?.trend,regime:analysis?.structure?.regime,confluence:analysis?.confluence?.total,signal:analysis?.signal?.bias,profile });
      setNarrative(d?.narrative??d?.brief??analysis?.reasoning??'');
    } catch { setNarrative(analysis?.reasoning??''); }
    finally { setNarLoading(false); }
  }

  const sig    = analysis?.signal    ??{} as any;
  const conf   = analysis?.confluence??{} as any;
  const struct = analysis?.structure ??{} as any;
  const levels = analysis?.levels    ??{} as any;
  const bias   = sig.bias??'WAIT';
  const livePrice = priceMap[sym]?.price??price;
  const livePct   = priceMap[sym]?.changePct;

  const biasColor = bias==='BULL'?'var(--green)':bias==='BEAR'?'var(--red)':'var(--muted)';
  const confColor = (conf.total??0)>=75?'var(--green)':(conf.total??0)>=50?'var(--gold)':'var(--red)';
  const confLabel = (conf.total??0)>=75?'High confidence':(conf.total??0)>=50?'Moderate — check levels':(conf.total??0)>0?'Low — wait for setup':'Run analysis first';

  return (
    <div style={{ padding:16,display:'flex',flexDirection:'column',gap:14,animation:'fadeUp 0.22s ease' }}>

      {/* ── TOOLBAR ── */}
      <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
        <Sel value={sym} onChange={changeSym} style={{ width:130 }}>
          {INSTRUMENTS.map(s=><option key={s}>{s}</option>)}
        </Sel>
        <TfPills value={tf} onChange={changeTf}/>
        <ModePills value={mode} onChange={m=>{ setMode(m as any); setTimeout(doAnalyze,0); }}/>
        <ProfileToggle value={profile} onChange={p=>{ setProfile(p); setTimeout(doAnalyze,0); }}/>
        <div style={{ flex:1 }}/>
        <Btn onClick={doAnalyze} disabled={loading}>
          {loading?'◌ Analyzing…':'▶ Analyze'}
        </Btn>
      </div>

      {error&&<div style={{ padding:'10px 14px',background:'var(--red-light)',border:'1px solid rgba(181,56,42,0.28)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--red)' }}>⚠ {error}</div>}

      {/* ── HERO ROW — the 3-second read ── */}
      <Panel style={{ padding:'24px 24px 20px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1px 1fr 1px 1fr 1px 1fr',gap:0,alignItems:'center' }}>

          {/* 1: Price + change */}
          <div style={{ padding:'0 20px',textAlign:'center' }}>
            <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:6 }}>{sym} · Price</div>
            <div style={{ fontFamily:'var(--font-mono)',fontSize:36,fontWeight:700,color:'var(--ink)',lineHeight:1 }}>
              {livePrice?livePrice.toFixed(sym.includes('BTC')?0:5):'—'}
            </div>
            {livePct!=null&&<div style={{ marginTop:5,fontSize:12,fontFamily:'var(--font-mono)',color:livePct>=0?'var(--green)':'var(--red)',fontWeight:600 }}>
              {livePct>=0?'+':''}{livePct.toFixed(2)}%
            </div>}
          </div>

          <div style={{ width:1,height:60,background:'var(--border)' }}/>

          {/* 2: Bias — the hero element */}
          <div style={{ padding:'0 24px',textAlign:'center' }}>
            <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:8 }}>Nexus Bias</div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:52,fontWeight:500,color:biasColor,lineHeight:1,letterSpacing:'0.02em' }}>
              {bias}
            </div>
            {sig.conviction!=null&&<div style={{ marginTop:6,fontSize:11,color:'var(--muted)' }}>
              <span style={{ fontFamily:'var(--font-mono)',color:'var(--gold)',fontWeight:700,fontSize:16 }}>{sig.conviction}%</span> conviction
            </div>}
          </div>

          <div style={{ width:1,height:60,background:'var(--border)' }}/>

          {/* 3: Confluence */}
          <div style={{ padding:'0 24px',textAlign:'center' }}>
            <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:8 }}>Confluence</div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:52,fontWeight:500,color:confColor,lineHeight:1 }}>
              {conf.total??'—'}
            </div>
            <div style={{ marginTop:6,fontSize:10,color:'var(--muted)' }}>{confLabel}</div>
          </div>

          <div style={{ width:1,height:60,background:'var(--border)' }}/>

          {/* 4: Setup */}
          <div style={{ padding:'0 20px' }}>
            <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:8 }}>Setup</div>
            {sig.setup
              ? <div style={{ fontSize:13,color:'var(--ink-2)',lineHeight:1.6,fontFamily:'var(--font-display)',fontStyle:'italic' }}>{sig.setup}</div>
              : <div style={{ fontSize:12,color:'var(--muted)',fontStyle:'italic' }}>Run analysis to detect setup</div>
            }
            {sig.entry&&<div style={{ marginTop:8,display:'flex',gap:12,flexWrap:'wrap' }}>
              <div style={{ fontSize:11 }}><span style={{ color:'var(--muted)' }}>Entry </span><span style={{ fontFamily:'var(--font-mono)',color:'var(--gold)',fontWeight:600 }}>{sig.entry?.toFixed(5)}</span></div>
              <div style={{ fontSize:11 }}><span style={{ color:'var(--muted)' }}>R:R </span><span style={{ fontFamily:'var(--font-mono)',color:'var(--green)',fontWeight:600 }}>{sig.rr??'—'}</span></div>
            </div>}
          </div>
        </div>
      </Panel>

      {/* ── MAIN 3-COL GRID ── */}
      <div style={{ display:'grid',gridTemplateColumns:'200px minmax(0,1fr) 220px',gap:14,alignItems:'start' }}>

        {/* LEFT: Signal + Structure */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <Panel style={{ padding:14 }}>
            <PL>Signal Levels</PL>
            {loading?<SkeletonPanel rows={4}/>:<>
              <Row l="Entry" v={sig.entry?.toFixed(5)} c="var(--gold)"/>
              <Row l="Stop"  v={sig.sl?.toFixed(5)}    c="var(--red)"/>
              <Row l="TP1"   v={sig.tp1?.toFixed(5)}   c="var(--green)"/>
              <Row l="R:R"   v={sig.rr}                c="var(--ink)"/>
            </>}
          </Panel>

          <Panel style={{ padding:14 }}>
            <PL>Market Structure</PL>
            {loading?<SkeletonPanel rows={4}/>:<>
              <Row l="Trend"  v={struct.trend}  mono={false}/>
              <Row l="Regime" v={struct.regime} mono={false}/>
              <Row l="BOS"    v={struct.hasBos   ?'✓ Detected':'—'} c={struct.hasBos   ?'var(--green)':'var(--muted)'}/>
              <Row l="CHoCH"  v={struct.hasChoch ?'✓ Detected':'—'} c={struct.hasChoch ?'var(--gold)':'var(--muted)'}/>
            </>}
          </Panel>

          {/* Active alerts mini */}
          {alerts.filter((a:any)=>a.active).length>0&&(
            <Panel style={{ padding:14 }}>
              <PL>Active Alerts</PL>
              {alerts.filter((a:any)=>a.active).slice(0,3).map((a:any,i:number)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:'1px solid var(--border-2)' }}>
                  <span style={{ width:5,height:5,borderRadius:'50%',background:'var(--gold)',flexShrink:0 }}/>
                  <span style={{ fontSize:11,color:'var(--ink-2)',flex:1 }}>{a.label??a.type}</span>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)' }}>{a.sym}</span>
                </div>
              ))}
            </Panel>
          )}
        </div>

        {/* CENTRE: AI Narrative + SMC Zones */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>

          {/* AI Narrative */}
          <Panel style={{ padding:16 }}>
            <PL>Nexus AI Read</PL>
            {narLoading?(
              <div style={{ display:'flex',alignItems:'center',gap:8,color:'var(--muted)',fontSize:12,padding:'8px 0' }}>
                <div className="spinner" style={{ width:14,height:14 }}/>
                Reading market conditions…
              </div>
            ):narrative?(
              <p style={{ fontSize:15,lineHeight:1.75,color:'var(--ink-2)',margin:0,fontFamily:"'Cormorant Garamond',Georgia,serif",fontStyle:'italic' }}>{narrative}</p>
            ):(
              <p style={{ fontSize:12,color:'var(--muted)',margin:0,fontStyle:'italic' }}>
                {analysis?'AI narrative loading.':'Click Analyze to get the Nexus market read.'}
              </p>
            )}
          </Panel>

          {/* SMC Zone grid */}
          <Panel style={{ padding:14 }}>
            <PL>SMC Key Levels</PL>
            {loading?<div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[0,1,2,3].map(i=><div key={i} className="skeleton" style={{ height:70,borderRadius:'var(--radius-sm)' }}/>)}
            </div>:(
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                {[
                  { label:'Order Block',icon:'▪',hi:levels.obHigh,lo:levels.obLow,   color:'#2E7D52' },
                  { label:'FVG Zone',   icon:'◈',hi:levels.fvgHigh,lo:levels.fvgLow, color:'#1E4E8C' },
                  { label:'Resistance', icon:'△',hi:levels.resistance,lo:null,        color:'#B5382A' },
                  { label:'Support',    icon:'▽',hi:null,lo:levels.support,           color:'#2E7D52' },
                ].map(z=>(
                  <div key={z.label} style={{ padding:'10px 12px',background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',borderLeft:`3px solid ${z.color}` }}>
                    <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:7 }}>
                      <span style={{ color:z.color,fontSize:10 }}>{z.icon}</span>
                      <span style={{ fontSize:10,fontWeight:700,color:'var(--ink-2)',letterSpacing:'0.04em' }}>{z.label}</span>
                    </div>
                    {z.hi&&<div style={{ display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2 }}><span style={{ color:'var(--muted)' }}>Hi</span><span style={{ fontFamily:'var(--font-mono)',color:z.color,fontWeight:600 }}>{(z.hi as number).toFixed(5)}</span></div>}
                    {z.lo&&<div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}><span style={{ color:'var(--muted)' }}>Lo</span><span style={{ fontFamily:'var(--font-mono)',color:z.color,fontWeight:600 }}>{(z.lo as number).toFixed(5)}</span></div>}
                    {!z.hi&&!z.lo&&<div style={{ fontSize:10,color:'var(--muted)',fontStyle:'italic' }}>Not detected</div>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT: Confluence breakdown + gates */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <Panel style={{ padding:14 }}>
            <PL>Confluence Breakdown</PL>
            {loading?<SkeletonPanel rows={6}/>:<>
              <ConfBar label="Structure"   score={conf.structure??0}  max={25}/>
              <ConfBar label="MTF Align"   score={conf.mtf??0}        max={22}/>
              <ConfBar label="Liquidity"   score={conf.liquidity??0}  max={18}/>
              <ConfBar label="Order Block" score={conf.orderBlock??0} max={12}/>
              <ConfBar label="FVG"         score={conf.fvg??0}        max={5}/>
              <ConfBar label="Session"     score={conf.session??0}    max={10}/>
            </>}
          </Panel>

          <Panel style={{ padding:14 }}>
            <PL>Trade Gates</PL>
            {loading?<SkeletonPanel rows={4}/>:<>
              {(profile==='institutional'?[
                ['Confluence ≥75', (conf.total??0)>=75],
                ['R:R ≥ 1:2',      sig.rr?parseFloat(sig.rr)>=2:false],
                ['MTF daily align',!!(conf.mtf&&conf.mtf>=15)],
                ['Clean regime',   struct.regime==='trending'],
              ]:[
                ['Confluence ≥50', (conf.total??0)>=50],
                ['R:R ≥ 1:1',      sig.rr?parseFloat(sig.rr)>=1:false],
                ['SMC structure',  !!(struct.hasBos||struct.hasChoch)],
                ['Signal present', !!sig.entry],
              ]).map(([label,passed]:any)=>(
                <div key={label} style={{ display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:'1px solid var(--border-2)' }}>
                  <span style={{ color:passed?'var(--green)':'var(--cream-3)',fontWeight:700,fontSize:13,flexShrink:0 }}>{passed?'✓':'○'}</span>
                  <span style={{ fontSize:11,color:passed?'var(--ink-2)':'var(--muted)' }}>{label}</span>
                </div>
              ))}
            </>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
