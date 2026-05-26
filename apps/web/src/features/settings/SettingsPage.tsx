'use client';
/**
 * Nexus V30 — Settings & Admin
 * Fixed: vertical side-nav, completed white-label section, mobile tab scroll,
 * shimmer loading states, consistent label sizes, all sections polished.
 */
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  nexusUsers, nexusBilling, nexusAudit, nexusWhitelabel, nexusOrg,
} from '../../services/api.client';
import {
  Card, CardHeader, CardBody, CardTitle, Kpi, KpiGrid, Btn, Inp, FormGroup,
  SectionHeader, SkeletonPanel, EmptyState, ErrorBanner,
  planBadge, useToast, useConfirm, usePrompt,
} from '../../components/ui/nx';
import { useAuthStore } from '../../state/store';

const TABS = [
  { id: 'Account',     icon: '◈', desc: 'Profile & password'      },
  { id: 'Billing',     icon: '◉', desc: 'Plans & subscription'    },
  { id: 'Organization',icon: '⊞', desc: 'Team & members'          },
  { id: 'White-label', icon: '✦', desc: 'Branding & config'       },
  { id: 'Audit Log',   icon: '≡', desc: 'Activity history'        },
  { id: 'Security',    icon: '△', desc: 'Sessions & access'       },
] as const;

type TabId = typeof TABS[number]['id'];

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5 }}>{children}</div>
);
const Value = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <div style={{ fontSize:13,fontWeight:500,color:'var(--ink-2)',fontFamily:mono?'var(--font-mono)':'var(--font-body)' }}>{children}</div>
);
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily:'var(--font-display)',fontSize:17,fontWeight:400,color:'var(--ink)',marginBottom:14 }}>{children}</div>
);

