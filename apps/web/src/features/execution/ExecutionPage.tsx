'use client';
import { useState } from 'react';
import { nexusRisk, nexusExecution } from '../../services/api.client';
import { Card,CardHeader,CardBody,CardTitle,KpiGrid,Kpi,Btn,Sel,Inp,FormGroup,SectionHeader,GoldDivider,useToast } from '../../components/ui/nx';
import { INSTRUMENTS } from '../../constants/index';

function Step({ n,label,active,done }: { n:number; label:string; active:boolean; done:boolean }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
      <div style={{
        width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:12,fontWeight:700,flexShrink:0,transition:'all 0.2s',
        background:done?'var(--green)':active?'var(--gold)':'var(--cream-3)',
        color:done?'#fff':active?'var(--ink)':'var(--muted)',
      }}>{done?'✓':n}</div>
      <span style={{ fontSize:12,fontWeight:active||done?600:400,color:active||done?'var(--ink-2)':'var(--muted)' }}>{label}</span>
    </div>
  );
}

export default function ExecutionPage() {
  const { toast } = useToast();
  const [sym,  setSym]  = useState('XAUUSD');
  const [dir,  setDir]  = useState('BUY');
  const [bal,  setBal]  = useState('10000');
  const [risk, setRisk] = useState('1');
  const [entry,setEntry]= useState('');
  const [sl,   setSl]   = useState('');
  const [tp,   setTp]   = useState('');
  const [mode, setMode] = useState('intraday');
  const [conf, setConf] = useState('70');
  const [setup,setSetup]= useState('');
  const [sessW,setSessW]= useState('1.2');
  const [rr,   setRR]   = useState<any>(null);
  const [prev, setPrev] = useState<any>(null);
  const [execId,setExecId]=useState('');
  const [step, setStep] = useState(1);
  const [loading,setLoad]=useState(false);
  const [warns, setWarns]=useState<string[]>([]);

  async function calcRisk() {
    if(!entry||!sl){toast('Entry and stop loss are required','error');return;}
    setLoad(true);
    try {
      const d=await nexusRisk.calculate({sym,balance:parseFloat(bal),riskPct:parseFloat(risk),entry:parseFloat(entry),sl:parseFloat(sl),tp:tp?parseFloat(tp):undefined});
      const r=d?.result??d;
      setRR(r); setWarns(r.warnings??[]);
    } catch(e:any){toast(e?.error??e?.message??'Failed','error');}
    finally{setLoad(false);}
  }
  async function prepareExec() {
    if(!entry||!sl){toast('Complete risk calculator first','warning');return;}
    setLoad(true);
    try {
      const d=await nexusExecution.prepare({sym,dir,entry:parseFloat(entry),sl:parseFloat(sl),tp:tp?parseFloat(tp):undefined,lots:rr?.lots??0.01,balance:parseFloat(bal),confluence:parseInt(conf),sessionWeight:parseFloat(sessW),mode});
      setExecId(d?.executionId??d?.id??''); setPrev(d); setStep(2);
    } catch(e:any){toast(e?.error??e?.message??'Failed','error');}
    finally{setLoad(false);}
  }
  async function confirmExec() {
    setLoad(true);
    try{ await nexusExecution.confirm(execId); setStep(3); }
    catch(e:any){toast(e?.error??e?.message??'Failed','error');}
    finally{setLoad(false);}
  }
  function reset(){setPrev(null);setExecId('');setRR(null);setStep(1);setWarns([]);}

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Risk & Execution"/>

      {/* Step indicator */}
      <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:20,padding:'14px 20px',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)' }}>
        <Step n={1} label="Calculate Risk" active={step===1} done={step>1}/>
        <div style={{ flex:1,height:1,background:'var(--border)' }}/>
        <Step n={2} label="Preview Trade"  active={step===2} done={step>2}/>
        <div style={{ flex:1,height:1,background:'var(--border)' }}/>
        <Step n={3} label="Confirmed"      active={step===3} done={false}/>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
        {/* Risk Calculator */}
        <Card>
          <CardHeader><CardTitle>Position Size Calculator</CardTitle></CardHeader>
          <CardBody>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              <FormGroup label="Symbol"><Sel value={sym} onChange={setSym}>{INSTRUMENTS.map(s=><option key={s}>{s}</option>)}</Sel></FormGroup>
              <FormGroup label="Direction">
                <div style={{ display:'flex',gap:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden' }}>
                  {['BUY','SELL'].map(d=>(
                    <button key={d} onClick={()=>setDir(d)} style={{ flex:1,padding:'7px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)',background:dir===d?(d==='BUY'?'var(--green)':'var(--red)'):'var(--cream-2)',color:dir===d?'#fff':'var(--muted)',transition:'all 0.12s' }}>{d}</button>
                  ))}
                </div>
              </FormGroup>
              <FormGroup label="Balance ($)">  <Inp type="number" value={bal}   onChange={setBal}   placeholder="10000"/></FormGroup>
              <FormGroup label="Risk %">        <Inp type="number" value={risk}  onChange={setRisk}  placeholder="1"/></FormGroup>
              <FormGroup label="Entry Price *"> <Inp type="number" value={entry} onChange={setEntry} placeholder="e.g. 2350"/></FormGroup>
              <FormGroup label="Stop Loss *">   <Inp type="number" value={sl}    onChange={setSl}    placeholder="e.g. 2340"/></FormGroup>
            </div>
            <FormGroup label="Take Profit (optional)"><Inp type="number" value={tp} onChange={setTp} placeholder="e.g. 2380"/></FormGroup>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              <FormGroup label="Mode">
                <Sel value={mode} onChange={setMode}><option value="intraday">Intraday</option><option value="scalp">Scalp</option><option value="positional">Positional</option></Sel>
              </FormGroup>
              <FormGroup label="Confluence"><Inp type="number" value={conf} onChange={setConf}/></FormGroup>
            </div>
            <Btn onClick={calcRisk} disabled={loading} style={{ width:'100%' }}>{loading?'◌ Calculating…':'Calculate Risk'}</Btn>

            {warns.map((w,i)=>(
              <div key={i} style={{ marginTop:7,padding:'6px 10px',background:'var(--red-light)',border:'1px solid rgba(181,56,42,0.18)',borderRadius:'var(--radius-sm)',fontSize:11,color:'var(--red)' }}>⚠ {w}</div>
            ))}

            {rr&&<>
              <div style={{ marginTop:14 }}><GoldDivider/></div>
              <div style={{ marginTop:12 }}>
                <KpiGrid cols="1fr 1fr">
                  <Kpi label="Lot Size"     value={rr.lots?.toFixed(2)??rr.suggestedLots?.toFixed(2)??'—'} color="var(--gold)"/>
                  <Kpi label="Risk Amount"  value={`$${(rr.riskAmt??rr.riskAmount??0).toFixed(2)}`}        color="var(--red)"/>
                  <Kpi label="R:R Ratio"    value={rr.rr??'—'}                                              color="var(--green)"/>
                  <Kpi label="Pot. Profit"  value={rr.potentialProfit?`$${rr.potentialProfit.toFixed(2)}`:'—'} color="var(--green)"/>
                </KpiGrid>
                <div style={{ marginTop:12 }}>
                  <Btn onClick={prepareExec} disabled={loading} style={{ width:'100%' }}>{loading?'◌ Preparing…':'Prepare Execution →'}</Btn>
                </div>
              </div>
            </>}
          </CardBody>
        </Card>

        {/* Execution panel */}
        <Card>
          <CardHeader><CardTitle>Trade Execution</CardTitle></CardHeader>
          <CardBody>
            {step===1&&<>
              <p style={{ fontSize:12,color:'var(--muted)',marginBottom:14,lineHeight:1.7 }}>Complete the risk calculator to prepare your trade. The execution engine validates confluence, session weight, and rule compliance before confirming.</p>
              <FormGroup label="Setup Description">
                <textarea value={setup} onChange={e=>setSetup(e.target.value)} rows={4} placeholder="OB retest at 2350 with FVG confluence and London open momentum…"
                  style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:12,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',width:'100%',resize:'vertical' }}/>
              </FormGroup>
              <FormGroup label="Session Weight"><Inp type="number" value={sessW} onChange={setSessW} placeholder="1.2"/></FormGroup>
              <div style={{ padding:'12px',background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:11,color:'var(--muted)',lineHeight:1.7 }}>
                ✓ Read-only execution preview — no trade is placed automatically. You must confirm in step 2.
              </div>
            </>}

            {step===2&&prev&&<>
              <div style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:16,marginBottom:16 }}>
                <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12 }}>Execution Preview</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12 }}>
                  {[['Symbol',sym],['Direction',dir],['Entry',entry],['Stop Loss',sl],['Take Profit',tp||'—'],['Lot Size',(rr?.lots??0.01).toFixed(2)],['Mode',mode],['Confluence',conf+'%']].map(([l,v])=>(
                    <div key={l}><span style={{ color:'var(--muted)' }}>{l}: </span><strong style={{ fontFamily:'var(--font-mono)' }}>{v}</strong></div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex',gap:8 }}>
                <Btn onClick={confirmExec} disabled={loading} style={{ flex:1 }}>{loading?'◌':'✓'} Confirm</Btn>
                <Btn onClick={reset} variant="danger" style={{ flex:1 }}>✕ Cancel</Btn>
              </div>
            </>}

            {step===3&&<div style={{ textAlign:'center',padding:'48px 16px',animation:'fadeUp 0.3s ease' }}>
              <div style={{ fontSize:44,marginBottom:12,color:'var(--green)' }}>✓</div>
              <div style={{ fontSize:16,fontWeight:500,color:'var(--green)',fontFamily:'var(--font-display)',marginBottom:6 }}>Trade Logged</div>
              <div style={{ fontSize:11,color:'var(--muted)',fontFamily:'var(--font-mono)',marginBottom:24 }}>{execId}</div>
              <Btn onClick={reset} variant="ghost">New Trade</Btn>
            </div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
