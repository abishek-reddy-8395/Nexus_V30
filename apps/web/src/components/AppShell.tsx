'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../state/store';
import { useWsStore } from '../state/ws-store';
import { nexusAuth } from '../services/api.client';

const NAV = [
  { group: 'Intelligence', items: [
    { label: 'Command Center', icon: '◈', path: '/dashboard' },
    { label: 'SMC Chart',      icon: '▦', path: '/chart' },
    { label: 'Scanner',        icon: '⊞', path: '/scanner', badge: 'signals' },
    { label: 'Live Signals',   icon: '◎', path: '/signals' },
  ]},
  { group: 'Execution', items: [
    { label: 'Risk & Size',    icon: '⚡', path: '/execution' },
    { label: 'Trade Journal',  icon: '≡',  path: '/journal' },
    { label: 'Portfolio',      icon: '◉',  path: '/portfolio' },
    { label: 'Brokers',        icon: '⟳',  path: '/brokers' },
  ]},
  { group: 'Research', items: [
    { label: 'Analytics',      icon: '▤',  path: '/analytics' },
    { label: 'Econ Calendar',  icon: '◷',  path: '/calendar' },
    { label: 'Alerts',         icon: '△',  path: '/alerts', badge: 'alerts' },
  ]},
  { group: 'Tools', items: [
    { label: 'AI Copilot',     icon: '✦',  path: '/copilot' },
    { label: 'Replay',         icon: '⏵',  path: '/replay' },
    { label: 'Settings',       icon: '⚙',  path: '/settings' },
  ]},
];

