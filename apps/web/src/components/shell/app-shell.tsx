'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { House, LayoutGrid, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { PracticeSkeleton, Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPracticeMode = /^\/kits\/[^/]+\/practice\/?$/.test(pathname);
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
    if (isPracticeMode) return <PracticeSkeleton />;
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

  if (isPracticeMode) return children;

  return (
    <div className="min-h-screen bg-[var(--paper)] md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-[var(--surface-dark)] px-5 py-7 text-[var(--on-dark)] md:flex">
        <Link className="flex items-center gap-3 px-1" href="/dashboard">
          <span className="rounded-full bg-[var(--on-dark)]"><BrandMark /></span>
          <span className="font-display text-2xl font-semibold">Prepwise</span>
        </Link>
        <nav aria-label="Workspace navigation" className="mt-12 space-y-2">
          <Link className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${pathname === '/dashboard' ? 'bg-white/10 text-white' : 'text-[#d5c7bd] hover:bg-white/6 hover:text-white'}`} href="/dashboard"><LayoutGrid size={18} /> Workspace</Link>
          <Link className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${pathname.startsWith('/kits/new') ? 'bg-white/10 text-white' : 'text-[#d5c7bd] hover:bg-white/6 hover:text-white'}`} href="/kits/new"><Plus size={18} /> New kit</Link>
          <Link className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#d5c7bd] hover:bg-white/6 hover:text-white" href="/"><House size={18} /> Main site</Link>
        </nav>
        <div className="mt-auto border-t border-white/12 pt-5">
          <div className="px-2">
            <p className="truncate text-sm font-semibold">{userQuery.data.firstName ? `${userQuery.data.firstName} ${userQuery.data.lastName ?? ''}`.trim() : userQuery.data.email}</p>
            <p className="mt-1 text-xs capitalize text-[#ae9d92]">{userQuery.data.plan} plan</p>
          </div>
          <button aria-label="Sign out" className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#d5c7bd] hover:bg-white/6 hover:text-white" disabled={logout.isPending} onClick={() => logout.mutate()} type="button"><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="app-header sticky top-0 z-40 border-b border-[var(--divider)] md:hidden">
          <div className="flex min-h-16 items-center justify-between px-5">
            <Link className="flex items-center gap-3" href="/dashboard"><BrandMark /><span className="font-display text-xl font-semibold">Prepwise</span></Link>
            <div className="flex items-center gap-1">
              <Link aria-label="Create new kit" className="grid size-11 place-items-center rounded-lg text-[var(--accent)] hover:bg-[var(--accent-soft)]" href="/kits/new"><Plus size={20} /></Link>
              <Link aria-label="Return to main site" className="grid size-11 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-subtle)]" href="/"><House size={18} /></Link>
              <button aria-label="Sign out" className="grid size-11 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-subtle)]" disabled={logout.isPending} onClick={() => logout.mutate()} type="button"><LogOut size={18} /></button>
            </div>
          </div>
        </header>
        <div className="page-enter">{children}</div>
      </div>
    </div>
  );
}
