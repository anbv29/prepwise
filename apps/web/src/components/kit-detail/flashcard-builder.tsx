'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Flashcard, Requirement } from '@/types/kit';

import { useKitEditor } from './kit-editor-context';

const schema = z.object({
  back: z.string().trim().min(8, 'Add a clear answer.'),
  front: z.string().trim().min(5, 'Add a useful recall prompt.'),
  requirementIds: z.array(z.string()),
});
type Values = z.infer<typeof schema>;
const fieldClass =
  'paper-field mt-2 px-3 py-2 text-[var(--ink)]';

function FlashcardForm({
  defaults,
  onCancel,
  onSubmit,
  requirements,
  submitLabel,
}: {
  defaults: Values;
  onCancel?: () => void;
  onSubmit: (values: Values) => void;
  requirements: Requirement[];
  submitLabel: string;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<Values>({ defaultValues: defaults, resolver: zodResolver(schema) });
  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="block text-sm font-semibold">
        Front
        <textarea className={`${fieldClass} min-h-20 resize-y`} {...register('front')} />
        {errors.front ? (
          <span className="mt-1 block text-sm text-[var(--danger)]">{errors.front.message}</span>
        ) : null}
      </label>
      <label className="block text-sm font-semibold">
        Back
        <textarea className={`${fieldClass} min-h-28 resize-y`} {...register('back')} />
        {errors.back ? (
          <span className="mt-1 block text-sm text-[var(--danger)]">{errors.back.message}</span>
        ) : null}
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Requirements covered</legend>
        <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto border border-[var(--border)] p-3">
          {requirements.map((item) => (
            <label className="flex items-start gap-2 text-sm" key={item.id}>
              <input
                className="mt-1 accent-[var(--accent)]"
                type="checkbox"
                value={item.id}
                {...register('requirementIds')}
              />
              <span>{item.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            className="min-h-11 border border-[var(--border-strong)] px-5 font-semibold"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        <button className="primary-action min-h-11 px-5" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Card({ card, index }: { card: Flashcard; index: number }) {
  const { kit, updateKit } = useKitEditor();
  const [editing, setEditing] = useState(false);
  return (
    <motion.article layout className="bg-[var(--surface)] p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--accent)] tabular-nums">
          CARD {String(index + 1).padStart(2, '0')}
        </span>
        {card.edited ? (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
            Edited
          </span>
        ) : null}
      </div>
      <h3 className="font-display mt-5 text-xl font-semibold leading-7">{card.front}</h3>
      <p className="mt-4 leading-7 text-[var(--ink-secondary)]">{card.back}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {card.requirement_ids.map((id) => {
          const requirement = kit.role.requirements.find((item) => item.id === id);
          return requirement ? (
            <span
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
              key={id}
            >
              {requirement.text}
            </span>
          ) : null;
        })}
      </div>
      <div className="mt-5 flex gap-2 border-t border-[var(--border)] pt-4">
        <button
          className="inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
          onClick={() => setEditing((value) => !value)}
          type="button"
        >
          <Pencil size={15} /> Edit
        </button>
        <button
          className="ml-auto inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          onClick={() =>
            updateKit(
              (draft) =>
                void (draft.flashcards = draft.flashcards.filter((item) => item.id !== card.id)),
              { message: 'Flashcard removed' },
            )
          }
          type="button"
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>
      {editing ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="mt-4 border-t border-[var(--border)]"
          initial={{ opacity: 0 }}
        >
          <FlashcardForm
            defaults={{ back: card.back, front: card.front, requirementIds: card.requirement_ids }}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => {
              updateKit(
                (draft) => {
                  const item = draft.flashcards.find((candidate) => candidate.id === card.id);
                  if (!item) return;
                  item.front = values.front;
                  item.back = values.back;
                  item.requirement_ids = values.requirementIds;
                  item.edited = true;
                },
                { message: 'Flashcard updated' },
              );
              setEditing(false);
            }}
            requirements={kit.role.requirements}
            submitLabel="Save flashcard"
          />
        </motion.div>
      ) : null}
    </motion.article>
  );
}

function AddFlashcardDialog() {
  const { kit, updateKit } = useKitEditor();
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          className="primary-action min-h-11 px-5"
          type="button"
        >
          <Plus size={17} /> Add flashcard
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add a flashcard</DialogTitle>
        <DialogDescription>
          Create a concise active-recall prompt and connect it to the role.
        </DialogDescription>
        <FlashcardForm
          defaults={{ back: '', front: '', requirementIds: [] }}
          onSubmit={(values) => {
            updateKit(
              (draft) =>
                void draft.flashcards.push({
                  id: `flashcard-user-${Date.now()}`,
                  front: values.front,
                  back: values.back,
                  requirement_ids: values.requirementIds,
                  edited: true,
                }),
              { message: 'Flashcard added' },
            );
            setOpen(false);
          }}
          requirements={kit.role.requirements}
          submitLabel="Add flashcard"
        />
      </DialogContent>
    </Dialog>
  );
}

export function FlashcardBuilder({ kitId }: { kitId: string }) {
  const { kit } = useKitEditor();
  return (
    <div className="mt-8">
      {kit.flashcards.length ? (
        <>
          <div className="mb-6 flex justify-end">
            <div className="flex flex-wrap justify-end gap-3">
              <Link
                className="inline-flex min-h-11 items-center justify-center border border-[var(--border-strong)] px-5 font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
                href={`/kits/${kitId}/practice`}
              >
                Start practice
              </Link>
              <AddFlashcardDialog />
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
            {kit.flashcards.map((card, index) => (
              <Card card={card} index={index} key={card.id} />
            ))}
          </div>
        </>
      ) : (
        <div className="border border-dashed border-[var(--border-strong)] p-10 text-center">
          <h3 className="text-lg font-semibold">No flashcards yet</h3>
          <p className="mt-2 text-[var(--muted)]">
            Add the first prompt for a short active-recall session.
          </p>
          <div className="mt-5 inline-flex">
            <AddFlashcardDialog />
          </div>
        </div>
      )}
    </div>
  );
}
