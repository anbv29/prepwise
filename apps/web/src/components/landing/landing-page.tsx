'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Layers3,
  Menu,
  MessageSquareText,
  SearchCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

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
  featured?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    description: 'For preparing for one active opportunity.',
    features: ['1 active interview kit', 'Company and role analysis', 'Questions and schedule'],
    cta: 'Start free',
  },
  {
    name: 'Focus',
    price: '₹499',
    suffix: '/month',
    description: 'For an active job search with multiple interviews.',
    features: ['10 kits each month', 'Batch uploads', 'Expanded study sets', 'Priority regeneration'],
    cta: 'Choose Focus',
    featured: true,
  },
  {
    name: 'Pro',
    price: '₹999',
    suffix: '/month',
    description: 'For intensive preparation and career coaching.',
    features: ['Unlimited active kits', 'Answer library', 'Advanced coverage', 'Preparation exports'],
    cta: 'Choose Pro',
  },
];

function AccountActions() {
  const user = useQuery({ queryKey: ['current-user'], queryFn: api.getCurrentUser, retry: false });

  if (user.data) {
    return (
      <Link
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--paper)]"
        href="/dashboard"
      >
        Workspace <ArrowRight size={16} />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link className="px-3 py-2 text-sm font-semibold hover:text-[var(--accent)]" href="/login">
        Log in
      </Link>
      <Link
        className="hidden min-h-10 items-center rounded-lg bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--paper)] sm:inline-flex"
        href="/register"
      >
        Create account
      </Link>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--paper)]">
      <header className="app-header sticky top-0 z-50 border-b border-[var(--border)]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link className="flex shrink-0 items-center gap-3 font-semibold tracking-[-0.01em]" href="/">
            <BrandMark /> Prepwise
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {navigation.map(([label, href]) => (
              <a className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" href={href} key={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="grid h-10 w-10 list-none place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Open navigation</span>
                <Menu size={18} />
              </summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-12 grid w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 surface-shadow">
                {navigation.map(([label, href]) => (
                  <a className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-subtle)]" href={href} key={href}>
                    {label}
                  </a>
                ))}
              </nav>
            </details>
            <AccountActions />
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[var(--border)]">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:py-20">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                <Sparkles size={16} /> Research, questions, and a daily plan
              </p>
              <h1 className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Prepare for the role that is actually in front of you.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
                Paste a job description and company URL. Prepwise turns them into grounded company context, requirement-linked questions, study cards, and a plan for the days you have left.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-6 font-semibold text-white hover:opacity-90" href="/register">
                  Build your first kit <ArrowRight size={18} />
                </Link>
                <a className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border-strong)] px-6 font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]" href="#how-it-works">
                  See how it works
                </a>
              </div>
              <dl className="mt-12 grid max-w-2xl grid-cols-3 border-y border-[var(--border)] py-5">
                <div><dt className="text-sm text-[var(--muted)]">Questions</dt><dd className="mt-1 text-xl font-semibold tabular-nums">16–20</dd></div>
                <div className="border-l border-[var(--border)] pl-5"><dt className="text-sm text-[var(--muted)]">Study cards</dt><dd className="mt-1 text-xl font-semibold tabular-nums">18–24</dd></div>
                <div className="border-l border-[var(--border)] pl-5"><dt className="text-sm text-[var(--muted)]">Plan length</dt><dd className="mt-1 text-xl font-semibold tabular-nums">1–30 days</dd></div>
              </dl>
            </div>

            <div className="mx-auto w-full max-w-xl lg:mx-0">
              <div className="border border-[var(--border-strong)] bg-[var(--surface)] p-4 surface-shadow sm:p-5">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div><p className="text-sm font-semibold">Senior Platform Engineer</p><p className="mt-1 text-sm text-[var(--muted)]">Northstar Labs</p></div>
                  <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-sm font-semibold text-[var(--success)]">Ready</span>
                </div>
                <div className="grid gap-3 py-5 sm:grid-cols-2">
                  {[
                    { title: 'Company brief', detail: '3 verified sources', icon: Building2 },
                    { title: 'Role analysis', detail: '8 mapped requirements', icon: Target },
                    { title: 'Questions', detail: '18 role-specific prompts', icon: MessageSquareText },
                    { title: 'Coverage', detail: 'All must-haves covered', icon: BadgeCheck },
                  ].map(({ title, detail, icon: Icon }) => (
                    <div className="border-l-2 border-[var(--accent)] bg-[var(--surface-subtle)] px-4 py-3" key={title}>
                      <Icon className="text-[var(--accent)]" size={17} />
                      <p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--border)] pt-4">
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">Today’s preparation</span><span className="text-[var(--muted)] tabular-nums">42 minutes</span></div>
                  {['System design and failure recovery', 'TypeScript service boundaries', 'Cross-functional story review'].map((item, index) => (
                    <div className="flex items-center gap-3 border-t border-[var(--border)] py-3 first:border-0" key={item}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)] tabular-nums">{index + 1}</span>
                      <span className="text-sm font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-mt-20" id="about">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.62fr_1fr] lg:py-28">
            <div><p className="text-sm font-semibold text-[var(--accent)]">About Prepwise</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Generic preparation misses the point.</h2></div>
            <div className="max-w-3xl space-y-5 text-lg leading-8 text-[var(--muted)]">
              <p>Every interview is shaped by a specific company, role, seniority level, and set of expectations. A broad list of common questions cannot tell you which topics deserve the most time.</p>
              <p>Prepwise starts from the source material. It separates verified company context from weak public signals, maps questions to requirements, checks what remains uncovered, and builds a realistic preparation sequence.</p>
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 border-y border-[var(--border)] bg-[var(--surface)]" id="services">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <p className="text-sm font-semibold text-[var(--accent)]">What the tool does</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">One source becomes a complete preparation system.</h2>
            <div className="mt-12 grid border-l border-t border-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ icon: Icon, title, text }) => (
                <article className="border-b border-r border-[var(--border)] p-6 sm:p-8" key={title}>
                  <Icon className="text-[var(--accent)]" size={22} /><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-3 text-[var(--muted)]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20" id="how-it-works">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <p className="text-sm font-semibold text-[var(--accent)]">How it works</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">From job listing to interview-ready in three steps.</h2>
            <ol className="mt-12 grid gap-px border border-[var(--border)] bg-[var(--border)] lg:grid-cols-3">
              {[
                ['01', 'Add the role', 'Paste the full job description, company URL, and the number of days before your interview.'],
                ['02', 'Review the research', 'Prepwise analyses the role, checks company sources, and builds linked study material.'],
                ['03', 'Follow the plan', 'Work through the hardest must-have topics first, then revisit them with scheduled review.'],
              ].map(([number, title, text]) => (
                <li className="bg-[var(--paper)] p-7 sm:p-9" key={number}><span className="text-sm font-semibold text-[var(--accent)] tabular-nums">{number}</span><h3 className="mt-10 text-xl font-semibold">{title}</h3><p className="mt-3 text-[var(--muted)]">{text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="scroll-mt-20 border-y border-[var(--border)] bg-[var(--surface)]" id="pricing">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <p className="text-sm font-semibold text-[var(--accent)]">Simple plans</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Use the depth that matches your search.</h2>
            <p className="mt-4 text-[var(--muted)]">Start with one complete kit. Upgrade only when you are preparing across multiple roles.</p>
            <div className="mt-12 grid border border-[var(--border)] lg:grid-cols-3">
              {plans.map((plan, index) => (
                <article className={`p-7 sm:p-8 ${index > 0 ? 'border-t border-[var(--border)] lg:border-l lg:border-t-0' : ''} ${plan.featured ? 'bg-[var(--ink)] text-[var(--paper)]' : ''}`} key={plan.name}>
                  <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{plan.name}</h3>{plan.featured ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">Most useful</span> : null}</div>
                  <p className="mt-7"><span className="text-4xl font-semibold tracking-[-0.04em]">{plan.price}</span>{plan.suffix ? <span className="ml-1 text-sm opacity-70">{plan.suffix}</span> : null}</p>
                  <p className={`mt-4 min-h-14 ${plan.featured ? 'text-white/70' : 'text-[var(--muted)]'}`}>{plan.description}</p>
                  <ul className="mt-7 space-y-3">{plan.features.map((feature) => <li className="flex gap-3 text-sm" key={feature}><Check className="mt-0.5 shrink-0 text-[var(--success)]" size={16} /> {feature}</li>)}</ul>
                  <Link className={`mt-9 inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-4 text-sm font-semibold ${plan.featured ? 'border-white bg-white text-[#16161b]' : 'border-[var(--border-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`} href="/register">{plan.cta}</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20" id="reviews">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.48fr_1fr] lg:py-28">
            <div><p className="text-sm font-semibold text-[var(--accent)]">Candidate reviews</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Useful because it stays specific.</h2></div>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {[
                ['“The coverage view showed exactly which backend requirements I had not prepared an example for.”', 'Backend engineering candidate'],
                ['“The schedule stopped me spending three days on easy questions and leaving system design until the night before.”', 'Senior software candidate'],
                ['“I could see where the company brief came from, which made it much easier to trust and verify.”', 'Product engineering candidate'],
              ].map(([quote, role]) => <figure className="py-7" key={role}><blockquote className="text-xl font-medium leading-8 tracking-[-0.015em]">{quote}</blockquote><figcaption className="mt-4 text-sm text-[var(--muted)]">{role}</figcaption></figure>)}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 border-t border-[var(--border)] bg-[var(--ink)] text-[var(--paper)]" id="contact">
          <div className="mx-auto grid max-w-7xl items-end gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:py-24">
            <div className="max-w-3xl"><p className="text-sm font-semibold text-[#a5b4fc]">Contact</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Have a question about your preparation workflow?</h2><p className="mt-5 max-w-2xl text-white/65">Tell us what you are preparing for, what is missing, or where the tool could be clearer.</p></div>
            <a className="inline-flex min-h-12 items-center gap-2 justify-self-start rounded-xl bg-white px-6 font-semibold text-[#16161b]" href="mailto:hello@prepwise.app">hello@prepwise.app <ChevronRight size={17} /></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[var(--ink)] text-white/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© 2026 Prepwise</span><div className="flex gap-5"><a className="hover:text-white" href="#about">About</a><a className="hover:text-white" href="#pricing">Plans</a><Link className="hover:text-white" href="/login">Log in</Link></div></div>
      </footer>
    </div>
  );
}
