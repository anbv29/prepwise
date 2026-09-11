import type { Metadata } from 'next';

import { GenerationStepper } from '@/components/generation/generation-stepper';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = { title: 'Building your kit' };

export default async function GenerationProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ kitId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const [{ kitId }, { job }] = await Promise.all([params, searchParams]);

  return (
    <AppShell>
      <main className="flex min-h-screen items-center px-5 py-12 sm:px-8">
        <GenerationStepper kitId={kitId} {...(job ? { jobId: job } : {})} />
      </main>
    </AppShell>
  );
}
