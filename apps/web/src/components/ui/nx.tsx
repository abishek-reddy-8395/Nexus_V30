'use client';
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';

// ── Design tokens (JS access) ─────────────────────────────────────────────
export const T = {
  gold: '#C9A84C', green: '#2E7D52', red: '#B5382A', blue: '#1E4E8C',
  muted: '#6B6455', ink: '#1A1710', cream: '#FAFAF7',
};

// ── Toast ────────────────────────────────────────────────────────────────
export type ToastType = 'success'|'error'|'info'|'warning';
interface ToastItem { id:number; msg:string; type:ToastType; }
const ToastCtx = createContext<{ toast:(m:string,t?:ToastType,d?:number)=>void }>({ toast:()=>{} });

export function ToastProvider({ children }: { children:React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const n = useRef(0);
  const toast = useCallback((msg:string, type:ToastType='info', dur=3500) => {
    const id = ++n.current;
    setItems(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setItems(p=>p.filter(t=>t.id!==id)),dur);
  },[]);
  const borderCol:Record<ToastType,string> = { success:'rgba(46,125,82,0.55)', error:'rgba(181,56,42,0.55)', warning:'rgba(201,168,76,0.55)', info:'rgba(201,168,76,0.3)' };
  const icons:Record<ToastType,string> = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  return (
    <ToastCtx.Provider value={{toast}}>
      {children}
      <div style={{ position:'fixed',bottom:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none' }}>
        {items.map(t=>(
          <div key={t.id} style={{ background:'var(--ink)',border:`1px solid ${borderCol[t.type]}`,borderRadius:'var(--radius-sm)',padding:'10px 16px',color:'#BAB5A0',fontSize:12,boxShadow:'var(--shadow-lg)',display:'flex',alignItems:'flex-start',gap:8,maxWidth:320,animation:'fadeUp 0.2s ease',pointerEvents:'auto' }}>
            <span style={{ color:borderCol[t.type],fontWeight:700,flexShrink:0 }}>{icons[t.type]}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = ()=>useContext(ToastCtx);

// ── Confirm ───────────────────────────────────────────────────────────────
const ConfirmCtx = createContext<{confirm:(m:string)=>Promise<boolean>}>({confirm:()=>Promise.resolve(false)});
export function ConfirmProvider({ children }:{ children:React.ReactNode }) {
  const [s,setS] = useState<{msg:string;resolve:(v:boolean)=>void}|null>(null);
  const confirm = useCallback((msg:string)=>new Promise<boolean>(r=>setS({msg,resolve:r})),[]);
  const handle = (v:boolean)=>{ s?.resolve(v); setS(null); };
  return (
    <ConfirmCtx.Provider value={{confirm}}>
      {children}
      {s&&<div style={{ position:'fixed',inset:0,background:'rgba(26,23,16,0.65)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)' }}>
        <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:24,maxWidth:380,width:'90%',boxShadow:'var(--shadow-lg)',animation:'fadeUp 0.2s ease' }}>
          <div style={{ fontSize:13,color:'var(--ink-2)',lineHeight:1.65,marginBottom:20 }}>{s.msg}</div>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={()=>handle(false)}>Cancel</Btn>
            <Btn onClick={()=>handle(true)}>Confirm</Btn>
          </div>
        </div>
      </div>}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = ()=>useContext(ConfirmCtx).confirm;

// ── Prompt ────────────────────────────────────────────────────────────────
const PromptCtx = createContext<{prompt:(m:string,ph?:string)=>Promise<string|null>}>({prompt:()=>Promise.resolve(null)});
export function PromptProvider({ children }:{ children:React.ReactNode }) {
  const [s,setS] = useState<{msg:string;ph?:string;resolve:(v:string|null)=>void}|null>(null);
  const [val,setVal] = useState('');
  const prompt = useCallback((msg:string,ph?:string)=>new Promise<string|null>(r=>{ setVal(''); setS({msg,ph,resolve:r}); }),[]);
  const handle = (v:string|null)=>{ s?.resolve(v); setS(null); };
  return (
    <PromptCtx.Provider value={{prompt}}>
      {children}
      {s&&<div style={{ position:'fixed',inset:0,background:'rgba(26,23,16,0.65)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)' }}>
        <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:24,maxWidth:380,width:'90%',boxShadow:'var(--shadow-lg)',animation:'fadeUp 0.2s ease' }}>
          <div style={{ fontSize:13,color:'var(--ink-2)',marginBottom:12 }}>{s.msg}</div>
          <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle(val||null)} placeholder={s.ph}
            style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:12,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',width:'100%',marginBottom:16 }}/>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={()=>handle(null)}>Cancel</Btn>
            <Btn onClick={()=>handle(val||null)}>OK</Btn>
          </div>
        </div>
      </div>}
    </PromptCtx.Provider>
  );
}
export const usePrompt = ()=>useContext(PromptCtx).prompt;

export function NxProviders({ children }:{ children:React.ReactNode }) {
  return <ToastProvider><ConfirmProvider><PromptProvider>{children}</PromptProvider></ConfirmProvider></ToastProvider>;
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────
export function Skeleton({ w='100%', h=14, style }: { w?:string|number; h?:number; style?:React.CSSProperties }) {
  return <div className="skeleton" style={{ width:w, height:h, ...style }}/>;
}
export function SkeletonPanel({ rows=4 }: { rows?:number }) {
  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Skeleton w="45%" h={11} />
          <Skeleton w="30%" h={11} />
        </div>
      ))}
    </div>
  );
}
export function SkeletonTable({ rows=5 }: { rows?:number }) {
  return (
    <div style={{ padding:'0 0 8px' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
        <Skeleton w="100%" h={10} />
      </div>
      {Array.from({length:rows}).map((_,i)=>(
        <div key={i} style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-2)', display:'flex', gap:12 }}>
          <Skeleton w="15%" h={11}/><Skeleton w="10%" h={11}/><Skeleton w="20%" h={11}/><Skeleton w="12%" h={11}/>
        </div>
      ))}
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────
export function Card({ children,style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',...style }}>{children}</div>;
}
export function CardHeader({ children,style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ padding:'10px 16px 9px',borderBottom:'1px solid var(--border-2)',display:'flex',alignItems:'center',gap:8,...style }}>{children}</div>;
}
export function CardBody({ children,style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ padding:'14px 16px',...style }}>{children}</div>;
}
export function CardTitle({ children }: { children:React.ReactNode }) {
  return <span style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)' }}>{children}</span>;
}

// ── KPI ───────────────────────────────────────────────────────────────────
export function KpiGrid({ children,cols='repeat(auto-fit,minmax(130px,1fr))' }: { children:React.ReactNode; cols?:string }) {
  return <div style={{ display:'grid',gridTemplateColumns:cols,gap:10 }}>{children}</div>;
}
export function Kpi({ label,value,sub,color }: { label:string; value:React.ReactNode; sub?:string; color?:string }) {
  return (
    <div style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'11px 13px' }}>
      <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)',fontSize:17,fontWeight:500,color:color??'var(--ink)',lineHeight:1 }}>{value}</div>
      {sub&&<div style={{ fontSize:10,color:'var(--muted)',marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ── Hero KPI (large display number) ─────────────────────────────────────
export function HeroKpi({ label,value,sub,color,serif }: { label:string; value:React.ReactNode; sub?:string; color?:string; serif?:boolean }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--muted)',marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:serif?'var(--font-display)':'var(--font-mono)',fontSize:52,fontWeight:serif?500:700,color:color??'var(--ink)',lineHeight:1,letterSpacing:'-0.02em' }}>{value}</div>
      {sub&&<div style={{ fontSize:11,color:'var(--muted)',marginTop:5 }}>{sub}</div>}
    </div>
  );
}

// ── Bias badge ────────────────────────────────────────────────────────────
export function BiasBadge({ bias,large }: { bias:string; large?:boolean }) {
  const map:Record<string,React.CSSProperties> = {
    BULL:    { background:'var(--green-light)', color:'var(--green)' },
    BEAR:    { background:'var(--red-light)',   color:'var(--red)'   },
    NEUTRAL: { background:'var(--cream-3)',     color:'var(--muted)' },
    WAIT:    { background:'#FFF3CD',            color:'#7A5500'      },
  };
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:large?'5px 14px':'3px 10px',borderRadius:20,fontSize:large?12:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',...(map[bias]??map.WAIT) }}>
      {bias}
    </span>
  );
}

// ── Profile toggle (shared, no more inline re-implementations) ────────────
export function ProfileToggle({ value,onChange }: { value:'retail'|'institutional'; onChange:(v:'retail'|'institutional')=>void }) {
  return (
    <div style={{ display:'flex',gap:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden',flexShrink:0 }}>
      {(['retail','institutional'] as const).map(p=>(
        <button key={p} onClick={()=>onChange(p)} style={{
          padding:'5px 12px',border:'none',cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'var(--font-body)',
          background:value===p?(p==='institutional'?'var(--blue)':'var(--gold)'):'var(--cream-2)',
          color:value===p?(p==='institutional'?'#fff':'var(--ink)'):'var(--muted)',
          transition:'all 0.12s',
        }}>{p==='retail'?'◈ Retail':'◉ Institutional'}</button>
      ))}
    </div>
  );
}

// ── Confluence bar ────────────────────────────────────────────────────────
export function ConfBar({ label,score,max }: { label:string; score:number; max:number }) {
  const pct = Math.min(((score??0)/max)*100,100);
  const col = pct>=70?'var(--green)':pct>=40?'var(--gold)':'var(--red)';
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3 }}>
        <span style={{ color:'var(--ink-3)' }}>{label}</span>
        <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:col,fontWeight:500 }}>{score??0}/{max}</span>
      </div>
      <div style={{ height:3,background:'var(--cream-3)',borderRadius:2,overflow:'hidden' }}>
        <div style={{ width:`${pct}%`,height:'100%',background:col,borderRadius:2,transition:'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </div>
    </div>
  );
}

// ── Spinner / Loading / Empty ─────────────────────────────────────────────
export function Spinner({ size=18 }: { size?:number }) {
  return <div style={{ width:size,height:size,border:'2px solid var(--cream-3)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.75s linear infinite',flexShrink:0 }}/>;
}
export function LoadingState({ text='Loading…' }: { text?:string }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,gap:12,color:'var(--muted)' }}>
      <Spinner/><span style={{ fontSize:12 }}>{text}</span>
    </div>
  );
}
export function EmptyState({ icon='◈',title,sub }: { icon?:string; title:string; sub?:string }) {
  return (
    <div style={{ textAlign:'center',padding:'52px 24px',color:'var(--muted)' }}>
      <div style={{ fontSize:34,marginBottom:12,opacity:0.5 }}>{icon}</div>
      <div style={{ fontSize:14,fontWeight:500,color:'var(--ink-2)',marginBottom:4 }}>{title}</div>
      {sub&&<div style={{ fontSize:12,color:'var(--muted)',lineHeight:1.6 }}>{sub}</div>}
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────
export function ErrorBanner({ msg,onRetry }: { msg:string; onRetry?:()=>void }) {
  if(!msg) return null;
  return (
    <div style={{ padding:'10px 14px',background:'var(--red-light)',border:'1px solid rgba(181,56,42,0.22)',borderRadius:'var(--radius-sm)',color:'var(--red)',fontSize:12,display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
      <span style={{ flex:1 }}>⚠ {msg}</span>
      {onRetry&&<Btn small variant="danger" onClick={onRetry}>Retry</Btn>}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────
type BtnVariant = 'primary'|'ghost'|'danger'|'success';
export function Btn({ children,onClick,variant='primary',small,style,disabled }:
  { children:React.ReactNode; onClick?:()=>void; variant?:BtnVariant; small?:boolean; style?:React.CSSProperties; disabled?:boolean }) {
  const base:React.CSSProperties = {
    padding:small?'4px 10px':'7px 16px',border:'none',borderRadius:'var(--radius-sm)',
    fontSize:small?11:12,fontWeight:600,cursor:disabled?'not-allowed':'pointer',
    fontFamily:'var(--font-body)',transition:'all 0.14s',letterSpacing:'0.03em',
    display:'inline-flex',alignItems:'center',gap:5,opacity:disabled?0.5:1,
  };
  const vs:Record<BtnVariant,React.CSSProperties> = {
    primary:{ background:'var(--gold)',       color:'var(--ink)',     boxShadow:'0 1px 4px rgba(201,168,76,0.3)' },
    ghost:  { background:'transparent',       color:'var(--muted)',   border:'1px solid var(--border)' },
    danger: { background:'var(--red-light)',  color:'var(--red)',     border:'1px solid rgba(181,56,42,0.18)' },
    success:{ background:'var(--green-light)',color:'var(--green)',   border:'1px solid rgba(46,125,82,0.22)' },
  };
  return <button onClick={onClick} disabled={disabled} style={{...base,...vs[variant],...style}}>{children}</button>;
}

// ── Input / Select / FormGroup ────────────────────────────────────────────
export function Inp({ value,onChange,placeholder,type='text',style,autoFocus,onKeyDown }:
  { value?:string|number; onChange?:(v:string)=>void; placeholder?:string; type?:string; style?:React.CSSProperties; autoFocus?:boolean; onKeyDown?:(e:React.KeyboardEvent)=>void }) {
  return (
    <input type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
      onChange={e=>onChange?.(e.target.value)} onKeyDown={onKeyDown}
      style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'7px 10px',fontSize:12,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',width:'100%',...style }}/>
  );
}
export function Sel({ value,onChange,children,style }:
  { value?:string|number; onChange?:(v:string)=>void; children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <select value={value} onChange={e=>onChange?.(e.target.value)}
      style={{ background:'var(--cream-2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'7px 10px',fontSize:12,color:'var(--ink)',fontFamily:'var(--font-body)',outline:'none',width:'100%',cursor:'pointer',...style }}>
      {children}
    </select>
  );
}
export function FormGroup({ label,children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
export function SectionHeader({ title,right }: { title:string; right?:React.ReactNode }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
      <div style={{ fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--ink)',letterSpacing:'0.01em' }}>{title}</div>
      <div style={{ flex:1,height:1,background:'linear-gradient(to right,var(--border),transparent)' }}/>
      {right}
    </div>
  );
}

// ── Gold divider ──────────────────────────────────────────────────────────
export function GoldDivider() {
  return <div style={{ height:1,background:'linear-gradient(to right,transparent,var(--gold),transparent)',opacity:0.22,margin:'6px 0' }}/>;
}

// ── Badge helpers ─────────────────────────────────────────────────────────
export function planBadge(plan:string): React.CSSProperties {
  const m:Record<string,React.CSSProperties> = {
    free:       { background:'var(--cream-3)',    color:'var(--muted)' },
    starter:    { background:'var(--blue-light)', color:'var(--blue)'  },
    growth:     { background:'var(--green-light)',color:'var(--green)' },
    enterprise: { background:'var(--gold-pale)',  color:'var(--gold-dim)' },
    pro:        { background:'var(--green-light)',color:'var(--green)' },
  };
  return { display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',...(m[plan]??m.free) };
}

// ── LWC loader ────────────────────────────────────────────────────────────
let _lwcPromise: Promise<void>|null = null;
export function useLightweightCharts(onReady:()=>void) {
  useEffect(()=>{
    if(!_lwcPromise) {
      _lwcPromise = new Promise<void>(res=>{
        if(typeof window==='undefined'||(window as any).LightweightCharts){res();return;}
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js';
        s.onload = ()=>res(); s.onerror = ()=>{ _lwcPromise=null; res(); };
        document.head.appendChild(s);
      });
    }
    _lwcPromise.then(onReady);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
}

// ── Timeframe pill row (shared) ───────────────────────────────────────────
import { TIMEFRAMES } from '../../constants/index';
export function TfPills({ value,onChange }: { value:number; onChange:(v:number)=>void }) {
  return (
    <div style={{ display:'flex',gap:2,background:'var(--cream-2)',borderRadius:6,padding:3,border:'1px solid var(--border)',flexShrink:0 }}>
      {TIMEFRAMES.map(t=>(
        <button key={t.value} onClick={()=>onChange(Number(t.value))} style={{
          padding:'3px 9px',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer',border:'none',
          background:value===t.value?'white':'transparent',
          color:value===t.value?'var(--ink)':'var(--muted)',
          boxShadow:value===t.value?'0 1px 3px rgba(26,23,16,0.1)':'none',
          fontFamily:'var(--font-body)',transition:'all 0.12s',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ── Mode pill row (shared) ────────────────────────────────────────────────
export function ModePills({ value,onChange }: { value:string; onChange:(v:string)=>void }) {
  return (
    <div style={{ display:'flex',gap:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden',flexShrink:0 }}>
      {(['scalp','intraday','positional'] as const).map(m=>(
        <button key={m} onClick={()=>onChange(m)} style={{
          padding:'5px 11px',border:'none',cursor:'pointer',fontSize:10,fontWeight:600,
          fontFamily:'var(--font-body)',textTransform:'capitalize',
          background:value===m?'var(--ink)':'var(--cream-2)',
          color:value===m?'var(--gold)':'var(--muted)',
          transition:'all 0.12s',
        }}>{m}</button>
      ))}
    </div>
  );
}
