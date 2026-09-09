import type { Metadata } from 'next';

import { NewKitForm } from '@/components/kits/new-kit-form';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'New kit' };

export default async function NewKitPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <AppShell>
      <NewKitForm initialMode={mode === 'batch' ? 'batch' : 'single'} />
    </AppShell>
  );
}