function getSession(h: number): { name: string; color: string } {
  if (h >= 13 && h < 17) return { name: 'LONDON / NY', color: '#C9A84C' };
  if (h >= 8  && h < 17) return { name: 'LONDON',      color: '#C9A84C' };
  if (h >= 13 && h < 22) return { name: 'NEW YORK',    color: '#B5382A' };
  if (h >= 0  && h < 9)  return { name: 'TOKYO',       color: '#1E4E8C' };
  if (h >= 22 || h < 7)  return { name: 'SYDNEY',      color: '#4A6741' };
  return { name: 'OFF-SESSION', color: '#6B6455' };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, clearAuth }                         = useAuthStore();
  const { connected, priceMap, lastSignal, lastAlert } = useWsStore();
  const [clock,    setClock]    = useState('--:--:--');
  const [session,  setSession]  = useState({ name: '', color: 'var(--muted)' });
  const [sigCount, setSigCount] = useState(0);
  const [alCount,  setAlCount]  = useState(0);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const h = n.getUTCHours(), m = n.getUTCMinutes(), s = n.getUTCSeconds();
      const pad = (x: number) => String(x).padStart(2,'0');
      setClock(`${pad(h)}:${pad(m)}:${pad(s)}`);
      setSession(getSession(h));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (lastSignal) setSigCount(c => c + 1); }, [lastSignal]);
  useEffect(() => { if (lastAlert)  setAlCount(c => c + 1);  }, [lastAlert]);

  const logout = useCallback(() => {
    nexusAuth.logout(); clearAuth(); router.push('/login');
  }, [clearAuth, router]);

  const initials = (user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2) ?? user?.email?.[0] ?? 'T').toUpperCase();
  const tickerSyms = ['XAUUSD','BTCUSD','EURUSD'] as const;

  const pageName = NAV.flatMap(g => g.items).find(i => pathname?.startsWith(i.path))?.label ?? 'Nexus';

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'var(--font-body)' }}>

      {/* ── Mobile overlay ── */}
      <div className="sidebar-overlay" onClick={() => setSideOpen(false)} />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sideOpen ? ' open' : ''}`} style={{
        width:'var(--sidebar-w)', minWidth:228, background:'var(--ink)',
        borderRight:'1px solid rgba(201,168,76,0.10)',
        display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0,
        boxShadow:'2px 0 20px rgba(0,0,0,0.15)',
      }}>

        {/* Logo */}
        <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid rgba(201,168,76,0.08)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{
              width:34, height:34, borderRadius:8,
              background:'linear-gradient(135deg,#C9A84C 0%,#8A6A28 100%)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:19, fontWeight:700, color:'#1A1710', flexShrink:0,
              fontFamily:'var(--font-display)', letterSpacing:'-0.02em',
            }}>N</div>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:500, color:'#E8C96A', letterSpacing:'0.08em' }}>NEXUS</div>
              <div style={{ fontSize:8, fontWeight:400, color:'#3A3420', letterSpacing:'0.26em', textTransform:'uppercase' }}>SMC Terminal</div>
            </div>
          </div>
        </div>

        {/* Session + Clock */}
        <div style={{ padding:'8px 12px 6px', borderBottom:'1px solid rgba(201,168,76,0.07)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:connected?'#2E7D52':'#B5382A', boxShadow:connected?'0 0 6px #2E7D52':'none', animation:connected?'pulse 2s infinite':'none', flexShrink:0, display:'inline-block' }}/>
              <span style={{ fontSize:9, fontWeight:600, color:session.color, letterSpacing:'0.12em' }}>{session.name || '…'}</span>
            </div>
            <span style={{ fontSize:8, color:'#3A3420', letterSpacing:'0.06em' }}>{connected?'LIVE':'OFFLINE'}</span>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:14, color:'#C9A84C', fontWeight:500, letterSpacing:'0.04em' }}>{clock} <span style={{ fontSize:9, color:'#3A3420' }}>UTC</span></div>
        </div>

        {/* Price ticker */}
        <div style={{ padding:'5px 12px 7px', borderBottom:'1px solid rgba(201,168,76,0.07)', flexShrink:0 }}>
          {tickerSyms.map(sym => {
            const p = priceMap[sym];
            const chg = p?.changePct ?? 0;
            return (
              <div key={sym} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 0' }}>
                <span style={{ fontSize:9, fontWeight:600, color:'#4A4530', letterSpacing:'0.06em' }}>{sym}</span>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:p?'#BAB5A0':'#2A2718' }}>
                    {p ? p.price.toFixed(sym.includes('BTC')?0:5) : '—'}
                  </span>
                  {p && <span style={{ fontSize:9, color:chg>=0?'#2E7D52':'#B5382A', fontFamily:'var(--font-mono)' }}>
                    {chg>=0?'+':''}{chg.toFixed(2)}%
                  </span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
          {NAV.map(grp => (
            <div key={grp.group}>
              <div style={{ padding:'8px 14px 2px', fontSize:8, fontWeight:600, color:'#2A2718', letterSpacing:'0.22em', textTransform:'uppercase' }}>
                {grp.group}
              </div>
              {grp.items.map((item: any) => {
                const active = pathname?.startsWith(item.path) ?? false;
                const badge  = item.badge==='signals'?sigCount:item.badge==='alerts'?alCount:0;
                return (
                  <button key={item.path} onClick={() => { router.push(item.path); setSideOpen(false); }} style={{
                    display:'flex', alignItems:'center', gap:9,
                    width:'100%', padding:'7px 14px 7px 12px',
                    border:'none', cursor:'pointer',
                    background:active?'rgba(201,168,76,0.10)':'transparent',
                    borderLeft:`2px solid ${active?'#C9A84C':'transparent'}`,
                    transition:'all 0.12s',
                  }}
                    onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(201,168,76,0.05)'; }}
                    onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent'; }}
                  >
                    <span style={{ fontSize:12, color:active?'#C9A84C':'#3A3420', flexShrink:0, width:15, textAlign:'center' }}>{item.icon}</span>
                    <span style={{ fontSize:11, fontWeight:active?600:400, color:active?'#E8C96A':'#4A4530', flex:1, textAlign:'left' }}>{item.label}</span>
                    {badge > 0 && (
                      <span style={{ background:'#B5382A', color:'#fff', fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:8, minWidth:16, textAlign:'center' }}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(201,168,76,0.08)', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(201,168,76,0.14)', border:'1px solid rgba(201,168,76,0.24)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#C9A84C', flexShrink:0 }}>{initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#C0A84C', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name ?? user?.email ?? 'Trader'}</div>
            <div style={{ fontSize:8, color:'#3A3420', textTransform:'uppercase', letterSpacing:'0.1em' }}>{user?.plan ?? 'PRO'}</div>
          </div>
          <button onClick={logout} style={{ background:'none', border:'none', cursor:'pointer', color:'#3A3420', fontSize:14, padding:2, lineHeight:1, borderRadius:4, transition:'color 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.color='#B5382A'}
            onMouseLeave={e => e.currentTarget.style.color='#3A3420'}
            title="Logout">⏻</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--cream)', minWidth:0 }}>

        {/* Top bar */}
        <header style={{
          height:'var(--top-h)', flexShrink:0,
          background:'var(--panel)', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', padding:'0 16px', gap:10,
          boxShadow:'0 1px 0 rgba(201,168,76,0.08)',
        }}>
          {/* Hamburger (mobile only) */}
          <button className="hamburger" onClick={() => setSideOpen(s => !s)} style={{
            background:'none', border:'none', cursor:'pointer', color:'var(--ink)',
            fontSize:18, padding:4, lineHeight:1, flexShrink:0,
          }} aria-label="Open menu">☰</button>

          {/* Page title */}
          <span style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:500, color:'var(--ink)', letterSpacing:'0.02em' }}>
            {pageName}
          </span>

          <div style={{ flex:1 }}/>

          {/* Signal toast */}
          {lastSignal && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'var(--green-light)', border:'1px solid rgba(46,125,82,0.22)', borderRadius:6, animation:'fadeIn 0.2s ease' }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#2E7D52', flexShrink:0 }}/>
              <span style={{ fontSize:10, fontWeight:600, color:'#2E7D52' }}>{lastSignal.sym} {lastSignal.bias}</span>
            </div>
          )}

          {/* WS dot */}
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px', background:'var(--cream-2)', border:'1px solid var(--border)', borderRadius:5 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:connected?'#2E7D52':'#B5382A', flexShrink:0 }}/>
            <span style={{ fontSize:9, fontWeight:600, color:connected?'#2E7D52':'#B5382A', letterSpacing:'0.1em' }}>
              {connected?'LIVE':'OFFLINE'}
            </span>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex:1, overflow:'auto' }} className="animate-fade">
          {children}
        </main>
      </div>
    </div>
  );
}
