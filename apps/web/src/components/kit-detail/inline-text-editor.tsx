'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function InlineTextEditor({
  label,
  multiline = false,
  onSave,
  value,
  valueClassName = '',
}: {
  label: string;
  multiline?: boolean;
  onSave: (value: string) => void;
  value: string;
  valueClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
      lastSaved.current = value;
    }
  }, [editing, value]);

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function persist(nextValue: string) {
    const clean = nextValue.trim();
    if (!clean || clean === lastSaved.current) return;
    lastSaved.current = clean;
    onSave(clean);
  }

  function schedule(nextValue: string) {
    setDraft(nextValue);
    clearTimer();
    timer.current = setTimeout(() => persist(nextValue), 500);
  }

  function finish() {
    clearTimer();
    persist(draft);
    setEditing(false);
  }

  function cancel() {
    clearTimer();
    setDraft(value);
    lastSaved.current = value;
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group/editor flex items-start justify-between gap-4">
        <p className={valueClassName}>{value}</p>
        <button
          aria-label={`Edit ${label}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] opacity-100 hover:bg-[var(--surface-subtle)] hover:text-[var(--accent)] sm:opacity-0 sm:group-hover/editor:opacity-100 sm:focus-visible:opacity-100"
          onClick={() => setEditing(true)}
          type="button"
        >
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  const sharedClass =
    'w-full border border-[var(--border-strong)] bg-[var(--paper)] px-4 py-3 text-[var(--ink)] focus:border-[var(--accent)]';

  return (
    <div>
      <label className="sr-only" htmlFor={`editor-${label.replace(/\s+/g, '-').toLowerCase()}`}>
        {label}
      </label>
      {multiline ? (
        <textarea
          autoFocus
          className={`${sharedClass} min-h-32 resize-y leading-7`}
          id={`editor-${label.replace(/\s+/g, '-').toLowerCase()}`}
          onChange={(event) => schedule(event.target.value)}
          value={draft}
        />
      ) : (
        <input
          autoFocus
          className={sharedClass}
          id={`editor-${label.replace(/\s+/g, '-').toLowerCase()}`}
          onChange={(event) => schedule(event.target.value)}
          value={draft}
        />
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">Auto-saves after you pause</span>
        <div className="flex gap-2">
          <button
            className="inline-flex min-h-9 items-center gap-1.5 px-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={cancel}
            type="button"
          >
            <X size={15} /> Cancel
          </button>
          <button
            className="inline-flex min-h-9 items-center gap-1.5 bg-[var(--accent)] px-3 text-sm font-semibold text-white"
            onClick={finish}
            type="button"
          >
            <Check size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
