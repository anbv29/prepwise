'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={`inline-flex gap-6 border-b border-[var(--border)] ${className}`}
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
      className={`relative min-h-11 px-0 py-2 text-sm font-semibold text-[var(--muted)] transition-colors after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:scale-x-0 after:bg-[var(--accent)] after:transition-transform data-[state=active]:text-[var(--accent)] data-[state=active]:after:scale-x-100 ${className}`}
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
