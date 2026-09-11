import type { Metadata } from 'next';

import { KitSectionScreen } from '@/components/kit-detail/kit-section-screen';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'Interview kit' };

export default async function KitPage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = await params;
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12 xl:px-12">
        <KitSectionScreen kitId={kitId} section="overview" />
      </main>
    </AppShell>
  );
}
