import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: { default: 'Prepwise', template: '%s | Prepwise' },
  description: 'Build a researched, structured interview preparation kit.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
