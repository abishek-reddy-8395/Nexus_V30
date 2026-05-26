'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nexusAuth } from '../../services/api.client';
import { useAuthStore } from '../../state/store';

export default function AuthPage() {
  const [mode, setMode]     = useState<'login'|'register'>('login');
  const [email, setEmail]   = useState('demo@nexus.app');
  const [pw, setPw]         = useState('password123');
  const [name, setName]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const inp: React.CSSProperties = {
    width:'100%', background:'rgba(255,255,253,0.05)', border:'1px solid rgba(201,168,76,0.15)',
    borderRadius:6, padding:'8px 12px', fontSize:12, color:'#EDE9DE',
    fontFamily:'var(--font-body)', outline:'none', marginBottom:0,
  };
  const lbl: React.CSSProperties = {
    display:'block', fontSize:9, fontWeight:600, letterSpacing:'0.12em',
    textTransform:'uppercase', color:'#6B6448', marginBottom:5,
  };

  async function submit() {
    setError(''); setLoading(true);
    if (!email || !pw) { setError('Please fill all fields'); setLoading(false); return; }
    if (mode === 'register' && pw.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return; }
    try {
      const d = mode==='login'
        ? await nexusAuth.login(email, pw)
        : await nexusAuth.register(email, pw, name);
      setUser(d.user);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.error ?? e?.message ?? 'Authentication failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999 }}>
      {/* bg glow */}
      <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at 30% 50%,rgba(201,168,76,0.08) 0%,transparent 60%),radial-gradient(ellipse at 70% 20%,rgba(201,168,76,0.05) 0%,transparent 50%)',pointerEvents:'none' }}/>

      <div style={{ position:'relative',background:'#201E18',border:'1px solid rgba(201,168,76,0.22)',borderRadius:14,padding:'44px 40px',width:400,boxShadow:'0 24px 80px rgba(0,0,0,0.5)' }}>

        {/* Logo */}
        <div style={{ textAlign:'center',marginBottom:32 }}>
          <div style={{ width:52,height:52,borderRadius:12,background:'linear-gradient(135deg,#C9A84C,#8A6A28)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:28,fontWeight:700,color:'#1A1710',margin:'0 auto 12px' }}>N</div>
          <div style={{ fontFamily:'var(--font-display)',fontSize:22,fontWeight:600,color:'#E8C96A',letterSpacing:'0.08em' }}>NEXUS_V30 TERMINAL</div>
          <div style={{ fontSize:9,letterSpacing:'0.25em',color:'#4A4530',textTransform:'uppercase',marginTop:4 }}>The Execution Layer</div>
        </div>

        {error && (
          <div style={{ background:'rgba(181,56,42,0.15)',border:'1px solid rgba(181,56,42,0.3)',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#E07060',marginBottom:14 }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode==='register' && (
            <div><label style={lbl}>Name</label><input style={inp} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div>
          )}
          <div><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="trader@nexus.app"/></div>
          <div><label style={lbl}>Password</label><input style={inp} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
        </div>

        <button onClick={submit} disabled={loading} style={{ width:'100%',marginTop:20,padding:'10px',background:'linear-gradient(135deg,#C9A84C,#A8892A)',border:'none',borderRadius:6,fontSize:13,fontWeight:700,color:'#1A1710',cursor:'pointer',fontFamily:'var(--font-body)',letterSpacing:'0.03em',opacity:loading?0.7:1 }}>
          {loading ? 'Please wait…' : mode==='login' ? 'Sign In →' : 'Create Account →'}
        </button>

        <div style={{ textAlign:'center',marginTop:14,fontSize:12,color:'#4A4530' }}>
          {mode==='login' ? (
            <>No account? <span onClick={()=>{setMode('register');setError('');}} style={{ color:'#C9A84C',cursor:'pointer' }}>Register here</span></>
          ) : (
            <>Have account? <span onClick={()=>{setMode('login');setError('');}} style={{ color:'#C9A84C',cursor:'pointer' }}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  );
}
