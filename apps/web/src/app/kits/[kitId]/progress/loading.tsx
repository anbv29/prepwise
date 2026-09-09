import { StepperSkeleton } from '@/components/ui/skeleton';

export default function ProgressLoading() {
  return (
    <main className="flex min-h-screen items-center px-5 py-12 sm:px-8">
      <StepperSkeleton />
    </main>
  );
}
