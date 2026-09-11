'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
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
import type { Question, Requirement } from '@/types/kit';

import { useKitEditor } from './kit-editor-context';
import { RegenerateDialog } from './regenerate-dialog';

const categories: Question['category'][] = [
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
];
const labels: Record<Question['category'], string> = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System design',
  'company-fit': 'Company fit',
};
const formSchema = z.object({
  answerOutline: z.string().trim().min(12, 'Add a more useful answer outline.'),
  category: z.enum(categories),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().trim().min(10, 'Write a complete interview question.'),
  requirementIds: z.array(z.string()),
});
type FormValues = z.infer<typeof formSchema>;

const inputClass =
  'paper-field mt-2 px-3 text-[var(--ink)]';

function QuestionForm({
  defaultValues,
  onCancel,
  onSubmit,
  requirements,
  submitLabel,
}: {
  defaultValues: FormValues;
  onCancel?: () => void;
  onSubmit: (values: FormValues) => void;
  requirements: Requirement[];
  submitLabel: string;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormValues>({ defaultValues, resolver: zodResolver(formSchema) });

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="block text-sm font-semibold">
        Question
        <textarea className={`${inputClass} min-h-24 resize-y py-3`} {...register('prompt')} />
        {errors.prompt ? (
          <span className="mt-1 block text-sm text-[var(--danger)]">{errors.prompt.message}</span>
        ) : null}
      </label>
      <label className="block text-sm font-semibold">
        Strong answer outline
        <textarea
          className={`${inputClass} min-h-28 resize-y py-3`}
          {...register('answerOutline')}
        />
        {errors.answerOutline ? (
          <span className="mt-1 block text-sm text-[var(--danger)]">
            {errors.answerOutline.message}
          </span>
        ) : null}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Category
          <select className={inputClass} {...register('category')}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {labels[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Difficulty
          <select className={inputClass} {...register('difficulty', { valueAsNumber: true })}>
            <option value={1}>1 — Foundation</option>
            <option value={2}>2 — Applied</option>
            <option value={3}>3 — Advanced</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Requirements covered</legend>
        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto border border-[var(--border)] p-3 sm:grid-cols-2">
          {requirements.map((requirement) => (
            <label className="flex items-start gap-2 text-sm" key={requirement.id}>
              <input
                className="mt-1 accent-[var(--accent)]"
                type="checkbox"
                value={requirement.id}
                {...register('requirementIds')}
              />
              <span>{requirement.text}</span>
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

function SortableQuestion({
  index,
  isFirst,
  isLast,
  onMove,
  question,
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  question: Question;
}) {
  const { kit, updateKit } = useKitEditor();
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({
    data: { category: question.category, type: 'question' },
    id: question.id,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <motion.article
      layout
      className={`bg-[var(--surface)] p-5 sm:p-6 ${sortable.isDragging ? 'relative z-10 opacity-70 shadow-[0_18px_40px_rgb(66_42_30/0.14)]' : ''}`}
      ref={sortable.setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-3">
        <button
          aria-label={`Drag question ${index + 1}`}
          className="mt-0.5 inline-flex size-10 shrink-0 touch-none items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          ref={sortable.setActivatorNodeRef}
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-[var(--accent)]">
              Difficulty {question.difficulty}/3
            </span>
            {question.edited ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                Edited · protected
              </span>
            ) : null}
          </div>
          <h4 className="font-display mt-3 text-xl font-semibold leading-7">{question.prompt}</h4>
          <p className="mt-4 border-l border-[var(--border-strong)] pl-4 leading-7 text-[var(--ink-secondary)]">
            {question.answer_outline}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {question.requirement_ids.map((requirementId) => {
              const requirement = kit.role.requirements.find((item) => item.id === requirementId);
              return requirement ? (
                <span
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
                  key={requirementId}
                >
                  {requirement.text}
                </span>
              ) : null;
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <button
              className="inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
              onClick={() => setEditing((value) => !value)}
              type="button"
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              aria-label="Move question up"
              className="inline-flex size-9 items-center justify-center hover:bg-[var(--surface-subtle)] disabled:opacity-35"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              type="button"
            >
              <ArrowUp size={16} />
            </button>
            <button
              aria-label="Move question down"
              className="inline-flex size-9 items-center justify-center hover:bg-[var(--surface-subtle)] disabled:opacity-35"
              disabled={isLast}
              onClick={() => onMove(1)}
              type="button"
            >
              <ArrowDown size={16} />
            </button>
            <button
              className="ml-auto inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={() =>
                updateKit(
                  (draft) =>
                    void (draft.questions = draft.questions.filter(
                      (item) => item.id !== question.id,
                    )),
                  { message: 'Question removed' },
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
              <QuestionForm
                defaultValues={{
                  answerOutline: question.answer_outline,
                  category: question.category,
                  difficulty: question.difficulty,
                  prompt: question.prompt,
                  requirementIds: question.requirement_ids,
                }}
                onCancel={() => setEditing(false)}
                onSubmit={(values) => {
                  updateKit(
                    (draft) => {
                      const item = draft.questions.find(
                        (candidate) => candidate.id === question.id,
                      );
                      if (!item) return;
                      item.answer_outline = values.answerOutline;
                      item.category = values.category;
                      item.difficulty = values.difficulty;
                      item.prompt = values.prompt;
                      item.requirement_ids = values.requirementIds;
                      item.edited = true;
                    },
                    { message: 'Question updated and protected' },
                  );
                  setEditing(false);
                }}
                requirements={kit.role.requirements}
                submitLabel="Save question"
              />
            </motion.div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function CategoryColumn({ category, kitId }: { category: Question['category']; kitId: string }) {
  const { kit, updateKit } = useKitEditor();
  const questions = kit.questions.filter((question) => question.category === category);
  const droppable = useDroppable({ data: { category, type: 'category' }, id: category });

  function move(questionId: string, direction: -1 | 1) {
    updateKit(
      (draft) => {
        const inCategory = draft.questions.filter((question) => question.category === category);
        const from = inCategory.findIndex((question) => question.id === questionId);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= inCategory.length) return;
        [inCategory[from], inCategory[to]] = [inCategory[to]!, inCategory[from]!];
        const reordered = new Map(inCategory.map((question, index) => [question.id, index]));
        draft.questions.sort((a, b) => {
          if (a.category !== category || b.category !== category) return 0;
          return (reordered.get(a.id) ?? 0) - (reordered.get(b.id) ?? 0);
        });
      },
      { message: 'Question order updated' },
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)]" ref={droppable.setNodeRef}>
      <header className="flex flex-col gap-4 border-b border-[var(--divider)] bg-[var(--surface-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold">{labels[category]}</h3>
          <p className="text-sm text-[var(--muted)] tabular-nums">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </p>
        </div>
        <RegenerateDialog
          kitId={kitId}
          label="Regenerate category"
          target={{ category, type: 'question_category' }}
        />
      </header>
      <SortableContext
        items={questions.map((question) => question.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-px bg-[var(--border)]">
          {questions.length ? (
            questions.map((question, index) => (
              <SortableQuestion
                index={index}
                isFirst={index === 0}
                isLast={index === questions.length - 1}
                key={question.id}
                onMove={(direction) => move(question.id, direction)}
                question={question}
              />
            ))
          ) : (
            <p className="bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
              No questions in this category yet. Add one or drag a question here.
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function AddQuestionDialog() {
  const { kit, updateKit } = useKitEditor();
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          className="primary-action min-h-11 px-5"
          type="button"
        >
          <Plus size={17} /> Add question
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add an interview question</DialogTitle>
        <DialogDescription>
          Create a focused prompt and link it to the requirements it helps you practise.
        </DialogDescription>
        <QuestionForm
          defaultValues={{
            answerOutline: '',
            category: 'technical',
            difficulty: 2,
            prompt: '',
            requirementIds: [],
          }}
          onSubmit={(values) => {
            updateKit(
              (draft) =>
                void draft.questions.push({
                  id: `question-user-${Date.now()}`,
                  requirement_ids: values.requirementIds,
                  category: values.category,
                  prompt: values.prompt,
                  answer_outline: values.answerOutline,
                  difficulty: values.difficulty,
                  edited: true,
                }),
              { message: 'Question added' },
            );
            setOpen(false);
          }}
          requirements={kit.role.requirements}
          submitLabel="Add question"
        />
      </DialogContent>
    </Dialog>
  );
}

export default function QuestionBuilder({ kitId }: { kitId: string }) {
  const { kit, updateKit } = useKitEditor();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const source = kit.questions.find((question) => question.id === active.id);
    if (!source) return;
    const destinationCategory = (over.data.current?.category ?? over.id) as Question['category'];
    if (!categories.includes(destinationCategory)) return;

    updateKit(
      (draft) => {
        const originalMovingIndex = draft.questions.findIndex(
          (question) => question.id === active.id,
        );
        const originalOverIndex = draft.questions.findIndex((question) => question.id === over.id);
        if (source.category === destinationCategory && originalOverIndex >= 0) {
          draft.questions = arrayMove(draft.questions, originalMovingIndex, originalOverIndex);
          return;
        }

        const movingIndex = draft.questions.findIndex((question) => question.id === active.id);
        if (movingIndex < 0) return;
        const [moving] = draft.questions.splice(movingIndex, 1);
        if (!moving) return;
        moving.category = destinationCategory;
        const overIndex = draft.questions.findIndex((question) => question.id === over.id);
        draft.questions.splice(overIndex < 0 ? draft.questions.length : overIndex, 0, moving);
        const grouped = categories.flatMap((category) =>
          draft.questions.filter((question) => question.category === category),
        );
        draft.questions = grouped;
      },
      { message: 'Question moved' },
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          Drag questions between categories, or use the arrow controls for keyboard-friendly
          reordering. Edited questions are protected during regeneration.
        </p>
        <AddQuestionDialog />
      </div>
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="space-y-7">
          {categories.map((category) => (
            <CategoryColumn category={category} key={category} kitId={kitId} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
