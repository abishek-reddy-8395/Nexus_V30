'use client';
import { useState, useEffect } from 'react';
import { useWsStore } from '../../state/ws-store';
import { nexusAlerts } from '../../services/api.client';
import { Card,CardHeader,CardBody,CardTitle,Btn,Sel,Inp,FormGroup,SectionHeader,SkeletonTable,EmptyState,ErrorBanner,useToast } from '../../components/ui/nx';

const TYPE_STYLE: Record<string,{bg:string;color:string}> = {
  price:      { bg:'#FFF3CD',          color:'#7A5500'      },
  signal:     { bg:'var(--green-light)',color:'var(--green)' },
  confluence: { bg:'var(--blue-light)', color:'var(--blue)'  },
};
const SYMS=['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD','ETHUSD','XAGUSD','USOIL'];

export default function AlertsPage() {
  const { toast } = useToast();
  const { lastAlert } = useWsStore();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading,setLoading]= useState(true);
  const [error,  setError]  = useState('');
  const [sym,    setSym]    = useState('XAUUSD');
  const [type,   setType]   = useState('price');
  const [label,  setLabel]  = useState('');
  const [cond,   setCond]   = useState('{"above": 2400}');

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ if(lastAlert) load(); },[lastAlert]);

  async function load() {
    try { const d=await nexusAlerts.list(); setAlerts(d?.alerts??[]); setError(''); }
    catch(e:any){ setError(e?.error??e?.message??'Failed to load alerts'); }
    finally { setLoading(false); }
  }
  async function create() {
    let condition={};
    try{ condition=JSON.parse(cond); } catch{ toast('Invalid JSON in condition field','error'); return; }
    if(!label){ toast('Label is required','warning'); return; }
    try { await nexusAlerts.create({sym,type,label,condition}); setLabel(''); toast('Alert created','success'); load(); }
    catch(e:any){ toast(e?.error??e?.message??'Failed','error'); }
  }
  async function remove(id:string) {
    try{ await nexusAlerts.remove(id); toast('Alert removed','info'); load(); }
    catch(e:any){ toast(e?.error??'Failed','error'); }
  }
  async function toggle(id:string) {
    try{ await nexusAlerts.toggle(id); load(); }
    catch(e:any){ toast(e?.error??'Failed','error'); }
  }

  const active=alerts.filter((a:any)=>a.active&&!a.triggered).length;

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Alert Manager" right={
        <span style={{ fontSize:11,color:active>0?'var(--green)':'var(--muted)',fontWeight:600 }}>{active} active</span>
      }/>

      <ErrorBanner msg={error} onRetry={load}/>

      {/* Triggered notification */}
      {lastAlert&&(
        <div style={{ marginBottom:14,padding:'11px 16px',background:'rgba(46,125,82,0.09)',border:'1px solid rgba(46,125,82,0.28)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--green)',display:'flex',alignItems:'center',gap:8,animation:'fadeUp 0.3s ease' }}>
          <span style={{ fontSize:16,flexShrink:0 }}>△</span>
          <div>
            <strong>{lastAlert.label??lastAlert.sym}</strong> triggered!
            <span style={{ color:'var(--muted)',marginLeft:6,fontSize:10 }}>{lastAlert.type} · {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 300px',gap:14 }}>

        {/* Alerts list */}
        <Card>
          <CardHeader><CardTitle>Alert List</CardTitle></CardHeader>
          {loading?<SkeletonTable rows={5}/>:alerts.length===0?(
            <EmptyState icon="△" title="No alerts created" sub="Create a price level, signal, or confluence alert to get notified"/>
          ):(
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr>{['Symbol','Type','Label','Status','Actions'].map(h=>(
                  <th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'9px 12px',borderBottom:'1px solid var(--border)',textAlign:'left' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{alerts.map((a:any)=>{
                  const ts=TYPE_STYLE[a.type]??{ bg:'var(--cream-3)',color:'var(--muted)' };
                  return (
                    <tr key={a.id} style={{ transition:'background 0.1s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(201,168,76,0.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'9px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12 }}>{a.sym}</td>
                      <td style={{ padding:'9px 12px',borderBottom:'1px solid var(--border-2)' }}>
                        <span style={{ padding:'2px 8px',borderRadius:12,fontSize:9,fontWeight:700,textTransform:'uppercase',...ts }}>{a.type}</span>
                      </td>
                      <td style={{ padding:'9px 12px',borderBottom:'1px solid var(--border-2)',fontSize:12 }}>{a.label??'—'}</td>
                      <td style={{ padding:'9px 12px',borderBottom:'1px solid var(--border-2)' }}>
                        <span style={{ fontSize:11,fontWeight:600,color:a.triggered?'var(--red)':a.active?'var(--green)':'var(--muted)' }}>
                          {a.triggered?'● Triggered':a.active?'● Active':'○ Paused'}
                        </span>
                      </td>
                      <td style={{ padding:'9px 12px',borderBottom:'1px solid var(--border-2)' }}>
                        <div style={{ display:'flex',gap:5 }}>
                          <Btn small variant="ghost" onClick={()=>toggle(a.id)}>{a.active?'Pause':'Resume'}</Btn>
                          <Btn small variant="danger" onClick={()=>remove(a.id)}>✕</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Create alert form */}
        <Card>
          <CardHeader><CardTitle>Create Alert</CardTitle></CardHeader>
          <CardBody>
            <FormGroup label="Symbol"><Sel value={sym} onChange={setSym}>{SYMS.map(s=><option key={s}>{s}</option>)}</Sel></FormGroup>
            <FormGroup label="Type">
              <div style={{ display:'flex',gap:2,background:'var(--cream-2)',borderRadius:6,padding:3,border:'1px solid var(--border)' }}>
                {['price','signal','confluence'].map(t=>(
                  <button key={t} onClick={()=>setType(t)} style={{ flex:1,padding:'5px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer',border:'none',background:type===t?'white':'transparent',color:type===t?'var(--ink)':'var(--muted)',fontFamily:'var(--font-body)',textTransform:'capitalize',transition:'all 0.12s' }}>{t}</button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="Label *"><Inp value={label} onChange={setLabel} placeholder="e.g. Gold above 2400"/></FormGroup>
            <FormGroup label="Condition (JSON)">
              <textarea value={cond} onChange={e=>setCond(e.target.value)} rows={3}
                style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:11,color:'var(--ink)',fontFamily:'var(--font-mono)',outline:'none',width:'100%',resize:'vertical' }}/>
            </FormGroup>
            <div style={{ fontSize:10,color:'var(--muted)',marginBottom:12,lineHeight:1.7 }}>
              Examples:<br/>
              Price: <code style={{ fontFamily:'var(--font-mono)',fontSize:10 }}>{"{"}"above": 2400{"}"}</code><br/>
              Signal: <code style={{ fontFamily:'var(--font-mono)',fontSize:10 }}>{"{"}"bias": "BULL"{"}"}</code><br/>
              Confluence: <code style={{ fontFamily:'var(--font-mono)',fontSize:10 }}>{"{"}"min": 75{"}"}</code>
            </div>
            <Btn onClick={create} style={{ width:'100%' }}>+ Create Alert</Btn>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
