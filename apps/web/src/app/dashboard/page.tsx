import { Suspense } from 'react';
import AppShell from '../../components/AppShell';
import DashboardPage from '../../features/dashboard/DashboardPage';

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DashboardPage/>
      </Suspense>
    </AppShell>
  );
}
