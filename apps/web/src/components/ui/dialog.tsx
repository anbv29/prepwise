'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className = '',
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#2a1b15]/55 data-[state=closed]:animate-none" />
      <DialogPrimitive.Content
        className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgb(42_27_21/0.22)] sm:p-8 ${className}`}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close dialog"
          className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className = '',
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={`editorial-title pr-10 text-3xl ${className}`}
      {...props}
    />
  );
}

export function DialogDescription({
  className = '',
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={`mt-3 leading-7 text-[var(--muted)] ${className}`}
      {...props}
    />
  );
}
