'use client';
import { useState, useEffect } from 'react';
import { useWsStore } from '../../state/ws-store';
import { Card, Btn, Sel, SectionHeader, BiasBadge, EmptyState } from '../../components/ui/nx';

export default function SignalsPage() {
  const { lastSignal,connected } = useWsStore();
  const [feed,       setFeed]       = useState<any[]>([]);
  const [filterSym,  setFilterSym]  = useState('ALL');
  const [filterBias, setFilterBias] = useState('ALL');

  useEffect(()=>{
    if(!lastSignal) return;
    setFeed(prev=>[{...lastSignal,receivedAt:Date.now()},...prev].slice(0,50));
  },[lastSignal]);

  const syms  = ['ALL','XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD','ETHUSD','XAGUSD','USOIL'];
  const biases = ['ALL','BULL','BEAR','WAIT'];
  const visible = feed.filter(f=>(filterSym==='ALL'||f.sym===filterSym)&&(filterBias==='ALL'||(f.bias??f.signal?.bias)===filterBias));

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Live Signals Feed" right={
        <Btn variant="ghost" small onClick={()=>setFeed([])}>Clear feed</Btn>
      }/>

      {/* Toolbar */}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14,flexWrap:'wrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:connected?'rgba(46,125,82,0.08)':'rgba(181,56,42,0.08)',border:`1px solid ${connected?'rgba(46,125,82,0.2)':'rgba(181,56,42,0.2)'}`,borderRadius:'var(--radius-sm)' }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:connected?'#2E7D52':'#B5382A',animation:connected?'pulse 2s infinite':'none',display:'inline-block' }}/>
          <span style={{ fontSize:11,fontWeight:600,color:connected?'var(--green)':'var(--red)' }}>{connected?'WebSocket live':'Disconnected'}</span>
          <span style={{ fontSize:10,color:'var(--muted)',marginLeft:4 }}>· {feed.length} signals</span>
        </div>
        <div style={{ flex:1 }}/>
        <Sel value={filterSym}  onChange={setFilterSym}  style={{ width:120 }}>{syms.map(s=><option key={s}>{s}</option>)}</Sel>
        <div style={{ display:'flex',gap:2,background:'var(--cream-2)',borderRadius:6,padding:3,border:'1px solid var(--border)' }}>
          {biases.map(b=>(
            <button key={b} onClick={()=>setFilterBias(b)} style={{ padding:'3px 10px',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer',border:'none',background:filterBias===b?'white':'transparent',color:filterBias===b?'var(--ink)':'var(--muted)',fontFamily:'var(--font-body)',transition:'all 0.12s' }}>{b}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {visible.length===0?(
          <EmptyState icon="◎" title="Waiting for signals" sub="Live signal updates arrive via WebSocket when the backend engine emits events"/>
        ):visible.map((s,i)=>{
          const bias=s.bias??s.signal?.bias??'WAIT';
          const entry=s.entry??s.signal?.entry;
          const sl=s.sl??s.signal?.sl;
          const tp1=s.tp1??s.signal?.tp1;
          const rr=s.rr??s.signal?.rr;
          const conv=s.conviction??s.signal?.conviction??0;
          const convCol=conv>=70?'var(--green)':conv>=40?'var(--gold)':'var(--red)';
          return (
            <Card key={i} style={{ animation:'fadeUp 0.2s ease' }}>
              <div style={{ padding:'14px 16px' }}>
                {/* Header row */}
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
                  <strong style={{ fontFamily:'var(--font-mono)',fontSize:14,color:'var(--ink)' }}>{s.sym}</strong>
                  <BiasBadge bias={bias}/>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginLeft:4 }}>
                    <div style={{ width:56,height:4,background:'var(--cream-3)',borderRadius:2,overflow:'hidden' }}>
                      <div style={{ width:`${conv}%`,height:'100%',background:convCol,borderRadius:2 }}/>
                    </div>
                    <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:convCol,fontWeight:600 }}>{conv}%</span>
                  </div>
                  <div style={{ marginLeft:'auto',display:'flex',flexDirection:'column',alignItems:'flex-end' }}>
                    <span style={{ fontSize:9,fontFamily:'var(--font-mono)',color:'var(--muted)' }}>{new Date(s.receivedAt).toLocaleTimeString()}</span>
                    {s.setup&&<span style={{ fontSize:10,color:'var(--ink-3)',marginTop:1 }}>{s.setup}</span>}
                  </div>
                </div>
                {/* Level grid */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
                  {[['Entry',entry,'var(--ink)'],['Stop Loss',sl,'var(--red)'],['TP1',tp1,'var(--green)'],['R:R',rr,'var(--gold)']].map(([l,v,c])=>(
                    <div key={l as string} style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px' }}>
                      <div style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:4 }}>{l}</div>
                      <div style={{ fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:c as string }}>
                        {v?(typeof v==='number'?(v as number).toFixed(5):v):'—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
