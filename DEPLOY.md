# Nexus V30 — Deployment Guide

## Architecture
- **Frontend**: Vercel (Next.js 15)
- **Backend**: Railway (Node.js API)
- **Database**: Railway Postgres
- **Cache**: Railway Redis

---

## 1. Railway Backend Setup

### Step 1: Create Railway project
1. Go to railway.app → New Project
2. Add services: **Postgres**, **Redis**, and **GitHub repo (backend)**

### Step 2: Set environment variables in Railway Dashboard
```
DATABASE_URL          (auto-provided by Railway Postgres)
REDIS_URL             (auto-provided by Railway Redis)
JWT_SECRET            (generate: openssl rand -hex 32)
JWT_REFRESH_SECRET    (generate: openssl rand -hex 32)
GEMINI_API_KEY        (from ai.google.dev)
ALPHA_VANTAGE_KEY     (from alphavantage.co — free)
TWELVE_DATA_KEY       (from twelvedata.com — free)
NODE_ENV              production
PORT                  3001
DEPLOY_TARGET         railway
```

### Step 3: Set Railway start command
```
pnpm --filter=@nexus/backend start
```

---

## 2. Vercel Frontend Setup

### Step 1: Import GitHub repo to Vercel
1. vercel.com → Add New Project → Import from GitHub

### Step 2: Configure project settings
- **Framework**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && pnpm turbo build --filter=@nexus/web`
- **Install Command**: `pnpm install --frozen-lockfile`

### Step 3: Set environment variables in Vercel Dashboard
```
NEXT_PUBLIC_API_URL   https://your-backend.railway.app
```

### Step 4: Update vercel.json rewrite destination
Edit `apps/web/vercel.json` and replace `REPLACE_WITH_YOUR_RAILWAY_BACKEND_URL` with your actual Railway backend URL.

---

## 3. API Keys — Where to Get Them

| Key | Source | Free Tier |
|-----|--------|-----------|
| GEMINI_API_KEY | ai.google.dev (AI Studio) | 1500 req/day free |
| ALPHA_VANTAGE_KEY | alphavantage.co | 500 req/day free |
| TWELVE_DATA_KEY | twelvedata.com | 800 credits/day free |

**Note**: Binance and Bybit price data require NO API keys — they use public endpoints.

---

## 4. Data Sources by Asset Class

| Asset | Primary | Fallback |
|-------|---------|----------|
| Crypto (BTC, ETH...) | Binance public REST | Bybit public REST |
| Metals (XAU, XAG) | Alpha Vantage FX | Twelve Data → Binance Futures |
| Forex (EUR/USD...) | Twelve Data | Alpha Vantage |
| Oil (WTI, Brent) | Alpha Vantage | Twelve Data |
| Indices (US30...) | Alpha Vantage | Twelve Data |

---

## 5. Troubleshooting

**Build fails on Vercel**: Check Root Directory is set to `apps/web`

**Backend crashes on Railway**: Check all env vars are set BEFORE first deploy, especially DATABASE_URL and REDIS_URL

**Prices not loading**: Verify ALPHA_VANTAGE_KEY and TWELVE_DATA_KEY are set. Check Railway logs for source-specific errors.

**AI Copilot returning errors**: Verify GEMINI_API_KEY is valid. Test it at ai.google.dev/app

**Chart blank**: Clear browser cache. The LWC script loads from unpkg.com — ensure no CSP blocks it.

---

## 6. Acquisition Pitch Page

The product includes a built-in acquisition pitch page at `/pitch`.

This page is publicly accessible (no login required) and is designed to:
- Show live countdown to bid close (72-hour clock)
- Display buyer-specific value propositions (Binance, FTMO, Funding Pips)
- Show cost-to-build vs asking price anchoring
- Capture lead information from interested buyers

**To use it:**
1. Deploy to Vercel
2. Share `https://your-domain.vercel.app/pitch` with potential buyers
3. Post it on Flippa, Acquire.com, and direct outreach to Binance Labs, FTMO partnerships@

**List simultaneously on:**
- Flippa.com (SaaS marketplace)
- Acquire.com (startup acquisitions)  
- Binance Labs: labs.binance.com/en/contact
- FTMO: partnerships@ftmo.com
- Funding Pips: founders on LinkedIn

The scarcity mechanism is real: sole ownership means the first buyer locks out all competitors.
