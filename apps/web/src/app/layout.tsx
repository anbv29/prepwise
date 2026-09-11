import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers';

import './globals.css';

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const interfaceFont = Manrope({
  subsets: ['latin'],
  variable: '--font-interface',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Prepwise', template: '%s | Prepwise' },
  description: 'Build a researched, structured interview preparation kit.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${displayFont.variable} ${interfaceFont.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
