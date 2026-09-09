import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <div className="mb-10 space-y-3">
        <div className="skeleton h-10 w-64 rounded-md" />
        <div className="skeleton h-5 w-96 max-w-full rounded-md" />
      </div>
      <DashboardSkeleton />
    </main>
  );
}
