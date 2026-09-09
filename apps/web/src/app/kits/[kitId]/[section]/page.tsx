import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  KitSectionScreen,
  kitSections,
  type KitSection,
} from '@/components/kit-detail/kit-section-screen';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'Interview kit' };

function isKitSection(value: string): value is KitSection {
  return value !== 'overview' && kitSections.some((section) => section.id === value);
}

export default async function KitSectionPage({
  params,
}: {
  params: Promise<{ kitId: string; section: string }>;
}) {
  const { kitId, section } = await params;
  if (!isKitSection(section)) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <KitSectionScreen kitId={kitId} section={section} />
      </div>
    </AppShell>
  );
}
