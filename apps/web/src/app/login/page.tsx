import type { Metadata } from 'next';

import { AuthPage } from '@/components/auth/auth-page';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <AuthPage mode="login" {...(returnTo ? { returnTo } : {})} />;
}
