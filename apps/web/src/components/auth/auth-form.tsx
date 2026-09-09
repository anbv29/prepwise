'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { api, type Credentials } from '@/lib/api';

const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters.'),
});

export function AuthForm({ mode, returnTo }: { mode: 'login' | 'register'; returnTo?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLogin = mode === 'login';
  const form = useForm<Credentials>({
    defaultValues: { email: 'candidate@example.com', password: 'practice-ready' },
    resolver: zodResolver(credentialsSchema),
  });
  const mutation = useMutation({
    mutationFn: (credentials: Credentials) =>
      isLogin ? api.login(credentials) : api.register(credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(['current-user'], user);
      toast.success(isLogin ? 'Welcome back.' : 'Your workspace is ready.');
      const safeDestination =
        returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
      router.replace(safeDestination);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-10 space-y-5"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
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
