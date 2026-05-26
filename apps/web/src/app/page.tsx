'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nexusAuth } from '../services/api.client';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    router.replace(nexusAuth.isLoggedIn() ? '/dashboard' : '/login');
  }, [router]);
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh' }}>
      <div style={{ color:'#6B5E52', fontSize:13 }}>Loading NEXUS…</div>
    </div>
  );
}
