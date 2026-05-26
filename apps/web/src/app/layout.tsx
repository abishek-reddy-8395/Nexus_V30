import type { Metadata } from 'next';
import { AuthProvider } from '../providers/AuthProvider';
import { NxProviders } from '../components/ui/nx';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { WsInitializer } from '../providers/WsInitializer';

export const metadata: Metadata = {
  title: 'NEXUS_V30 TERMINAL — The Execution Layer',
  description: 'Enterprise AI trading intelligence. SMC analysis, risk management, behavioral coaching.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            /* ── Core palette ── */
            --gold:        #C9A84C;
            --gold-light:  #E8C96A;
            --gold-dim:    #8A6A28;
            --gold-pale:   #F5EDD6;
            --gold-glow:   rgba(201,168,76,0.10);
            --cream:       #FAFAF7;
            --cream-2:     #F4F2EC;
            --cream-3:     #EDE9DE;
            --ink:         #1A1710;
            --ink-2:       #2E2B22;
            --ink-3:       #45412F;
            /* ── FIXED: contrast-compliant muted (was #8A8570, failed AA) ── */
            --muted:       #6B6455;
            --muted-2:     #7A7560;
            --border:      rgba(201,168,76,0.20);
            --border-2:    rgba(201,168,76,0.09);
            --panel:       #FFFFFF;
            --green:       #2E7D52;
            --green-light: #D4EDE1;
            --red:         #B5382A;
            --red-light:   #F5DDD9;
            --blue:        #1E4E8C;
            --blue-light:  #D6E4F5;
            /* ── Layout ── */
            --sidebar-w:   228px;
            --top-h:       52px;
            --radius:      10px;
            --radius-sm:   7px;
            --radius-lg:   14px;
            --shadow:      0 1px 3px rgba(26,23,16,0.06),0 1px 2px rgba(26,23,16,0.04);
            --shadow-md:   0 4px 16px rgba(26,23,16,0.08),0 1px 4px rgba(26,23,16,0.04);
            --shadow-lg:   0 8px 40px rgba(26,23,16,0.12),0 2px 8px rgba(26,23,16,0.05);
            /* ── Typography ── */
            --font-display:'Cormorant Garamond',Georgia,serif;
            --font-body:   'Outfit',system-ui,sans-serif;
            --font-mono:   'DM Mono','Fira Code',monospace;
          }

          /* ── Reset ── */
          *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
          html { height:100%; }
          body {
            height:100%; background:var(--cream); color:var(--ink);
            font-family:var(--font-body); font-size:13px; line-height:1.55;
            -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
          }
          /* ── Scrollbar ── */
          ::-webkit-scrollbar { width:4px; height:4px; }
          ::-webkit-scrollbar-track { background:transparent; }
          ::-webkit-scrollbar-thumb { background:var(--cream-3); border-radius:4px; }
          ::-webkit-scrollbar-thumb:hover { background:var(--muted-2); }
          /* ── Global utility classes ── */
          .mono  { font-family:var(--font-mono); }
          .serif { font-family:var(--font-display); }
          /* ── Animations ── */
          @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
          @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
          @keyframes spin    { to{transform:rotate(360deg)} }
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          .animate-in   { animation:fadeUp 0.22s ease both; }
          .animate-fade  { animation:fadeIn 0.18s ease both; }
          .spinner {
            width:18px; height:18px;
            border:2px solid var(--cream-3); border-top-color:var(--gold);
            border-radius:50%; animation:spin 0.75s linear infinite; flex-shrink:0;
          }
          /* ── Shimmer skeleton ── */
          .skeleton {
            background: linear-gradient(90deg, var(--cream-2) 25%, var(--cream-3) 50%, var(--cream-2) 75%);
            background-size:200% 100%;
            animation:shimmer 1.4s ease-in-out infinite;
            border-radius:4px;
          }
          /* ── Focus ring ── */
          :focus-visible { outline:2px solid var(--gold); outline-offset:2px; }
          /* ── Responsive: sidebar collapse at <900px ── */
          @media (max-width:900px) {
            :root { --sidebar-w:0px; }
            .sidebar { transform:translateX(-100%); position:fixed !important; z-index:200; width:228px !important; transition:transform 0.25s ease; }
            .sidebar.open { transform:translateX(0); }
            .sidebar-overlay { display:block !important; }
            .hamburger { display:flex !important; }
          }
          /* ── Responsive: 2-col grids collapse at <700px ── */
          @media (max-width:700px) {
            [data-responsive-grid] { grid-template-columns: 1fr !important; }
          }
          /* ── Scrollbar on quick-prompt chip rows ── */
          .chip-row::-webkit-scrollbar { height:0; }
          .chip-row { scrollbar-width:none; }
          .sidebar-overlay {
            display:none; position:fixed; inset:0; background:rgba(26,23,16,0.5);
            z-index:199; backdrop-filter:blur(2px);
          }
          .hamburger { display:none; }
        `}</style>
      </head>
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <WsInitializer />
            <NxProviders>{children}</NxProviders>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
