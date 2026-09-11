'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  Layers3,
  Menu,
  MessageSquareText,
  SearchCheck,
  Target,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { api } from '@/lib/api';

const navigation = [
  ['About', '#about'],
  ['Services', '#services'],
  ['How it works', '#how-it-works'],
  ['Pricing', '#pricing'],
  ['Reviews', '#reviews'],
  ['Contact', '#contact'],
] as const;

const services: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: SearchCheck,
    title: 'Company research',
    text: 'A grounded company brief built from accessible public sources, with links beside the findings.',
  },
  {
    icon: Target,
    title: 'Requirement mapping',
    text: 'Technical, behavioural, and domain expectations are separated, prioritised, and tracked.',
  },
  {
    icon: MessageSquareText,
    title: 'Interview questions',
    text: 'Role-specific technical, system-design, behavioural, and company-fit questions with answer outlines.',
  },
  {
    icon: BookOpenCheck,
    title: 'Active-recall cards',
    text: 'Focused prompts help you revisit concepts, decisions, tradeoffs, and examples without rereading everything.',
  },
  {
    icon: ClipboardCheck,
    title: 'Coverage checks',
    text: 'Every must-have requirement is checked against the question bank so important gaps stay visible.',
  },
  {
    icon: Layers3,
    title: 'Daily preparation plan',
    text: 'Harder, higher-priority material is scheduled first and reviewed across the time you have.',
  },
];

interface Plan {
  name: string;
  price: string;
  suffix?: string;
  description: string;
  features: string[];
  cta: string;
  available?: boolean;
  featured?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    description: 'Complete AI preparation without public discussion search.',
    features: [
      'AI role and company-site analysis',
      'Questions, flashcards, and schedule',
      'Editing, practice, and progress',
    ],
    cta: 'Start free',
    available: true,
  },
  {
    name: 'Focus',
    price: '₹499',
    suffix: '/month',
    description: 'For an active job search with multiple interviews.',
    features: [
      '10 kits each month',
      'Grounded public interview research',
      'Batch uploads',
      'Priority regeneration',
    ],
    cta: 'Coming soon',
    featured: true,
  },
  {
    name: 'Pro',
    price: '₹999',
    suffix: '/month',
    description: 'For intensive preparation and career coaching.',
    features: [
      'Unlimited active kits',
      'Grounded public interview research',
      'Answer library',
      'Advanced coverage',
      'Preparation exports',
    ],
    cta: 'Coming soon',
  },
];

