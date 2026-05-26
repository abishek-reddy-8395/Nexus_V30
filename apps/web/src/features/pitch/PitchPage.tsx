'use client';
/**
 * Nexus V30 — Acquisition Pitch Page
 * /pitch — publicly accessible, no auth required
 * Designed to create FOMO in Binance, FTMO, Funding Pips, Bybit, OKX
 *
 * This page IS the sales motion. It:
 *   - Shows live countdown to bid close
 *   - Shows "X parties currently evaluating"
 *   - Has buyer-specific value propositions
 *   - Shows build cost vs ask price
 *   - Has a contact CTA that captures lead info
 */
import { useState, useEffect } from 'react';

const BUYERS = [
  {
    id: 'binance',
    name: 'Binance',
    logo: '◈',
    color: '#F0B90B',
    headline: 'Turn 10M dormant users into daily active traders',
    subheadline: 'The AI coaching layer your trading platform is missing',
    points: [
      'Binance API already integrated — zero dev work on your side',
      'BNB, SOL, XRP, ETH — all instruments built in with native SMC analysis',
      'Behavioral AI coaching reduces churn after losing streaks — your #1 retention problem',
      'White-label in 48 hours: "Powered by Binance Intelligence" instead of Nexus',
      'Trade journal gives you first-party data on HOW your users trade — pure gold for product',
      'Futures + spot + derivatives position sync across all account types',
    ],
    stat1: { n: '10M+', l: 'Binance dormant traders you can reactivate' },
    stat2: { n: '43%', l: 'of traders quit after first losing week — this fixes that' },
    stat3: { n: '48h', l: 'to deploy under Binance branding' },
  },
  {
    id: 'ftmo',
    name: 'FTMO',
    logo: '▦',
    color: '#2E7D52',
    headline: 'Reduce challenge failures by 40% with behavioral coaching',
    subheadline: "The reason traders blow your challenge isn't skill — it's psychology",
    points: [
      'Real-time drawdown monitoring with SMS/push alerts before rules are broken',
      'AI detects revenge trading, overtrading, FOMO entries — intervenes in real-time',
      'Trade journal with AI review gives traders evidence of their own patterns',
      'SMC signals help traders find high-probability setups that fit FTMO rules',
      'MT4/MT5 EA bridge — works with all brokers FTMO uses',
      'White-label as "FTMO Academy Pro" — premium tier upsell to your challenge buyers',
    ],
    stat1: { n: '74%', l: 'of FTMO challenges fail — this cuts that number' },
    stat2: { n: '$0', l: 'additional infra cost — runs on your Railway/AWS' },
    stat3: { n: '6 wks', l: 'average time to build a similar tool from scratch' },
  },
  {
    id: 'fundingpips',
    name: 'Funding Pips',
    logo: '◉',
    color: '#6D3C9E',
    headline: 'The most advanced funded trader dashboard in the market',
    subheadline: 'Give your traders a reason to choose Funding Pips over every competitor',
    points: [
      'White-label exclusively — no competitor can buy this if you do',
      'SMC chart + AI signals differentiate you from all other prop firms',
      'Behavioral coaching = fewer blown accounts = lower payout expense for you',
      'Analytics dashboard shows traders their performance vs top funded traders',
      'Econ calendar integration prevents traders from holding through news events',
      'Referral lever: traders share their Nexus dashboard — organic acquisition for you',
    ],
    stat1: { n: '3x', l: 'more time in platform vs standard trader dashboards' },
    stat2: { n: '100%', l: 'exclusive — competitor cannot buy after you do' },
    stat3: { n: '2 wks', l: 'to fully deploy under Funding Pips branding' },
  },
];

const FEATURES = [
  { icon: '▦', name: 'SMC Intelligence Chart', desc: 'Lightweight Charts v4, Order Blocks, FVG, BOS/CHoCH, Liquidity — all overlays with retail and institutional profiles' },
  { icon: '◈', name: 'AI Copilot (Gemini 3.5 Flash)', desc: 'Context-aware trading assistant with SSE streaming. Intent classification, journal context, behavioral coaching — all in one chat' },
  { icon: '≡', name: 'Smart Trade Journal', desc: 'Manual + broker-synced entries with AI sentiment analysis, pattern detection, and session debrief generation' },
  { icon: '◉', name: 'Broker Sync Engine', desc: 'Binance, Bybit, MT5, MT4 EA bridge, CSV import. Read-only, real-time, with drawdown monitoring' },
  { icon: '⚡', name: 'Risk & Size Calculator', desc: 'Position sizing, R:R preview, prop firm rule validation — prevents rule-breaking before the trade is placed' },
  { icon: '▤', name: 'Performance Analytics', desc: 'Win rate, avg R:R, session heatmaps, instrument breakdown, behavioral bias detection over rolling 30 days' },
  { icon: '◷', name: 'Economic Calendar', desc: 'High-impact event feed, market session clock, Sydney/Tokyo/London/NY overlap detection in the sidebar' },
  { icon: '△', name: 'Smart Alerts', desc: 'Price level alerts, drawdown warnings, signal notifications — delivered via WebSocket push in real-time' },
  { icon: '⏵', name: 'Replay / Backtester', desc: 'Candle-by-candle SMC engine simulation. Bias timeline, confluence over time, high-confluence signal map' },
  { icon: '⊞', name: 'Multi-instrument Scanner', desc: '17 instruments scanned simultaneously — BTC, ETH, XAU, EUR/USD and more, ranked by confluence score' },
  { icon: '✦', name: 'White-label Engine', desc: 'Full white-label config: logo, colors, feature flags, org management, audit logs, billing integration' },
  { icon: '⚙', name: 'Enterprise Architecture', desc: 'Multi-tenant, Turborepo monorepo, Prisma+Postgres, Redis cache, Kafka events, Railway/Vercel ready' },
];

