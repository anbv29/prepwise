import type { Metadata } from 'next';

import { NewKitForm } from '@/components/kits/new-kit-form';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'New kit' };

export default function NewKitPage() {
  return (
    <AppShell>
      <NewKitForm />
    </AppShell>
  );
}
