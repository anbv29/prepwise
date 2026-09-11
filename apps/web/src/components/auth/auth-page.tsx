import { BrandMark } from '@/components/brand-mark';
import Link from 'next/link';

import { AuthForm } from './auth-form';

export function AuthPage({ mode, returnTo }: { mode: 'login' | 'register'; returnTo?: string }) {
  const isLogin = mode === 'login';

  return (
    <main className="grid min-h-screen bg-[var(--paper)] lg:grid-cols-[minmax(0,1.06fr)_minmax(440px,0.7fr)]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface-elevated)] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Link className="flex items-center gap-3" href="/">
          <BrandMark /> <span className="font-display text-2xl font-semibold">Prepwise</span>
        </Link>
        <div className="relative z-10 max-w-2xl pb-[8vh]">
          <p className="mb-6 flex items-center gap-3 text-sm font-semibold text-[var(--success-strong)]">
            <span className="status-dot" />
            Your preparation stays structured
          </p>
          <h2 className="editorial-title text-balance text-5xl xl:text-6xl">
            Prepare from the role in front of you, not a generic question list.
          </h2>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-secondary)]">
            Turn one job description into focused questions, evidence-backed company context, and a
            plan for the days you have left.
          </p>
          <div className="mt-12 max-w-xl rotate-[-1deg] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_42px_rgb(66_42_30/0.08)]">
            <div className="flex items-center justify-between border-b border-[var(--divider)] pb-4 text-sm">
              <span className="font-semibold">Your preparation folio</span>
              <span className="text-[var(--success-strong)]">Ready when you are</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 pt-5 text-sm">
              {['Map the role', 'Research the company', 'Practice weak spots'].map((item, index) => (
                <div className="contents" key={item}>
                  <span className="grid size-7 place-items-center rounded-full border border-[var(--border-strong)] font-semibold text-[var(--accent)] tabular-nums">
                    {index + 1}
                  </span>
                  <span className="self-center font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">Built around the source material you provide.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:bg-[var(--paper)]">
        <div className="w-full max-w-md">
          <Link className="mb-14 flex items-center gap-3 lg:hidden" href="/">
            <BrandMark /> <span className="font-display text-2xl font-semibold">Prepwise</span>
          </Link>
          <h1 className="editorial-title text-4xl">
            {isLogin ? 'Sign in' : 'Create your account'}
          </h1>
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