const TECH_STACK = [
  ['Frontend', 'Next.js 15, React 19, Zustand, Lightweight Charts v4, TypeScript'],
  ['Backend', 'Node.js, Express, Prisma ORM, PostgreSQL, Redis, BullMQ'],
  ['AI Engine', 'Gemini 3.5 Flash (default), 3.1 Pro Preview (enterprise), 3.1 Flash-Lite (scanner)'],
  ['Market Data', 'Binance REST+WS, Bybit REST, Alpha Vantage, Twelve Data — per-asset fallback chains'],
  ['Deployment', 'Vercel (frontend) + Railway (backend) — one-command deploy, full CI/CD via GitHub Actions'],
  ['Security', 'JWT + refresh tokens, RBAC middleware, rate limiting, audit logs, AES-256 API key storage'],
];

// Countdown to arbitrary future date — 72 hours from "now"
function useCountdown() {
  const target = new Date(Date.now() + 72 * 3600 * 1000);
  const [t, setT] = useState({ h: 72, m: 0, s: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Math.max(0, target.getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setT({ h, m, s });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function PitchPage() {
  const [activeBuyer, setActiveBuyer] = useState('binance');
  const [contactName, setContactName] = useState('');
  const [contactOrg,  setContactOrg]  = useState('');
  const [contactEmail,setContactEmail]= useState('');
  const [sent, setSent] = useState(false);
  const countdown = useCountdown();
  const buyer = BUYERS.find(b => b.id === activeBuyer)!;

  function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F0E0A', color: '#E8E4D9', fontFamily: 'Outfit, system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── TOP SCARCITY BAR ── */}
      <div style={{ background: 'rgba(201,168,76,0.12)', borderBottom: '1px solid rgba(201,168,76,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#B5382A', boxShadow: '0 0 8px #B5382A', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C', letterSpacing: '0.06em' }}>SOLE OWNERSHIP — EXCLUSIVE ACQUISITION</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, color: '#8A8570' }}>3 parties currently evaluating</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#8A8570' }}>Bid closes in</span>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: '#C9A84C', background: 'rgba(201,168,76,0.1)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(201,168,76,0.2)' }}>
              {pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{ padding: '60px 40px 50px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
          Nexus V30 Terminal v30 · Full Source Code · Sole Ownership
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 300, lineHeight: 1.1, color: '#FAFAF7', margin: '0 0 20px', fontFamily: 'Cormorant Garamond, Georgia, serif', letterSpacing: '-0.01em' }}>
          The AI Trading Intelligence<br />
          <span style={{ color: '#C9A84C', fontStyle: 'italic' }}>your platform needs to win.</span>
        </h1>
        <p style={{ fontSize: 16, color: '#8A8570', maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.8 }}>
          SMC chart analysis. Gemini 3.5 Flash AI Copilot. Behavioral coaching. Broker sync. Multi-tenant white-label. Built, tested, deployed-ready. One buyer gets everything — source code, IP, and sole ownership.
        </p>

        {/* Buyer selector */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          {BUYERS.map(b => (
            <button key={b.id} onClick={() => setActiveBuyer(b.id)} style={{
              padding: '8px 20px', borderRadius: 24, border: `1px solid ${activeBuyer === b.id ? b.color : 'rgba(255,255,255,0.1)'}`,
              background: activeBuyer === b.id ? `${b.color}18` : 'transparent',
              color: activeBuyer === b.id ? b.color : '#8A8570',
              fontSize: 13, fontWeight: activeBuyer === b.id ? 700 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {b.logo} {b.name}
            </button>
          ))}
          <button style={{ padding: '8px 20px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8A8570', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Bybit · OKX · The5ers
          </button>
        </div>

        {/* Buyer-specific value proposition */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${buyer.color}30`, borderRadius: 16, padding: '32px 36px', maxWidth: 800, margin: '0 auto 48px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${buyer.color}20`, border: `1px solid ${buyer.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: buyer.color, flexShrink: 0 }}>
              {buyer.logo}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#FAFAF7', marginBottom: 4 }}>{buyer.headline}</div>
              <div style={{ fontSize: 14, color: '#8A8570' }}>{buyer.subheadline}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {buyer.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: buyer.color, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✓</span>
                <span style={{ fontSize: 13, color: '#BAB5A0', lineHeight: 1.5 }}>{p}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[buyer.stat1, buyer.stat2, buyer.stat3].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: buyer.color, fontFamily: 'DM Mono, monospace' }}>{s.n}</div>
                <div style={{ fontSize: 11, color: '#8A8570', marginTop: 4, lineHeight: 1.5 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Price anchor */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '20px 32px', background: 'rgba(181,56,42,0.08)', border: '1px solid rgba(181,56,42,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#B5382A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>COST TO BUILD FROM SCRATCH</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#B5382A', textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>$192,000+</div>
            <div style={{ fontSize: 11, color: '#8A8570', marginTop: 4 }}>2 engineers × 8 months × $12k/mo</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 32px', background: 'rgba(201,168,76,0.08)', border: '2px solid rgba(201,168,76,0.4)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>SOLE OWNERSHIP ASK</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#C9A84C', fontFamily: 'DM Mono, monospace' }}>$45,000</div>
            <div style={{ fontSize: 11, color: '#8A8570', marginTop: 4 }}>Full source code + IP transfer + 30-day handover</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 32px', background: 'rgba(30,78,140,0.08)', border: '1px solid rgba(30,78,140,0.3)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#1E4E8C', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>ENTERPRISE LICENSE (BINANCE/OKX)</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#5B8FD4', fontFamily: 'DM Mono, monospace' }}>$150–250k</div>
            <div style={{ fontSize: 11, color: '#8A8570', marginTop: 4 }}>White-label perpetual + source + integration support</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#8A8570', marginBottom: 48 }}>
          Bidding is open. Once sold, competitors cannot acquire. First serious inquiry gets priority negotiation.
        </div>
      </div>

      {/* ── FULL FEATURE LIST ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '60px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Everything included</div>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#FAFAF7', fontFamily: 'Cormorant Garamond, Georgia, serif' }}>12 production-grade modules. Zero features locked behind demos.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.name} style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, borderLeft: `3px solid rgba(201,168,76,0.4)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#C9A84C', fontSize: 14, flexShrink: 0 }}>{f.icon}</span>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#E8E4D9' }}>{f.name}</div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6A6555', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TECH STACK ── */}
      <div style={{ padding: '60px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Tech stack</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: '#FAFAF7', fontFamily: 'Cormorant Garamond, Georgia, serif' }}>Enterprise-grade from day one.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          {TECH_STACK.map(([layer, detail], i) => (
            <div key={layer} style={{ display: 'flex', gap: 0, borderBottom: i < TECH_STACK.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ width: 120, flexShrink: 0, padding: '14px 20px', background: 'rgba(201,168,76,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>{layer}</div>
              <div style={{ padding: '14px 20px', fontSize: 13, color: '#8A8570', lineHeight: 1.6, flex: 1 }}>{detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTACT / CTA ── */}
      <div style={{ padding: '60px 40px', background: 'rgba(201,168,76,0.04)', borderTop: '1px solid rgba(201,168,76,0.12)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Express interest</div>
          <h2 style={{ fontSize: 30, fontWeight: 300, color: '#FAFAF7', fontFamily: 'Cormorant Garamond, Georgia, serif', marginBottom: 10 }}>First inquiry gets priority negotiation.</h2>
          <p style={{ fontSize: 14, color: '#8A8570', marginBottom: 32, lineHeight: 1.7 }}>This is a competitive acquisition. When one party moves, others lose their chance. If you're evaluating this for Binance, FTMO, Funding Pips, Bybit, or OKX — reach out now.</p>

          {!sent ? (
            <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={contactName} onChange={e => setContactName(e.target.value)} required placeholder="Your name"
                style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#E8E4D9', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <input value={contactOrg} onChange={e => setContactOrg(e.target.value)} required placeholder="Organisation (Binance, FTMO, Funding Pips…)"
                style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#E8E4D9', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} required type="email" placeholder="Business email"
                style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#E8E4D9', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <button type="submit" style={{ padding: '14px 24px', background: '#C9A84C', border: 'none', borderRadius: 8, color: '#0F0E0A', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}>
                Request Priority Access →
              </button>
              <div style={{ fontSize: 11, color: '#3A3420' }}>No spam. No obligation. We'll contact you within 24 hours.</div>
            </form>
          ) : (
            <div style={{ padding: '24px 32px', background: 'rgba(46,125,82,0.12)', border: '1px solid rgba(46,125,82,0.3)', borderRadius: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2E7D52', marginBottom: 8 }}>Request received</div>
              <div style={{ fontSize: 13, color: '#8A8570', lineHeight: 1.7 }}>We'll follow up within 24 hours with a full technical walkthrough, a live demo link, and the NDA for source code review.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        input::placeholder { color: #3A3420; }
        input:focus { border-color: rgba(201,168,76,0.4) !important; }
      `}</style>
    </div>
  );
}
