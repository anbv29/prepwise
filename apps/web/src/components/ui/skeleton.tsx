export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div aria-label="Loading interview kits" className="space-y-3" role="status">
      {[0, 1, 2].map((item) => (
        <div
          className="grid min-h-24 grid-cols-[5px_1fr] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          key={item}
        >
          <Skeleton className="h-full rounded-none" />
          <div className="flex items-center gap-5 px-6 py-5">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-24 sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepperSkeleton() {
  return (
    <div
      aria-label="Loading generation progress"
      className="paper-panel mx-auto w-full max-w-2xl space-y-5 p-7 sm:p-10"
      role="status"
    >
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div className="flex min-h-16 gap-4" key={item}>
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-5 w-52 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewKitSkeleton() {
  return (
    <div
      aria-label="Loading kit form"
      className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-12"
      role="status"
    >
      <Skeleton className="h-5 w-28" />
      <div className="mt-9 border-b border-[var(--border)] pb-8">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-5 w-[34rem] max-w-full" />
      </div>
      <Skeleton className="mt-8 h-12 w-64" />
      <div className="mt-8 space-y-7">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-3 h-64 w-full rounded-xl" />
        </div>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="flex justify-end border-t border-[var(--border)] pt-7">
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function KitDetailRouteSkeleton() {
  return (
    <div
      aria-label="Loading interview kit"
      className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12"
      role="status"
    >
      <Skeleton className="h-5 w-24" />
      <div className="mt-9 border-b border-[var(--border)] pb-9">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-4 h-12 w-[34rem] max-w-full" />
        <Skeleton className="mt-5 h-4 w-72 max-w-full" />
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-24 w-full rounded-xl" />
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="h-9 w-full" key={item} />
          ))}
        </div>
        <div className="space-y-10">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function PracticeSkeleton() {
  return (
    <main
      aria-label="Loading flashcard practice"
      className="grid min-h-screen place-items-center bg-[var(--paper)] px-5 py-10"
      role="status"
    >
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-5">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="mt-10 h-2 w-full rounded-full" />
        <Skeleton className="mt-8 h-[360px] w-full rounded-2xl" />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="h-12 w-full rounded-xl" key={item} />
          ))}
        </div>
      </div>
    </main>
  );
}
