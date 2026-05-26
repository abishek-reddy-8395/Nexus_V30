'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nexusScanner } from '../../services/api.client';
import { INSTRUMENTS, TIMEFRAMES } from '../../constants/index';
import { Card, CardHeader, CardBody, CardTitle, Btn, Sel, SectionHeader, BiasBadge, SkeletonTable, EmptyState, ErrorBanner, ProfileToggle, TfPills, ModePills } from '../../components/ui/nx';

export default function ScannerPage() {
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<'retail'|'institutional'>('retail');
  const [tf, setTf] = useState(15);
  const [mode, setMode] = useState('intraday');
  const [lastScan, setLastScan] = useState<number|null>(null);

  useEffect(()=>{ runScan(); },[]);

  async function runScan() {
    setScanning(true); setError('');
    try {
      const d = await nexusScanner.run(undefined,tf,profile);
      const res = d?.results??d?.signals??[];
      setResults([...res].sort((a:any,b:any)=>(b.signal?.conviction??0)-(a.signal?.conviction??0)));
      setLastScan(Date.now());
    } catch(e:any){ setError(e?.error??e?.message??'Scan failed'); }
    finally { setScanning(false); }
  }

  const drillIn = (sym:string)=>router.push(`/dashboard?sym=${sym}`);
  const biasColor = (b:string)=>b==='BULL'?'var(--green)':b==='BEAR'?'var(--red)':'var(--muted)';
  const confColor = (n:number)=>n>=75?'var(--green)':n>=50?'var(--gold)':'var(--red)';

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="SMC Scanner" right={
        <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--muted)' }}>
          {lastScan&&<span>Last scan {new Date(lastScan).toLocaleTimeString()}</span>}
        </div>
      }/>

      {/* Toolbar */}
      <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14 }}>
        <TfPills value={tf} onChange={setTf}/>
        <ModePills value={mode} onChange={setMode}/>
        <ProfileToggle value={profile} onChange={setProfile}/>
        <div style={{ flex:1 }}/>
        <Btn onClick={runScan} disabled={scanning}>{scanning?'◌ Scanning…':'⊞ Scan All'}</Btn>
      </div>

      <ErrorBanner msg={error} onRetry={runScan}/>

      {/* Heat map strip */}
      {results.length>0&&(
        <div style={{ display:'flex',gap:6,marginBottom:14,flexWrap:'wrap' }}>
          {results.map((r:any)=>{
            const b = r.signal?.bias??'WAIT';
            const c = r.confluence?.total??0;
            const bg = b==='BULL'?`rgba(46,125,82,${0.1+(c/100)*0.5})`:b==='BEAR'?`rgba(181,56,42,${0.1+(c/100)*0.5})`:'var(--cream-3)';
            return (
              <div key={r.sym} onClick={()=>drillIn(r.sym)} title={`${r.sym}: ${b} · Confluence ${c}`} style={{
                flex:'1 0 60px',padding:'8px 6px',borderRadius:'var(--radius-sm)',background:bg,
                border:`1px solid ${b==='BULL'?'rgba(46,125,82,0.3)':b==='BEAR'?'rgba(181,56,42,0.3)':'var(--border)'}`,
                textAlign:'center',cursor:'pointer',transition:'transform 0.12s,box-shadow 0.12s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-md)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
                <div style={{ fontSize:9,fontWeight:700,color:'var(--ink-2)',letterSpacing:'0.06em' }}>{r.sym.replace('USD','')}</div>
                <div style={{ fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:biasColor(b),marginTop:2 }}>{c}</div>
                <div style={{ fontSize:8,color:'var(--muted)',marginTop:1 }}>{b}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Instrument Rankings</CardTitle>
          <span style={{ marginLeft:8,fontSize:10,color:'var(--muted)' }}>{results.length} instruments · ranked by conviction</span>
        </CardHeader>
        {scanning?<SkeletonTable rows={8}/>:results.length===0?(
          <EmptyState icon="⊞" title="No scan results" sub="Click Scan All to analyse all instruments"/>
        ):(
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Symbol','Bias','Conviction','Confluence','Regime','R:R','Entry','SL','TP1',''].map(h=>(
                  <th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'9px 10px',borderBottom:'1px solid var(--border)',textAlign:'left',whiteSpace:'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {results.map((r:any)=>{
                  const s=r.signal??{}, conf=r.confluence??{}, str=r.structure??{};
                  const conv=s.conviction??0, bias=s.bias??'WAIT';
                  return (
                    <tr key={r.sym} onClick={()=>drillIn(r.sym)} style={{ cursor:'pointer',transition:'background 0.1s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(201,168,76,0.05)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)' }}><strong style={{ fontFamily:'var(--font-mono)',fontSize:13 }}>{r.sym}</strong></td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)' }}><BiasBadge bias={bias}/></td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <div style={{ width:54,height:4,background:'var(--cream-3)',borderRadius:2,overflow:'hidden' }}>
                            <div style={{ width:`${conv}%`,height:'100%',background:conv>=70?'var(--green)':conv>=40?'var(--gold)':'var(--red)' }}/>
                          </div>
                          <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--ink)' }}>{conv}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontWeight:600,color:confColor(conf.total??0) }}>{conf.total??0}</td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)' }}>
                        <span style={{ padding:'2px 7px',borderRadius:4,fontSize:9,fontWeight:700,textTransform:'uppercase',background:bias==='BULL'?'var(--green-light)':bias==='BEAR'?'var(--red-light)':'var(--cream-3)',color:biasColor(bias) }}>{str.regime??'—'}</span>
                      </td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',color:'var(--green)',fontWeight:600 }}>{s.rr??'—'}</td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11 }}>{s.entry?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--red)' }}>{s.sl?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--green)' }}>{s.tp1?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'10px',borderBottom:'1px solid var(--border-2)' }}><Btn small onClick={()=>drillIn(r.sym)}>Open</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
