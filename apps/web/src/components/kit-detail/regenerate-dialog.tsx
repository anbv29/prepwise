'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, type RegenerationTarget } from '@/lib/api';

export function RegenerateDialog({
  kitId,
  label,
  target,
}: {
  kitId: string;
  label: string;
  target: RegenerationTarget;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const targetKey =
    target.type === 'company_brief' ? target.type : `${target.type}-${target.category}`;
  const preview = useQuery({
    enabled: open,
    queryFn: () => api.previewRegeneration(kitId, target),
    queryKey: ['regeneration-preview', kitId, targetKey],
  });
  const regenerate = useMutation({
    mutationFn: () => api.regenerateKitSection(kitId, target),
    onSuccess: (record) => {
      queryClient.setQueryData(['kit', kitId], record);
      void queryClient.invalidateQueries({ queryKey: ['kits'] });
      toast.success('Section regenerated. Edited items were preserved.');
      setOpen(false);
    },
    onError: () => toast.error('Regeneration failed. Nothing in your kit was changed.'),
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          className="inline-flex min-h-11 items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
          type="button"
        >
          <RefreshCw size={16} /> {label}
        </button>
      </DialogTrigger>
      <DialogContent>
        {preview.isLoading ? (
          <div className="space-y-4 py-6" aria-label="Loading regeneration preview">
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-28 w-full" />
          </div>
        ) : preview.isError || !preview.data ? (
          <div>
            <DialogTitle>Preview unavailable</DialogTitle>
            <DialogDescription>
              The proposed changes could not be loaded. Your current content is untouched.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogTitle>{preview.data.title}</DialogTitle>
            <DialogDescription>{preview.data.summary}</DialogDescription>
            <div className="mt-6 border-y border-[var(--border)] py-4">
              <p className="text-sm font-semibold">Proposed changes</p>
              <ul className="mt-3 space-y-3">
                {preview.data.changes.map((change) => (
                  <li className="flex gap-3 text-sm" key={change}>
                    <Check className="mt-0.5 shrink-0 text-[var(--success)]" size={17} />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
            {preview.data.preservedEditedItems > 0 ? (
              <div className="mt-5 flex gap-3 bg-[var(--success-soft)] p-4 text-sm">
                <ShieldCheck className="mt-0.5 shrink-0 text-[var(--success)]" size={18} />
                <p>
                  <strong>{preview.data.preservedEditedItems} edited item(s)</strong> will stay
                  exactly as written.
                </p>
              </div>
            ) : null}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <button
                  className="min-h-11 border border-[var(--border-strong)] px-5 font-semibold"
                  type="button"
                >
                  Keep current version
                </button>
              </DialogClose>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--accent)] px-5 font-semibold text-white disabled:opacity-60"
                disabled={regenerate.isPending}
                onClick={() => regenerate.mutate()}
                type="button"
              >
                <RefreshCw className={regenerate.isPending ? 'animate-spin' : ''} size={17} />
                {regenerate.isPending ? 'Regenerating…' : 'Accept regeneration'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
