'use client';
import { useState, useEffect } from 'react';
import { nexusJournal,nexusCopilot } from '../../services/api.client';
import { Card,CardHeader,CardBody,CardTitle,KpiGrid,Kpi,Btn,Sel,Inp,FormGroup,SectionHeader,SkeletonTable,EmptyState,GoldDivider,ErrorBanner,useToast,useConfirm } from '../../components/ui/nx';

export default function JournalPage() {
  const { toast } = useToast(); const confirm = useConfirm();
  const [entries,setEntries]  = useState<any[]>([]);
  const [stats,  setStats]    = useState<any>(null);
  const [loading,setLoading]  = useState(true);
  const [error,  setError]    = useState('');
  const [showForm,setShowForm]= useState(false);
  const [insight, setInsight] = useState('');
  const [insightLoad,setIL]   = useState(false);
  const [debrief, setDebrief] = useState('');
  const [debriefLoad,setDL]   = useState(false);
  const [form,setForm] = useState({ sym:'XAUUSD',dir:'BUY',mode:'intraday',entry:'',sl:'',tp1:'',conviction:'',result:'',pnl:'',notes:'' });
  const f = (k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{ load(); },[]);
  async function load() {
    setLoading(true); setError('');
    try {
      const [list,st]=await Promise.all([nexusJournal.list(),nexusJournal.stats()]);
      setEntries(list?.entries??[]); setStats(st?.stats??st);
    } catch(e:any){setError(e?.error??e?.message??'Failed to load journal');}
    finally{setLoading(false);}
  }
  async function addEntry() {
    if(!form.entry){toast('Entry price required','error');return;}
    const n=(k:string)=>form[k as keyof typeof form]?parseFloat(form[k as keyof typeof form] as string):undefined;
    try {
      await nexusJournal.add({...form,entry:parseFloat(form.entry),sl:n('sl'),tp1:n('tp1'),conviction:form.conviction?parseInt(form.conviction):undefined,pnl:n('pnl'),result:form.result||undefined});
      toast('Trade logged!','success'); setShowForm(false);
      setForm({sym:'XAUUSD',dir:'BUY',mode:'intraday',entry:'',sl:'',tp1:'',conviction:'',result:'',pnl:'',notes:''});
      load();
    } catch(e:any){toast(e?.error??e?.message??'Failed','error');}
  }
  async function delEntry(id:string) {
    if(!await confirm('Delete this entry? This cannot be undone.')) return;
    try{await nexusJournal.remove(id);toast('Deleted','info');load();}
    catch(e:any){toast(e?.error??'Failed','error');}
  }
  async function getInsight() {
    setIL(true);
    try{const d=await nexusCopilot.journalInsight(form.notes||'Recent trade');setInsight(d?.insight??d?.response??'No insight.');}
    catch{setInsight('AI insight unavailable.');}finally{setIL(false);}
  }
  async function getDebrief() {
    setDL(true);
    try{const d=await nexusCopilot.sessionDebrief(entries.slice(0,20));setDebrief(d?.debrief??d?.response??'No debrief.');}
    catch{setDebrief('Session debrief unavailable.');}finally{setDL(false);}
  }

  const SYMS=['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD','ETHUSD','XAGUSD','USOIL'];

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Trade Journal" right={
        <Btn small onClick={()=>setShowForm(!showForm)}>
          {showForm?'✕ Cancel':'+ Log Trade'}
        </Btn>
      }/>
      <ErrorBanner msg={error} onRetry={load}/>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 280px',gap:14 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:14,minWidth:0 }}>

          {/* Add form */}
          {showForm&&<Card style={{ animation:'fadeUp 0.2s ease' }}>
            <CardHeader><CardTitle>Log New Trade</CardTitle></CardHeader>
            <CardBody>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
                <FormGroup label="Symbol"><Sel value={form.sym} onChange={v=>f('sym',v)}>{SYMS.map(s=><option key={s}>{s}</option>)}</Sel></FormGroup>
                <FormGroup label="Direction">
                  <div style={{ display:'flex',gap:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden' }}>
                    {['BUY','SELL'].map(d=>(
                      <button key={d} onClick={()=>f('dir',d)} style={{ flex:1,padding:'7px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)',background:form.dir===d?(d==='BUY'?'var(--green)':'var(--red)'):'var(--cream-2)',color:form.dir===d?'#fff':'var(--muted)',transition:'all 0.12s' }}>{d}</button>
                    ))}
                  </div>
                </FormGroup>
                <FormGroup label="Mode"><Sel value={form.mode} onChange={v=>f('mode',v)}><option value="intraday">Intraday</option><option value="scalp">Scalp</option><option value="positional">Positional</option></Sel></FormGroup>
                <FormGroup label="Entry *">      <Inp type="number" value={form.entry}      onChange={v=>f('entry',v)}      placeholder="2350.00"/></FormGroup>
                <FormGroup label="Stop Loss">    <Inp type="number" value={form.sl}         onChange={v=>f('sl',v)}         placeholder="2340.00"/></FormGroup>
                <FormGroup label="Take Profit">  <Inp type="number" value={form.tp1}        onChange={v=>f('tp1',v)}        placeholder="2380.00"/></FormGroup>
                <FormGroup label="Conviction %"> <Inp type="number" value={form.conviction} onChange={v=>f('conviction',v)} placeholder="0–100"/></FormGroup>
                <FormGroup label="Result"><Sel value={form.result} onChange={v=>f('result',v)}><option value="">Open</option><option value="win">Win</option><option value="loss">Loss</option><option value="be">Break Even</option></Sel></FormGroup>
                <FormGroup label="PnL ($)">      <Inp type="number" value={form.pnl}        onChange={v=>f('pnl',v)}        placeholder="250"/></FormGroup>
              </div>
              <FormGroup label="Notes">
                <textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={3} placeholder="Setup rationale, entry trigger, lessons learned…"
                  style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:12,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',width:'100%',resize:'vertical' }}/>
              </FormGroup>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                <Btn onClick={addEntry}>Save Entry</Btn>
                <Btn onClick={()=>setShowForm(false)} variant="ghost">Cancel</Btn>
                <Btn onClick={getInsight} variant="ghost" disabled={insightLoad} style={{ marginLeft:'auto' }}>{insightLoad?'◌':'✦'} AI Insight</Btn>
              </div>
              {insight&&<div style={{ marginTop:10,padding:12,background:'rgba(201,168,76,0.07)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--ink-2)',lineHeight:1.75,fontFamily:'var(--font-display)',fontStyle:'italic' }}>{insight}</div>}
            </CardBody>
          </Card>}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
              <span style={{ marginLeft:8,fontSize:10,color:'var(--muted)' }}>{entries.length} entries</span>
            </CardHeader>
            {loading?<SkeletonTable rows={6}/>:entries.length===0?(
              <EmptyState icon="≡" title="No trades logged yet" sub="Click '+ Log Trade' to record your first trade"/>
            ):(
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead><tr>{['Date','Symbol','Dir','Mode','Entry','SL','TP','Result','PnL','Conv',''].map(h=>(
                    <th key={h} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'8px 10px',borderBottom:'1px solid var(--border)',textAlign:'left',whiteSpace:'nowrap' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{entries.map((e:any)=>(
                    <tr key={e.id} style={{ transition:'background 0.1s' }}
                      onMouseEnter={ev=>ev.currentTarget.style.background='rgba(201,168,76,0.04)'}
                      onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:10 }}>{new Date(e.ts||e.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)' }}><strong style={{ fontFamily:'var(--font-mono)',fontSize:12 }}>{e.sym}</strong></td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',color:e.dir==='BUY'?'var(--green)':'var(--red)',fontWeight:700,fontSize:11 }}>{e.dir}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontSize:11,textTransform:'capitalize' }}>{e.mode||'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11 }}>{e.entry?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--red)' }}>{e.sl?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--green)' }}>{e.tp1?.toFixed(5)??'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontWeight:700,fontSize:11,textTransform:'uppercase',color:e.result==='win'?'var(--green)':e.result==='loss'?'var(--red)':'var(--muted)' }}>{e.result||'Open'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color:(e.pnl??0)>=0?'var(--green)':'var(--red)' }}>{e.pnl!=null?`${e.pnl>=0?'+':''}$${Math.abs(e.pnl).toFixed(2)}`:'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--gold)' }}>{e.conviction!=null?e.conviction+'%':'—'}</td>
                      <td style={{ padding:'8px 10px',borderBottom:'1px solid var(--border-2)' }}><Btn small variant="danger" onClick={()=>delEntry(e.id)}>✕</Btn></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <Card>
            <CardHeader><CardTitle>Performance Stats</CardTitle></CardHeader>
            {loading?(
              <CardBody><div style={{ display:'flex',flexDirection:'column',gap:8 }}>{[0,1,2,3].map(i=><div key={i} className="skeleton" style={{ height:52,borderRadius:'var(--radius-sm)' }}/>)}</div></CardBody>
            ):!stats?(
              <EmptyState title="No stats yet" sub="Log trades to see performance"/>
            ):(
              <CardBody>
                <KpiGrid cols="1fr 1fr">
                  <Kpi label="Win Rate"      value={stats.winRate!=null?`${stats.winRate.toFixed(1)}%`:'—'}         color="var(--green)"/>
                  <Kpi label="Profit Factor" value={stats.profitFactor?.toFixed(2)??'—'}                             color="var(--gold)"/>
                  <Kpi label="Expectancy"    value={stats.expectancy!=null?`$${stats.expectancy.toFixed(2)}`:'—'}/>
                  <Kpi label="Total PnL"     value={stats.totalPnl!=null?`$${stats.totalPnl.toFixed(2)}`:'—'}        color={(stats.totalPnl??0)>=0?'var(--green)':'var(--red)'}/>
                  <Kpi label="Trades"        value={stats.totalTrades??0}/>
                  <Kpi label="W / L"         value={`${stats.wins??0}/${stats.losses??0}`}/>
                </KpiGrid>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>AI Session Debrief</CardTitle></CardHeader>
            <CardBody>
              <p style={{ fontSize:12,color:'var(--muted)',marginBottom:12,lineHeight:1.7 }}>AI analysis of your session patterns, emotional signals, and behavioural tendencies.</p>
              <Btn onClick={getDebrief} disabled={debriefLoad} style={{ width:'100%',marginBottom:debrief?12:0 }}>{debriefLoad?'◌ Generating…':'✦ Generate Debrief'}</Btn>
              {debrief&&<div style={{ fontSize:12,color:'var(--ink-2)',lineHeight:1.75,fontFamily:'var(--font-display)',fontStyle:'italic',maxHeight:280,overflowY:'auto' }}>{debrief}</div>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
