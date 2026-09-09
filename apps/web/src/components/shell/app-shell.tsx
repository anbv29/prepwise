'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { House, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ['current-user'], queryFn: api.getCurrentUser });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });

  useEffect(() => {
    if (!userQuery.isLoading && !userQuery.data) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, userQuery.data, userQuery.isLoading]);

  if (userQuery.isLoading || !userQuery.data) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="mt-14 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="app-header sticky top-0 z-40 border-b border-[var(--border)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            className="flex items-center gap-3 font-semibold tracking-[-0.01em]"
            href="/dashboard"
          >
            <BrandMark /> Prepwise
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-56 truncate text-sm text-[var(--muted)] sm:block">
              {userQuery.data.email}
            </span>
            <Link
              aria-label="Return to main site"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
              href="/"
            >
              <House size={16} />
              <span className="hidden md:inline">Main site</span>
            </Link>
            <button
              aria-label="Sign out"
              className="grid h-10 w-10 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              type="button"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
