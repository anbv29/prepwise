import type { Metadata } from 'next';

import { DashboardScreen } from '@/components/dashboard/dashboard-screen';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'Interview kits' };

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardScreen />
    </AppShell>
  );
}
