'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { api } from '@/lib/api';

function createAuthFormSchema(requireProfile: boolean) {
  return z
    .object({
      firstName: z.string().trim().max(50, 'Use 50 characters or fewer.'),
      lastName: z.string().trim().max(50, 'Use 50 characters or fewer.'),
      dateOfBirth: z.string(),
      email: z.string().trim().email('Enter a valid email address.'),
      password: z.string().min(8, 'Use at least 8 characters.').max(128),
    })
    .superRefine((values, context) => {
      if (!requireProfile) return;

      if (values.firstName.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Enter your first name.',
          path: ['firstName'],
        });
      }
      if (values.lastName.length === 0) {
        context.addIssue({ code: 'custom', message: 'Enter your last name.', path: ['lastName'] });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(values.dateOfBirth)) {
        context.addIssue({
          code: 'custom',
          message: 'Enter your date of birth.',
          path: ['dateOfBirth'],
        });
      } else if (values.dateOfBirth > new Date().toISOString().slice(0, 10)) {
        context.addIssue({
          code: 'custom',
          message: 'Date of birth cannot be in the future.',
          path: ['dateOfBirth'],
        });
      }
    });
}

type AuthFormValues = z.input<ReturnType<typeof createAuthFormSchema>>;

export function AuthForm({ mode, returnTo }: { mode: 'login' | 'register'; returnTo?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLogin = mode === 'login';
  const safeDestination =
    returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
  const form = useForm<AuthFormValues>({
    defaultValues: { firstName: '', lastName: '', dateOfBirth: '', email: '', password: '' },
    resolver: zodResolver(createAuthFormSchema(!isLogin)),
  });
  const mutation = useMutation({
    mutationFn: (values: AuthFormValues) =>
      isLogin
        ? api.login({ email: values.email, password: values.password })
        : api.register(values),
    onSuccess: (user) => {
      queryClient.setQueryData(['current-user'], user);
      toast.success(isLogin ? 'Welcome back.' : 'Your workspace is ready.');
      router.replace(safeDestination, { scroll: false });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    router.prefetch(safeDestination);
  }, [router, safeDestination]);

  return (
    <form
      className="mt-10 space-y-5"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      {!isLogin ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold" htmlFor="register-first-name">
            First name
            <input
              autoComplete="given-name"
              className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink)]"
              id="register-first-name"
              type="text"
              {...form.register('firstName')}
            />
            {form.formState.errors.firstName ? (
              <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
                {form.formState.errors.firstName.message}
              </span>
            ) : null}
          </label>
          <label className="block text-sm font-semibold" htmlFor="register-last-name">
            Last name
            <input
              autoComplete="family-name"
              className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink)]"
              id="register-last-name"
              type="text"
              {...form.register('lastName')}
            />
            {form.formState.errors.lastName ? (
              <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
                {form.formState.errors.lastName.message}
              </span>
            ) : null}
          </label>
        </div>
      ) : null}
      {!isLogin ? (
        <label className="block text-sm font-semibold" htmlFor="register-date-of-birth">
          Date of birth
          <input
            autoComplete="bday"
            className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink)]"
            id="register-date-of-birth"
            max={new Date().toISOString().slice(0, 10)}
            type="date"
            {...form.register('dateOfBirth')}
          />
          {form.formState.errors.dateOfBirth ? (
            <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
              {form.formState.errors.dateOfBirth.message}
            </span>
          ) : null}
        </label>
      ) : null}
      <label className="block text-sm font-semibold" htmlFor={`${mode}-email`}>
        Email
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] placeholder:text-[var(--muted)]"
          id={`${mode}-email`}
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
            {form.formState.errors.email.message}
          </span>
        ) : null}
      </label>
      <label className="block text-sm font-semibold" htmlFor={`${mode}-password`}>
        Password
        <input
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] placeholder:text-[var(--muted)]"
          id={`${mode}-password`}
          type="password"
          {...form.register('password')}
        />
        {!isLogin && !form.formState.errors.password ? (
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
            Minimum 8 characters.
          </span>
        ) : null}
        {form.formState.errors.password ? (
          <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
            {form.formState.errors.password.message}
          </span>
        ) : null}
      </label>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? <LoaderCircle className="animate-spin" size={18} /> : null}
        {isLogin ? 'Sign in' : 'Create account'}
        {!mutation.isPending ? <ArrowRight size={18} /> : null}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        {isLogin ? 'New to Prepwise?' : 'Already have an account?'}{' '}
        <Link
          className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
          href={isLogin ? '/register' : '/login'}
        >
          {isLogin ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
    </form>
  );
}
