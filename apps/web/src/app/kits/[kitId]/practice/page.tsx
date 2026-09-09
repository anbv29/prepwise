import type { Metadata } from 'next';

import { PracticeScreen } from '@/components/practice/practice-screen';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'Flashcard practice' };

export default async function PracticePage({ params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = await params;
  return (
    <AppShell>
      <PracticeScreen kitId={kitId} />
    </AppShell>
  );
}
