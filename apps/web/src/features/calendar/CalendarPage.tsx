'use client';
import { useState, useEffect } from 'react';
import { nexusCalendar } from '../../services/api.client';
import { Card, Btn, SectionHeader, SkeletonTable, EmptyState } from '../../components/ui/nx';
import { useRouter } from 'next/navigation';

const IMPACT_STYLE: Record<string,{bg:string;color:string}> = {
  high:   { bg:'var(--red-light)',  color:'var(--red)'   },
  medium: { bg:'#FFF3CD',           color:'#7A5500'       },
  low:    { bg:'var(--cream-3)',    color:'var(--muted)'  },
};

export default function CalendarPage() {
  const [events, setEvents]   = useState<any[]>([]);
  const [filter, setFilter]   = useState('all');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(()=>{ load(); },[]);
  async function load() {
    setLoading(true);
    try { const d=await nexusCalendar.events(); setEvents(d?.events??[]); }
    catch {} finally { setLoading(false); }
  }

  const visible = filter==='all'?events:events.filter(e=>e.impact===filter);
  const highCount = events.filter(e=>e.impact==='high').length;

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Economic Calendar" right={
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {highCount>0&&<span style={{ fontSize:11,fontWeight:600,color:'var(--red)',background:'var(--red-light)',padding:'3px 8px',borderRadius:4 }}>{highCount} high impact</span>}
          <Btn variant="ghost" small onClick={load}>↺ Refresh</Btn>
        </div>
      }/>

      {/* Impact filter */}
      <div style={{ display:'flex',gap:2,background:'var(--cream-2)',borderRadius:6,padding:3,border:'1px solid var(--border)',width:'fit-content',marginBottom:14 }}>
        {['all','high','medium','low'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'4px 14px',borderRadius:5,fontSize:11,fontWeight:500,cursor:'pointer',border:'none',background:filter===f?'white':'transparent',color:filter===f?'var(--ink)':'var(--muted)',boxShadow:filter===f?'0 1px 4px rgba(26,23,16,0.08)':'none',fontFamily:'var(--font-body)',textTransform:'capitalize' }}>{f==='all'?'All impacts':f}</button>
        ))}
      </div>

      <Card>
        {loading?<SkeletonTable rows={8}/>:visible.length===0?(
          <EmptyState icon="◷" title="No events" sub="No upcoming economic events match your filter"/>
        ):(
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr>
                {['Time (UTC)','Currency','Event','Impact','Forecast','Previous','Actual',''].map(h=>(
                  <th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'9px 12px',borderBottom:'1px solid var(--border)',textAlign:'left',whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {visible.map((e:any,i:number)=>{
                  const ist=IMPACT_STYLE[e.impact??'low'];
                  const isHigh=e.impact==='high';
                  return (
                    <tr key={i} style={{ transition:'background 0.1s',background:isHigh?'rgba(181,56,42,0.02)':'transparent' }}
                      onMouseEnter={ev=>ev.currentTarget.style.background='rgba(201,168,76,0.04)'}
                      onMouseLeave={ev=>ev.currentTarget.style.background=isHigh?'rgba(181,56,42,0.02)':'transparent'}>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:500 }}>{e.time??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12 }}>{e.currency??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontSize:12,fontWeight:isHigh?600:400,color:isHigh?'var(--ink)':'var(--ink-2)' }}>{e.event??e.title??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)' }}>
                        <span style={{ padding:'3px 9px',borderRadius:12,fontSize:9,fontWeight:700,textTransform:'uppercase',...ist }}>{e.impact??'—'}</span>
                      </td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)' }}>{e.forecast??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)' }}>{e.previous??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:e.actual!=null?(parseFloat(e.actual)>=(e.forecast?parseFloat(e.forecast):0)?'var(--green)':'var(--red)'):'var(--ink)',fontWeight:600 }}>{e.actual??'—'}</td>
                      <td style={{ padding:'10px 12px',borderBottom:'1px solid var(--border-2)' }}>
                        <button onClick={()=>router.push('/alerts')} style={{ padding:'3px 9px',background:'transparent',border:'1px solid var(--border)',borderRadius:4,fontSize:9,fontWeight:600,cursor:'pointer',color:'var(--muted)',fontFamily:'var(--font-body)',transition:'all 0.12s' }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>+ Alert</button>
                      </td>
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
