import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { KitSectionScreen, type KitSection } from '@/components/kit-detail/kit-section-screen';
import { AppShell } from '@/components/shell/app-shell';

type ResultSection = Exclude<KitSection, 'overview'>;

const titles: Record<ResultSection, string> = {
  brief: 'Company brief',
  role: 'Role analysis',
  questions: 'Interview questions',
  flashcards: 'Study flashcards',
  schedule: 'Preparation schedule',
  coverage: 'Requirement coverage',
};

function isKitSection(value: string): value is ResultSection {
  return ['brief', 'role', 'questions', 'flashcards', 'schedule', 'coverage'].includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kitId: string; section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return { title: isKitSection(section) ? titles[section] : 'Interview kit' };
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
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12 xl:px-12">
        <KitSectionScreen kitId={kitId} section={section} />
      </div>
    </AppShell>
  );
}
