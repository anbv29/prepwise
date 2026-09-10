import { BrandMark } from '@/components/brand-mark';
import Link from 'next/link';

import { AuthForm } from './auth-form';

export function AuthPage({ mode, returnTo }: { mode: 'login' | 'register'; returnTo?: string }) {
  const isLogin = mode === 'login';

  return (
    <main className="grid min-h-screen bg-[var(--paper)] lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
      <section className="hidden border-r border-[var(--border)] bg-[var(--surface)] p-12 lg:flex lg:flex-col lg:justify-between">
        <Link className="flex items-center gap-3 font-semibold" href="/">
          <BrandMark /> Prepwise
        </Link>
        <div className="max-w-xl pb-[12vh]">
          <p className="mb-6 flex items-center gap-3 text-sm font-semibold text-[var(--success)]">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
            Your preparation stays structured
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">
            Prepare from the role in front of you, not a generic question list.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[var(--muted)]">
            Turn one job description into focused questions, evidence-backed company context, and a
            plan for the days you have left.
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">Built around the source material you provide.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link className="mb-14 flex items-center gap-3 font-semibold lg:hidden" href="/">
            <BrandMark /> Prepwise
          </Link>
          <p className="text-sm font-semibold text-[var(--accent)]">
            {isLogin ? 'Continue your preparation' : 'Start your workspace'}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
            {isLogin ? 'Sign in' : 'Create your account'}
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            {isLogin
              ? 'Enter your account details to return to your workspace.'
              : 'Tell us a little about yourself to create your workspace.'}
          </p>
          <AuthForm mode={mode} {...(returnTo ? { returnTo } : {})} />
        </div>
      </section>
    </main>
  );
}
