import type { Metadata } from 'next';

import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'Interview preparation built from the role',
  description:
    'Turn a job description and company URL into researched interview questions, flashcards, coverage analysis, and a focused preparation schedule.',
};

export default function HomePage() {
  return <LandingPage />;
}
