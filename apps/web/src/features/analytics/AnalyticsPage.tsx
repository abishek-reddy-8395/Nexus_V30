'use client';
import { useState, useEffect } from 'react';
import { nexusAnalytics } from '../../services/api.client';
import { Card,CardHeader,CardBody,CardTitle,KpiGrid,Kpi,Btn,SectionHeader,SkeletonPanel,SkeletonTable,EmptyState } from '../../components/ui/nx';

const BSIG_STYLE: Record<string,{bg:string;color:string}> = {
  emotional_trade:{ bg:'#FDE8E8', color:'var(--red)'   },
  revenge_trade:  { bg:'#FEF3CD', color:'#7A5500'       },
  overtrade:      { bg:'#E8F0FE', color:'var(--blue)'   },
  fomo_entry:     { bg:'#F0E8FE', color:'#5C3C9E'       },
  risk_drift:     { bg:'#E8F0FE', color:'var(--blue)'   },
  session_fatigue:{ bg:'#F0E8FE', color:'#5C3C9E'       },
};

export default function AnalyticsPage() {
  const [summary,    setSummary]    = useState<any>(null);
  const [perf,       setPerf]       = useState<any>(null);
  const [behavioral, setBehavioral] = useState<any>(null);
  const [calData,    setCalData]    = useState<any>(null);
  const [perfTab,    setPerfTab]    = useState('bySym');
  const [days,       setDays]       = useState(7);
  const [loading,    setLoading]    = useState(true);

  useEffect(()=>{ load(); },[]);

  async function load() {
    setLoading(true);
    try {
      const [s,p,b,c] = await Promise.allSettled([
        nexusAnalytics.summary(), nexusAnalytics.performance(),
        (nexusAnalytics as any).behavioral(days),
        (nexusAnalytics as any).calendar(),
      ]);
      if(s.status==='fulfilled') setSummary(s.value?.stats??s.value);
      if(p.status==='fulfilled') setPerf(p.value);
      if(b.status==='fulfilled') setBehavioral(b.value);
      if(c.status==='fulfilled') setCalData(c.value?.calendar??{});
    } finally { setLoading(false); }
  }

  const perfRows = perf?Object.entries((perf as any)[perfTab]??{]):[];

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Analytics & Behavioral Intelligence" right={
        <Btn variant="ghost" small onClick={load}>↺ Refresh</Btn>
      }/>

      {/* KPI strip */}
      {loading?(
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:14 }}>
          {[0,1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{ height:66,borderRadius:'var(--radius-sm)'}}/>)}
        </div>
      ):(
        <KpiGrid cols="repeat(auto-fit,minmax(130px,1fr))">
          <Kpi label="Win Rate"         value={summary?.winRate!=null?`${summary.winRate.toFixed(1)}%`:'—'}    color="var(--green)"/>
          <Kpi label="Expectancy"       value={summary?.expectancy!=null?`$${summary.expectancy.toFixed(2)}`:'—'}/>
          <Kpi label="Profit Factor"    value={summary?.profitFactor?.toFixed(2)??'—'}                         color="var(--gold)"/>
          <Kpi label="Total Trades"     value={summary?.totalTrades??0}/>
          <Kpi label="Total PnL"        value={summary?.totalPnl!=null?`$${summary.totalPnl.toFixed(2)}`:'—'}  color={(summary?.totalPnl??0)>=0?'var(--green)':'var(--red)'}/>
          <Kpi label="Behavioral Flags" value={behavioral?.summary?.totalSignals??0}                           color={(behavioral?.summary?.totalSignals??0)>0?'var(--red)':'var(--green)'}/>
        </KpiGrid>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14 }}>

        {/* Performance breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Breakdown</CardTitle>
            <div style={{ marginLeft:'auto',display:'flex',gap:2,background:'var(--cream-2)',borderRadius:6,padding:3,border:'1px solid var(--border)' }}>
              {[['bySym','By Symbol'],['byMode','By Mode'],['bySession','By Session']].map(([k,l])=>(
                <button key={k} onClick={()=>setPerfTab(k)} style={{ padding:'4px 10px',borderRadius:5,fontSize:11,fontWeight:500,cursor:'pointer',border:'none',background:perfTab===k?'white':'transparent',color:perfTab===k?'var(--ink)':'var(--muted)',boxShadow:perfTab===k?'0 1px 4px rgba(26,23,16,0.08)':'none',fontFamily:'var(--font-body)' }}>{l}</button>
              ))}
            </div>
          </CardHeader>
          {loading?<SkeletonTable rows={5}/>:!perfRows.length?<EmptyState title="No data" sub="Log trades to see breakdowns"/>:(
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr>{['Category','Trades','Win Rate','PnL'].map(h=><th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'left' }}>{h}</th>)}</tr></thead>
                <tbody>{perfRows.map(([k,v]:any)=>(
                  <tr key={k} onMouseEnter={e=>e.currentTarget.style.background='rgba(201,168,76,0.04)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} style={{ transition:'background 0.1s' }}>
                    <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontWeight:600,fontSize:12 }}>{k}</td>
                    <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontSize:12 }}>{v.trades}</td>
                    <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <div style={{ width:50,height:4,background:'var(--cream-3)',borderRadius:2 }}><div style={{ width:`${v.winRate??0}%`,height:'100%',background:(v.winRate??0)>=50?'var(--green)':'var(--red)' }}/></div>
                        <span style={{ fontSize:11,color:(v.winRate??0)>=50?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)' }}>{(v.winRate??0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:(v.pnl??0)>=0?'var(--green)':'var(--red)',fontWeight:600 }}>${(v.pnl??0).toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Behavioral signals */}
        <Card>
          <CardHeader>
            <CardTitle>Behavioral Signals</CardTitle>
            <select value={days} onChange={e=>setDays(Number(e.target.value))} style={{ marginLeft:'auto',background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 8px',fontSize:11,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',cursor:'pointer' }}>
              <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
            </select>
          </CardHeader>
          {loading?<SkeletonPanel rows={4}/>:!(behavioral?.signals?.length)?(
            <EmptyState icon="✓" title="No behavioral flags" sub="Clean trading pattern detected"/>
          ):(
            <CardBody style={{ padding:'8px 16px' }}>
              {behavioral.signals.map((s:any,i:number)=>{
                const st = BSIG_STYLE[s.signalType]??{ bg:'var(--cream-3)',color:'var(--muted)' };
                return (
                  <div key={i} style={{ padding:'12px 0',borderBottom:'1px solid var(--border-2)' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5 }}>
                      <span style={{ padding:'3px 10px',borderRadius:14,fontSize:10,fontWeight:600,background:st.bg,color:st.color }}>
                        {(s.signalType??'').replace(/_/g,' ')}
                      </span>
                      <span style={{ marginLeft:'auto',fontSize:10,fontFamily:'var(--font-mono)',color:'var(--muted)' }}>{((s.confidence??0)*100).toFixed(0)}% confidence</span>
                    </div>
                    <div style={{ fontSize:12,color:'var(--ink-2)',lineHeight:1.6 }}>{s.description}</div>
                  </div>
                );
              })}
            </CardBody>
          )}
        </Card>

        {/* PnL Heatmap */}
        <Card>
          <CardHeader><CardTitle>Daily PnL Heatmap</CardTitle></CardHeader>
          <CardBody>
            {loading?(
              <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4 }}>
                {Array.from({length:35}).map((_,i)=><div key={i} className="skeleton" style={{ aspectRatio:'1',borderRadius:3 }}/>)}
              </div>
            ):!calData||!Object.keys(calData).length?<EmptyState title="No PnL data"/>:(()=>{
              const entries = Object.entries(calData as Record<string,any>);
              const pnls = entries.map(([,v])=>v.pnl);
              const mx = Math.max(...pnls.map(Math.abs),1);
              return (
                <>
                  <div style={{ fontSize:11,color:'var(--muted)',marginBottom:10 }}>Daily PnL — last 35 sessions</div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4 }}>
                    {entries.slice(-35).map(([day,v]:[string,any])=>{
                      const pos=v.pnl>=0;
                      const alpha=0.15+Math.min(Math.abs(v.pnl)/mx,1)*0.7;
                      return (
                        <div key={day} title={`${day}: $${v.pnl.toFixed(2)} (${v.trades} trades)`}
                          style={{ aspectRatio:'1',borderRadius:4,background:pos?`rgba(46,125,82,${alpha})`:`rgba(181,56,42,${alpha})`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'default',transition:'transform 0.1s',border:'1px solid rgba(255,255,255,0.1)' }}
                          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
                          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                          <span style={{ fontSize:8,color:'var(--ink)',fontWeight:600 }}>{day.slice(8)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex',gap:16,marginTop:10,fontSize:10,color:'var(--muted)' }}>
                    <span style={{ color:'var(--green)' }}>■ Profit</span>
                    <span style={{ color:'var(--red)' }}>■ Loss</span>
                    <span style={{ marginLeft:'auto' }}>Darker = larger magnitude</span>
                  </div>
                </>
              );
            })()}
          </CardBody>
        </Card>

        {/* Insights summary */}
        <Card>
          <CardHeader><CardTitle>AI Insights</CardTitle></CardHeader>
          <CardBody>
            {loading?<SkeletonPanel rows={4}/>:<>
              {[
                { label:'Best session',     value:summary?.bestSession??'—',     color:'var(--green)' },
                { label:'Worst session',    value:summary?.worstSession??'—',    color:'var(--red)'   },
                { label:'Best instrument',  value:summary?.bestInstrument??'—',  color:'var(--green)' },
                { label:'Avg hold time',    value:summary?.avgHoldTime??'—',     color:'var(--ink)'   },
                { label:'Max drawdown',     value:summary?.maxDrawdown!=null?`${summary.maxDrawdown.toFixed(2)}%`:'—', color:'var(--red)' },
                { label:'Consecutive wins', value:summary?.maxConsecWins??0,      color:'var(--gold)'  },
              ].map(row=>(
                <div key={row.label} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border-2)' }}>
                  <span style={{ fontSize:12,color:'var(--muted)' }}>{row.label}</span>
                  <span style={{ fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:row.color }}>{row.value}</span>
                </div>
              ))}
            </>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
