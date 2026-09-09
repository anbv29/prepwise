'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={`inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1 ${className}`}
      {...props}
    />
  );
}

export function TabsTrigger({
  className = '',
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--muted)] transition-colors data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--ink)] data-[state=active]:shadow-sm ${className}`}
      {...props}
    />
  );
}

export function TabsContent({
  className = '',
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={`mt-8 ${className}`} {...props} />;
}