export default function SettingsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { toast }    = useToast();
  const confirm      = useConfirm();
  const prompt       = usePrompt();
  const { setUser }  = useAuthStore();

  const [tab,       setTabId]     = useState<TabId>((searchParams?.get('tab') as TabId) ?? 'Account');
  const [me,        setMe]        = useState<any>(null);
  const [billing,   setBilling]   = useState<any>(null);
  const [plans,     setPlans]     = useState<any[]>([]);
  const [members,   setMembers]   = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [wlConfig,  setWlConfig]  = useState<any>(null);
  const [pwCur,     setPwCur]     = useState('');
  const [pwNew,     setPwNew]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState<Record<string,boolean>>({});
  const [error,     setError]     = useState('');

  const setLoad = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }));

  const setTab = (t: TabId) => {
    setTabId(t);
    router.replace(`/settings?tab=${encodeURIComponent(t)}`, { scroll: false });
  };

  useEffect(() => {
    const urlTab = searchParams?.get('tab') as TabId | null;
    if (urlTab && TABS.find(t => t.id === urlTab)) setTabId(urlTab);
    loadAccount();
  }, []);

  useEffect(() => {
    if (tab === 'Billing')      loadBilling();
    if (tab === 'Organization') loadOrg();
    if (tab === 'Audit Log')    loadAudit();
    if (tab === 'White-label')  loadWL();
  }, [tab]);

  async function loadAccount() {
    setLoad('account', true);
    try { const d = await nexusUsers.me(); const u = d?.user ?? d; setMe(u); if (u) setUser(u); }
    catch (e: any) { setError(e?.error ?? e?.message ?? 'Failed to load profile'); }
    finally { setLoad('account', false); }
  }
  async function loadBilling() {
    setLoad('billing', true);
    try {
      const [sub, pl] = await Promise.all([nexusBilling.subscription(), nexusBilling.plans()]);
      setBilling(sub?.subscription ?? sub); setPlans(pl?.plans ?? []);
    } catch {} finally { setLoad('billing', false); }
  }
  async function loadOrg() {
    setLoad('org', true);
    try { const d = await nexusOrg.members(); setMembers(d?.members ?? []); }
    catch {} finally { setLoad('org', false); }
  }
  async function loadAudit() {
    setLoad('audit', true);
    try { const d = await nexusAudit.list(); setAuditLogs((d as any)?.logs ?? []); }
    catch {} finally { setLoad('audit', false); }
  }
  async function loadWL() {
    setLoad('wl', true);
    try {
      const d = await nexusWhitelabel.getConfig();
      const cfg = d?.config ?? d ?? {};
      setWlConfig(Object.keys(cfg).length ? cfg : {
        brandName: '', primaryColor: '#C9A84C', logoUrl: '',
        supportEmail: '', customDomain: '', accentColor: '#2E7D52',
        footerText: '', faviconUrl: '', welcomeMessage: '',
      });
    } catch {} finally { setLoad('wl', false); }
  }

  async function changePassword() {
    if (!pwCur || !pwNew) { toast('Fill both password fields', 'warning'); return; }
    if (pwNew.length < 8)  { toast('Min 8 characters for new password', 'warning'); return; }
    setSaving(true);
    try { await nexusUsers.changePassword(pwCur, pwNew); toast('Password updated', 'success'); setPwCur(''); setPwNew(''); }
    catch (e: any) { toast(e?.error ?? e?.message ?? 'Failed', 'error'); }
    finally { setSaving(false); }
  }
  async function inviteMember() {
    const email = await prompt('Email address to invite:', 'trader@example.com');
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Invalid email', 'error'); return; }
    try { await nexusOrg.invite(email); toast(`Invite sent to ${email}`, 'success'); loadOrg(); }
    catch (e: any) { toast(e?.error ?? 'Failed', 'error'); }
  }
  async function removeMember(id: string, name: string) {
    if (!await confirm(`Remove ${name || 'this member'}?`)) return;
    try { await nexusOrg.removeMember(id); toast('Member removed', 'info'); loadOrg(); }
    catch (e: any) { toast(e?.error ?? 'Failed', 'error'); }
  }
  async function upgradePlan(planId: string, planName: string) {
    if (!await confirm(`Upgrade to ${planName}?`)) return;
    try { await nexusBilling.upgrade(planId); toast(`Upgraded to ${planName}!`, 'success'); loadBilling(); }
    catch (e: any) { toast(e?.error ?? 'Failed', 'error'); }
  }
  async function saveWL() {
    setSaving(true);
    try { await nexusWhitelabel.updateConfig(wlConfig); toast('White-label config saved', 'success'); }
    catch (e: any) { toast(e?.error ?? 'Failed', 'error'); }
    finally { setSaving(false); }
  }

  const TH: React.CSSProperties = { fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',padding:'9px 12px',borderBottom:'1px solid var(--border)',textAlign:'left',whiteSpace:'nowrap' };
  const TD: React.CSSProperties = { padding:'9px 12px',borderBottom:'1px solid var(--border-2)',fontSize:12 };

  const currentTab = TABS.find(t => t.id === tab)!;

  return (
    <div style={{ padding:20, animation:'fadeUp 0.22s ease' }}>
      <SectionHeader title="Settings & Admin"/>
      <ErrorBanner msg={error} onRetry={loadAccount}/>

      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:14, alignItems:'start' }}>

        {/* ── Vertical side nav ── */}
        <Card style={{ position:'sticky', top:16 }}>
          <CardBody style={{ padding:'6px 6px' }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'9px 10px', border:'none', cursor:'pointer',
                  background:active ? 'rgba(201,168,76,0.09)' : 'transparent',
                  borderRadius:'var(--radius-sm)',
                  borderLeft:`2px solid ${active ? 'var(--gold)' : 'transparent'}`,
                  marginBottom:2, transition:'all 0.12s', textAlign:'left',
                }}
                  onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(201,168,76,0.04)'; }}
                  onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent'; }}
                >
                  <span style={{ fontSize:12, color:active?'var(--gold)':'var(--muted)', width:16, textAlign:'center', flexShrink:0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:active?600:400, color:active?'var(--ink)':'var(--ink-3)' }}>{t.id}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </CardBody>
        </Card>

        {/* ── Content panels ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, minWidth:0 }}>

          {/* ── ACCOUNT ── */}
          {tab === 'Account' && <>
            <Card>
              <CardBody>
                <SectionTitle>Account Profile</SectionTitle>
                {loading.account ? <SkeletonPanel rows={5}/> : me ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    {[
                      ['Name', me.name ?? '—'],
                      ['Email', me.email ?? '—'],
                      ['Role', me.role ?? '—'],
                      ['Member since', me.createdAt ? new Date(me.createdAt).toLocaleDateString() : '—'],
                    ].map(([l,v]) => (
                      <div key={l as string}>
                        <Label>{l}</Label>
                        <Value>{v}</Value>
                      </div>
                    ))}
                    <div>
                      <Label>Plan</Label>
                      <span style={{ ...planBadge(me.plan ?? 'free'), fontSize:11, padding:'3px 10px' }}>
                        {(me.plan ?? 'free').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Label>Email verified</Label>
                      <Value>
                        <span style={{ color:me.emailVerified?'var(--green)':'var(--red)', fontWeight:600 }}>
                          {me.emailVerified ? '✓ Verified' : '✕ Not verified'}
                        </span>
                      </Value>
                    </div>
                  </div>
                ) : <EmptyState title="Profile unavailable"/>}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <SectionTitle>Change Password</SectionTitle>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <FormGroup label="Current password">
                    <Inp type="password" value={pwCur} onChange={setPwCur} placeholder="Current password"/>
                  </FormGroup>
                  <FormGroup label="New password (min 8 characters)">
                    <Inp type="password" value={pwNew} onChange={setPwNew} placeholder="New password"/>
                  </FormGroup>
                </div>
                <Btn onClick={changePassword} disabled={saving}>{saving ? '◌ Updating…' : 'Update Password'}</Btn>
              </CardBody>
            </Card>
          </>}

          {/* ── BILLING ── */}
          {tab === 'Billing' && <>
            <Card>
              <CardBody>
                <SectionTitle>Current Subscription</SectionTitle>
                {loading.billing ? <SkeletonPanel rows={3}/> : billing ? (
                  <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
                    <div>
                      <Label>Plan</Label>
                      <span style={{ ...planBadge(billing.plan ?? 'free'), fontSize:13, padding:'4px 14px' }}>
                        {(billing.plan ?? 'free').toUpperCase()}
                      </span>
                    </div>
                    {billing.status && <div><Label>Status</Label><Value><span style={{ color:'var(--green)', fontWeight:600, textTransform:'capitalize' }}>{billing.status}</span></Value></div>}
                    {billing.renewsAt && <div><Label>Renews</Label><Value>{new Date(billing.renewsAt).toLocaleDateString()}</Value></div>}
                    {billing.amount != null && <div><Label>Amount</Label><Value mono>${(billing.amount / 100).toFixed(2)}/mo</Value></div>}
                  </div>
                ) : <EmptyState title="No subscription data"/>}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <SectionTitle>Available Plans</SectionTitle>
                {loading.billing ? <SkeletonPanel rows={3}/> : !plans.length ? (
                  <EmptyState title="No plans available"/>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                    {plans.map((p: any) => (
                      <div key={p.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, transition:'border-color 0.14s, box-shadow 0.14s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='var(--gold)'; e.currentTarget.style.boxShadow='var(--shadow-md)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}>
                        <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:500, marginBottom:4, color:'var(--ink)' }}>{p.name ?? p.id}</div>
                        <div style={{ fontSize:22, fontWeight:700, color:'var(--gold)', marginBottom:12, fontFamily:'var(--font-mono)' }}>
                          {p.price ? `$${(p.price / 100)}/mo` : 'Free'}
                        </div>
                        {(p.features ?? []).map((f: string) => (
                          <div key={f} style={{ fontSize:11, color:'var(--muted)', padding:'2px 0', display:'flex', gap:5, alignItems:'flex-start' }}>
                            <span style={{ color:'var(--green)', flexShrink:0 }}>✓</span>{f}
                          </div>
                        ))}
                        <Btn onClick={() => upgradePlan(p.id, p.name ?? p.id)} style={{ width:'100%', marginTop:14, fontSize:11 }}>
                          Select {p.name ?? 'Plan'}
                        </Btn>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </>}

          {/* ── ORGANIZATION ── */}
          {tab === 'Organization' && (
            <Card>
              <CardHeader>
                <div style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:400, color:'var(--ink)' }}>Team Members</div>
                <Btn small onClick={inviteMember} style={{ marginLeft:'auto' }}>+ Invite Member</Btn>
              </CardHeader>
              {loading.org ? <SkeletonPanel rows={4}/> : !members.length ? (
                <EmptyState icon="⊞" title="No members yet" sub="Invite teammates to collaborate in your organization"/>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Name','Email','Role','Joined',''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{members.map((m: any) => (
                      <tr key={m.id} style={{ transition:'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ ...TD, fontWeight:500 }}>{m.name ?? '—'}</td>
                        <td style={{ ...TD, fontFamily:'var(--font-mono)', fontSize:11 }}>{m.email ?? '—'}</td>
                        <td style={TD}>
                          <span style={{ padding:'2px 8px', borderRadius:4, fontSize:9, fontWeight:700, textTransform:'uppercase', background:'var(--cream-3)', color:'var(--muted)' }}>{m.role ?? 'VIEWER'}</span>
                        </td>
                        <td style={{ ...TD, fontFamily:'var(--font-mono)', fontSize:10 }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}</td>
                        <td style={TD}><Btn small variant="danger" onClick={() => removeMember(m.id, m.name)}>Remove</Btn></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── WHITE-LABEL (fully built out) ── */}
          {tab === 'White-label' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Card>
                <CardBody>
                  <SectionTitle>Brand Identity</SectionTitle>
                  <p style={{ fontSize:12, color:'var(--muted)', marginBottom:16, lineHeight:1.7 }}>
                    Configure Nexus to appear under your brand. These settings control what traders see when they log in.
                    Available on Enterprise and White-label plans.
                  </p>
                  {loading.wl ? <SkeletonPanel rows={5}/> : wlConfig ? (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <FormGroup label="Brand Name">
                        <Inp value={wlConfig.brandName ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, brandName: v }))} placeholder="e.g. Binance Intelligence"/>
                      </FormGroup>
                      <FormGroup label="Support Email">
                        <Inp value={wlConfig.supportEmail ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, supportEmail: v }))} placeholder="support@yourbrand.com"/>
                      </FormGroup>
                      <FormGroup label="Custom Domain">
                        <Inp value={wlConfig.customDomain ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, customDomain: v }))} placeholder="terminal.yourbrand.com"/>
                      </FormGroup>
                      <FormGroup label="Logo URL">
                        <Inp value={wlConfig.logoUrl ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, logoUrl: v }))} placeholder="https://cdn.yourbrand.com/logo.svg"/>
                      </FormGroup>
                      <FormGroup label="Favicon URL">
                        <Inp value={wlConfig.faviconUrl ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, faviconUrl: v }))} placeholder="https://cdn.yourbrand.com/favicon.ico"/>
                      </FormGroup>
                      <FormGroup label="Welcome Message">
                        <Inp value={wlConfig.welcomeMessage ?? ''} onChange={v => setWlConfig((p: any) => ({ ...p, welcomeMessage: v }))} placeholder="Welcome to the trading terminal"/>
                      </FormGroup>
                    </div>
                  ) : <EmptyState title="White-label not enabled" sub="Contact support to enable white-label for your organization"/>}
                </CardBody>
              </Card>

              {wlConfig && (
                <Card>
                  <CardBody>
                    <SectionTitle>Brand Colors</SectionTitle>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                      {[
                        ['primaryColor',  'Primary / Accent', wlConfig.primaryColor  ?? '#C9A84C'],
                        ['accentColor',   'Secondary Color',  wlConfig.accentColor   ?? '#2E7D52'],
                        ['footerText',    'Footer Text',      wlConfig.footerText    ?? ''],
                      ].map(([key, label, val]) => (
                        <div key={key as string}>
                          <FormGroup label={label as string}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              {(key as string).includes('Color') && (
                                <input type="color" value={val as string}
                                  onChange={e => setWlConfig((p: any) => ({ ...p, [key as string]: e.target.value }))}
                                  style={{ width:34, height:34, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', cursor:'pointer', padding:2 }}/>
                              )}
                              <Inp value={val as string} onChange={v => setWlConfig((p: any) => ({ ...p, [key as string]: v }))} placeholder={label as string}/>
                            </div>
                          </FormGroup>
                        </div>
                      ))}
                    </div>

                    {/* Live preview strip */}
                    <div style={{ marginTop:16, padding:'14px 18px', background:'var(--ink)', borderRadius:'var(--radius)', display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#3A3420', letterSpacing:'0.1em', textTransform:'uppercase' }}>Preview</div>
                      <div style={{ width:28, height:28, borderRadius:7, background:wlConfig.primaryColor ?? 'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'var(--ink)', fontWeight:700, fontFamily:'var(--font-display)' }}>
                        {(wlConfig.brandName ?? 'N')[0]}
                      </div>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:500, color:wlConfig.primaryColor ?? '#C9A84C', letterSpacing:'0.08em' }}>
                        {wlConfig.brandName || 'BRAND NAME'}
                      </div>
                      <div style={{ width:1, height:20, background:'rgba(201,168,76,0.08)', flexShrink:0 }}/>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#BAB5A0' }}>Live preview</div>
                    </div>

                    <Btn onClick={saveWL} disabled={saving} style={{ marginTop:14 }}>
                      {saving ? '◌ Saving…' : '✓ Save White-label Config'}
                    </Btn>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {tab === 'Audit Log' && (
            <Card>
              <CardHeader>
                <div style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:400, color:'var(--ink)' }}>Audit Log</div>
                <Btn small variant="ghost" style={{ marginLeft:'auto' }} onClick={async () => { try { await nexusAudit.export('csv'); } catch {} }}>
                  ↓ Export CSV
                </Btn>
              </CardHeader>
              {loading.audit ? <SkeletonPanel rows={6}/> : !auditLogs.length ? (
                <EmptyState icon="≡" title="No audit logs" sub="Write operations and admin actions appear here"/>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Time','Action','Resource','Actor','IP'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{auditLogs.map((l: any, i: number) => (
                      <tr key={i} style={{ transition:'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ ...TD, fontFamily:'var(--font-mono)', fontSize:10 }}>{new Date(l.createdAt).toLocaleString()}</td>
                        <td style={{ ...TD, fontWeight:500 }}>{l.action ?? '—'}</td>
                        <td style={{ ...TD, fontSize:11 }}>{l.resource ?? '—'}</td>
                        <td style={{ ...TD, fontFamily:'var(--font-mono)', fontSize:10 }}>{l.userId?.slice(0,8) ?? '—'}</td>
                        <td style={{ ...TD, fontFamily:'var(--font-mono)', fontSize:10 }}>{l.ip ?? '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── SECURITY ── */}
          {tab === 'Security' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Card>
                <CardBody>
                  <SectionTitle>Session Management</SectionTitle>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16, lineHeight:1.7 }}>
                    JWT authentication with 7-day rotation and automatic token refresh via SameSite Strict cookies. All sessions are invalidated on password change.
                  </div>
                  <div style={{ padding:'14px 16px', background:'var(--cream-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-2)', marginBottom:2 }}>Current Session</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>Active browser session · {new Date().toLocaleDateString()}</div>
                    </div>
                    <Btn variant="danger" small onClick={() => window.dispatchEvent(new Event('nexus:unauthenticated'))}>
                      Revoke &amp; Logout
                    </Btn>
                  </div>
                  {me && (
                    <div style={{ padding:'14px 16px', background:'var(--cream-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-2)', marginBottom:2 }}>Access Level</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>Role: {me.role ?? 'trader'}</div>
                      </div>
                      <span style={{ ...planBadge(me.plan ?? 'free'), fontSize:11 }}>{(me.plan ?? 'free').toUpperCase()}</span>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <SectionTitle>API Keys</SectionTitle>
                  <p style={{ fontSize:12, color:'var(--muted)', marginBottom:14, lineHeight:1.7 }}>
                    API keys allow external tools to read data from your Nexus account. Keys are read-only by default and cannot modify trades or account settings.
                  </p>
                  <div style={{ padding:'12px 14px', background:'rgba(181,56,42,0.06)', border:'1px solid rgba(181,56,42,0.18)', borderRadius:'var(--radius-sm)', fontSize:11, color:'var(--red)', marginBottom:14 }}>
                    ⚠ Never share your API keys. Treat them like passwords. Rotate immediately if compromised.
                  </div>
                  <Btn variant="ghost">Generate API Key</Btn>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