function AccountActions() {
  const user = useQuery({
    queryKey: ['current-user'],
    queryFn: api.getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  if (user.data) {
    return (
      <Link className="primary-action min-h-10 px-4 py-2" href="/dashboard">
        Workspace <ArrowRight size={16} />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <Link className="whitespace-nowrap px-2 py-2 text-sm font-semibold hover:text-[var(--accent)] sm:px-3" href="/login">
        Log in
      </Link>
      <Link className="primary-action !hidden min-h-10 px-4 py-2 sm:!inline-flex" href="/register">
        Create account
      </Link>
    </div>
  );
}

function ProductFolio() {
  const tasks = [
    ['Company brief', 'Complete', '30 min'],
    ['System design', 'In focus', '45 min'],
    ['Behavioural stories', 'Up next', '30 min'],
    ['Review flashcards', 'Later', '20 min'],
  ];

  return (
    <div className="relative mx-auto w-full max-w-[680px] pb-8 pt-4 lg:mx-0">
      <div className="absolute bottom-1 left-5 right-14 top-9 -rotate-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
      <div className="absolute bottom-3 left-14 right-4 top-7 rotate-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]" />
      <div aria-hidden className="absolute -right-3 top-28 z-30 hidden space-y-2 sm:block">
        {['Questions', 'Coverage', 'Brief'].map((label, position) => (
          <span
            className={`grid h-9 w-[4.5rem] place-items-center rounded-r-md border border-l-0 border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[10px] font-semibold ${position === 1 ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="paper-elevated relative overflow-hidden border border-[var(--border-strong)]">
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-5 py-4 sm:px-7">
          <span className="font-display text-xl font-semibold">Preparation folio</span>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--success-strong)]">
            <span className="status-dot" /> Kit ready
          </span>
        </div>
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-[36%] top-[61px] z-20 hidden w-4 -translate-x-1/2 border-x border-[var(--divider)] bg-[var(--surface-elevated)] opacity-70 lg:block" />
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-[var(--divider)] bg-[var(--surface-elevated)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Today’s plan</h2>
              <span className="text-xs text-[var(--muted)] tabular-nums">2h 05m</span>
            </div>
            <div className="mt-6">
              {tasks.map(([task, state, time], index) => (
                <div className="relative grid grid-cols-[18px_1fr] gap-3 pb-6 last:pb-0" key={task}>
                  {index < tasks.length - 1 ? (
                    <span className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-[var(--border)]" />
                  ) : null}
                  <span
                    className={`relative z-10 mt-1 size-3 rounded-full border ${index === 0 ? 'border-[var(--success)] bg-[var(--success)]' : index === 1 ? 'border-[var(--accent)] bg-[var(--surface)] ring-4 ring-[var(--accent-soft)]' : 'border-[var(--border-strong)] bg-[var(--surface)]'}`}
                  />
                  <div>
                    <p className="text-sm font-semibold">{task}</p>
                    <p className="mt-1 flex justify-between gap-3 text-xs text-[var(--muted)]">
                      <span>{state}</span><span className="tabular-nums">{time}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[var(--muted)]">
              <span>Practice question</span><span className="tabular-nums">1 / 8</span>
            </div>
            <div className="relative mt-5">
              <div className="absolute inset-x-4 -bottom-3 top-3 rotate-1 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
              <article className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_12px_26px_rgb(66_42_30/0.08)] sm:p-6">
                <h3 className="font-display text-2xl font-semibold leading-tight">Design a scalable real-time messaging system.</h3>
                <p className="mt-4 text-sm leading-6 text-[var(--ink-secondary)]">Walk through components, trade-offs, scale, reliability, and data consistency.</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Show answer <ChevronRight size={15} /></span>
              </article>
            </div>
            <div className="mt-8 grid gap-5 border-t border-[var(--divider)] pt-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold">Requirements covered</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--success-soft)]"><div className="h-full w-[84%] rounded-full bg-[var(--success)]" /></div>
                <p className="mt-2 text-xs text-[var(--muted)]">All must-haves mapped</p>
              </div>
              <div>
                <p className="text-xs font-semibold">Company brief</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Verified context and source links beside every finding.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch('/login');
    router.prefetch('/register');
    router.prefetch('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--paper)]">
      <header className="app-header sticky top-0 z-50 border-b border-[var(--divider)]">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <BrandMark /> <span className="font-display text-2xl font-semibold">Prepwise</span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
            {navigation.map(([label, href]) => (
              <a className="text-sm font-semibold text-[var(--ink-secondary)] hover:text-[var(--accent)]" href={href} key={href}>{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] [&::-webkit-details-marker]:hidden"><span className="sr-only">Open navigation</span><Menu size={18} /></summary>
              <nav aria-label="Mobile navigation" className="surface-shadow absolute right-0 top-14 grid w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                {navigation.map(([label, href]) => <a className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--surface-subtle)]" href={href} key={href}>{label}</a>)}
              </nav>
            </details>
            <AccountActions />
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[var(--divider)]">
          <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:px-12 lg:py-20">
            <div className="max-w-2xl page-enter">
              <h1 className="editorial-title text-balance text-5xl sm:text-6xl xl:text-[4.75rem]">Prepare for the role, not just the interview.</h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-secondary)]">Research the company. Map the requirements. Practice what matters. Prepwise turns the source material into a plan for the days you have left.</p>
              <div className="mt-9 flex flex-wrap items-center gap-3"><Link className="primary-action px-6" href="/register">Build my preparation kit <ArrowRight size={18} /></Link><a className="secondary-action px-6" href="#how-it-works">See how it works</a></div>
              <dl className="mt-12 grid max-w-xl grid-cols-3 border-y border-[var(--divider)] py-5">
                {[
                  ['6', 'real pipeline stages'],
                  ['100%', 'must-have target'],
                  ['1–30', 'preparation days'],
                ].map(([value, label], index) => <div className={index ? 'border-l border-[var(--divider)] pl-5' : ''} key={label}><dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd><dt className="mt-1 text-xs leading-5 text-[var(--muted)]">{label}</dt></div>)}
              </dl>
            </div>
            <ProductFolio />
          </div>
        </section>

        <section className="scroll-mt-20" id="about">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.62fr_1fr] lg:py-28">
            <h2 className="editorial-title max-w-lg text-4xl sm:text-5xl">Generic preparation misses the point.</h2>
            <div className="max-w-3xl space-y-5 text-lg leading-8 text-[var(--ink-secondary)]"><p>Every interview is shaped by a specific company, role, seniority level, and set of expectations. A broad list of common questions cannot tell you which topics deserve the most time.</p><p>Prepwise starts from the source material. It separates verified company context from weak public signals, maps questions to requirements, checks what remains uncovered, and builds a realistic preparation sequence.</p></div>
          </div>
        </section>

        <section className="scroll-mt-20 border-y border-[var(--divider)] bg-[var(--surface)]" id="services">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-8 lg:grid-cols-[0.62fr_1fr]"><h2 className="editorial-title max-w-xl text-4xl sm:text-5xl">One source becomes a complete preparation system.</h2><p className="max-w-2xl self-end text-lg leading-8 text-[var(--ink-secondary)]">Every part of the kit stays connected to the role instead of becoming another disconnected list of AI suggestions.</p></div>
            <div className="mt-14 grid border-y border-[var(--divider)] sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ icon: Icon, title, text }, index) => <article className={`py-8 sm:px-7 ${index % 3 !== 0 ? 'lg:border-l lg:border-[var(--divider)]' : ''} ${index % 2 !== 0 ? 'sm:border-l sm:border-[var(--divider)] lg:border-l' : ''} ${index >= 3 ? 'border-t border-[var(--divider)]' : index >= 2 ? 'sm:border-t lg:border-t-0' : ''}`} key={title}><Icon className="text-[var(--accent)]" size={22} strokeWidth={1.7} /><h3 className="font-display mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20" id="how-it-works">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <h2 className="editorial-title max-w-2xl text-4xl sm:text-5xl">From job listing to interview-ready.</h2>
            <ol className="mt-14 grid gap-10 lg:grid-cols-3">
              {[
                ['Add the role', 'Paste the source material: the full job description, company URL, and the number of days before your interview.'],
                ['Review the research', 'See the structured role analysis, checked company sources, and linked study material in one folio.'],
                ['Follow the plan', 'Practise the hardest must-have topics first, then revisit them through the preparation sequence.'],
              ].map(([title, text], index) => <li className="border-t border-[var(--border-strong)] pt-6" key={title}><h3 className="font-display flex items-baseline gap-4 text-2xl font-semibold"><span className="text-sm font-semibold text-[var(--accent)] tabular-nums">0{index + 1}</span>{title}</h3><p className="mt-3 leading-7 text-[var(--muted)]">{text}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="scroll-mt-20 border-y border-[var(--divider)] bg-[var(--surface)]" id="pricing">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1fr] lg:items-end"><h2 className="editorial-title text-4xl sm:text-5xl">Choose the depth that matches your search.</h2><p className="max-w-2xl text-[var(--muted)]">Start with one complete kit. Focus and Pro upgrades will open after secure checkout is connected.</p></div>
            <div className="mt-14 grid overflow-hidden rounded-2xl border border-[var(--border)] lg:grid-cols-3">
              {plans.map((plan, index) => <article className={`flex min-h-[430px] flex-col p-7 sm:p-8 ${index > 0 ? 'border-t border-[var(--border)] lg:border-l lg:border-t-0' : ''} ${plan.featured ? 'bg-[var(--surface-dark)] text-[var(--on-dark)]' : 'bg-[var(--surface-elevated)]'}`} key={plan.name}><div className="flex items-center justify-between gap-4"><h3 className="font-display text-2xl font-semibold">{plan.name}</h3>{plan.featured ? <span className="text-xs font-semibold text-[#e8c6b5]">Most useful</span> : null}</div><p className="mt-8"><span className="font-display text-5xl font-semibold tabular-nums">{plan.price}</span>{plan.suffix ? <span className="ml-1 text-sm opacity-70">{plan.suffix}</span> : null}</p><p className={`mt-4 min-h-14 ${plan.featured ? 'text-[#d8c8bf]' : 'text-[var(--muted)]'}`}>{plan.description}</p><ul className="mt-8 space-y-3 text-sm">{plan.features.map((feature) => <li className="flex gap-3" key={feature}><Check className={plan.featured ? 'text-[#9fb39b]' : 'text-[var(--success)]'} size={17} /><span>{feature}</span></li>)}</ul>{plan.available ? <Link className="primary-action mt-auto w-full" href="/register">{plan.cta}</Link> : <button className={`secondary-action mt-auto w-full ${plan.featured ? 'border-white/30 bg-transparent text-white' : ''}`} disabled type="button">{plan.cta}</button>}</article>)}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20" id="reviews">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.48fr_1fr] lg:py-28">
            <h2 className="editorial-title max-w-md text-4xl sm:text-5xl">Useful because it stays specific.</h2>
            <div className="divide-y divide-[var(--divider)] border-y border-[var(--divider)]">
              {[
                ['“The coverage view showed exactly which backend requirements I had not prepared an example for.”', 'Backend engineering candidate'],
                ['“The schedule stopped me spending three days on easy questions and leaving system design until the night before.”', 'Senior software candidate'],
                ['“I could see where the company brief came from, which made it much easier to trust and verify.”', 'Product engineering candidate'],
              ].map(([quote, role]) => <figure className="py-7" key={role}><blockquote className="font-display text-2xl leading-9">{quote}</blockquote><figcaption className="mt-4 text-sm text-[var(--muted)]">{role}</figcaption></figure>)}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 bg-[var(--surface-dark)] text-[var(--on-dark)]" id="contact">
          <div className="mx-auto grid max-w-7xl items-end gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:py-24"><div className="max-w-3xl"><h2 className="editorial-title text-4xl sm:text-5xl">Have a question about your preparation workflow?</h2><p className="mt-5 max-w-2xl text-[#d8c8bf]">Tell us what you are preparing for, what is missing, or where the tool could be clearer.</p></div><a className="primary-action justify-self-start bg-[var(--on-dark)] text-[var(--surface-dark)] hover:bg-[var(--surface-subtle)]" href="mailto:hello@prepwise.app">hello@prepwise.app <ChevronRight size={17} /></a></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[var(--surface-dark)] text-[#bcaea5]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© 2026 Prepwise</span><div className="flex gap-5"><a className="hover:text-white" href="#about">About</a><a className="hover:text-white" href="#pricing">Plans</a><Link className="hover:text-white" href="/login">Log in</Link></div></div></footer>
    </div>
  );
}
