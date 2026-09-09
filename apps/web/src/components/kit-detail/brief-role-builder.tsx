'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { Requirement } from '@/types/kit';

import { InlineTextEditor } from './inline-text-editor';
import { useKitEditor } from './kit-editor-context';
import { RegenerateDialog } from './regenerate-dialog';

const fieldClass =
  'min-h-11 w-full border border-[var(--border)] bg-[var(--paper)] px-3 text-sm text-[var(--ink)] focus:border-[var(--accent)]';

export function BriefBuilder({ kitId }: { kitId: string }) {
  const { kit, updateKit } = useKitEditor();

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <div className="flex justify-end">
        <RegenerateDialog
          kitId={kitId}
          label="Regenerate brief"
          target={{ type: 'company_brief' }}
        />
      </div>
      <section>
        <h3 className="text-sm font-semibold text-[var(--muted)]">Interview summary</h3>
        <div className="mt-3">
          <InlineTextEditor
            label="Interview summary"
            multiline
            onSave={(summary) =>
              updateKit(
                (draft) => {
                  draft.company_brief.summary = summary;
                },
                { silent: true },
              )
            }
            value={kit.company_brief.summary}
            valueClassName="text-lg leading-8"
          />
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--muted)]">What the company does</h3>
        <div className="mt-3">
          <InlineTextEditor
            label="What the company does"
            multiline
            onSave={(whatTheyDo) =>
              updateKit(
                (draft) => {
                  draft.company_brief.what_they_do = whatTheyDo;
                },
                { silent: true },
              )
            }
            value={kit.company_brief.what_they_do}
            valueClassName="text-lg leading-8"
          />
        </div>
      </section>
    </div>
  );
}

function ResponsibilityEditor({ index, value }: { index: number; value: string }) {
  const { updateKit } = useKitEditor();

  return (
    <li className="border border-[var(--border)] bg-[var(--surface)] p-4">
      <InlineTextEditor
        label={`Responsibility ${index + 1}`}
        onSave={(nextValue) =>
          updateKit(
            (draft) => {
              draft.role.responsibilities[index] = nextValue;
            },
            { silent: true },
          )
        }
        value={value}
      />
      <button
        className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[var(--danger)]"
        onClick={() =>
          updateKit(
            (draft) => {
              draft.role.responsibilities.splice(index, 1);
            },
            { message: 'Responsibility removed' },
          )
        }
        type="button"
      >
        <Trash2 size={15} /> Remove
      </button>
    </li>
  );
}

function RequirementRow({ requirement }: { requirement: Requirement }) {
  const { updateKit } = useKitEditor();

  function updateRequirement(updater: (item: Requirement) => void) {
    updateKit(
      (draft) => {
        const item = draft.role.requirements.find((candidate) => candidate.id === requirement.id);
        if (item) updater(item);
      },
      { silent: true },
    );
  }

  return (
    <tr className="border-t border-[var(--border)] align-top">
      <td className="min-w-72 px-4 py-4">
        <InlineTextEditor
          label={`Requirement ${requirement.id}`}
          onSave={(text) => updateRequirement((item) => void (item.text = text))}
          value={requirement.text}
          valueClassName="font-medium"
        />
      </td>
      <td className="px-4 py-4">
        <select
          aria-label={`Area for ${requirement.text}`}
          className={`${fieldClass} min-w-36 capitalize`}
          onChange={(event) =>
            updateRequirement(
              (item) => void (item.kind = event.target.value as Requirement['kind']),
            )
          }
          value={requirement.kind}
        >
          <option value="technical">Technical</option>
          <option value="behavioural">Behavioural</option>
          <option value="domain">Domain</option>
        </select>
      </td>
      <td className="px-4 py-4">
        <select
          aria-label={`Priority for ${requirement.text}`}
          className={`${fieldClass} min-w-32`}
          onChange={(event) =>
            updateRequirement(
              (item) => void (item.priority = event.target.value as Requirement['priority']),
            )
          }
          value={requirement.priority}
        >
          <option value="must">Required</option>
          <option value="nice">Preferred</option>
        </select>
      </td>
      <td className="px-3 py-4 text-right">
        <button
          aria-label={`Remove ${requirement.text}`}
          className="inline-flex size-11 items-center justify-center text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          onClick={() =>
            updateKit(
              (draft) => {
                draft.role.requirements = draft.role.requirements.filter(
                  (candidate) => candidate.id !== requirement.id,
                );
              },
              { message: 'Requirement removed' },
            )
          }
          type="button"
        >
          <Trash2 size={17} />
        </button>
      </td>
    </tr>
  );
}

export function RoleBuilder() {
  const { kit, updateKit } = useKitEditor();
  const [responsibility, setResponsibility] = useState('');
  const [requirement, setRequirement] = useState('');
  const [kind, setKind] = useState<Requirement['kind']>('technical');
  const [priority, setPriority] = useState<Requirement['priority']>('must');

  function addResponsibility(event: FormEvent) {
    event.preventDefault();
    const clean = responsibility.trim();
    if (!clean) return;
    updateKit((draft) => void draft.role.responsibilities.push(clean), {
      message: 'Responsibility added',
    });
    setResponsibility('');
  }

  function addRequirement(event: FormEvent) {
    event.preventDefault();
    const clean = requirement.trim();
    if (!clean) return;
    updateKit(
      (draft) => {
        draft.role.requirements.push({
          id: `req-user-${Date.now()}`,
          kind,
          priority,
          text: clean,
        });
      },
      { message: 'Requirement added' },
    );
    setRequirement('');
  }

  return (
    <div className="mt-8">
      <div className="grid gap-6 border-b border-[var(--border)] pb-8 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Role title</p>
          <InlineTextEditor
            label="Role title"
            onSave={(title) =>
              updateKit((draft) => void (draft.role.title = title), { silent: true })
            }
            value={kit.role.title}
            valueClassName="text-xl font-semibold"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Seniority</p>
          <InlineTextEditor
            label="Seniority"
            onSave={(seniority) =>
              updateKit((draft) => void (draft.role.seniority = seniority), { silent: true })
            }
            value={kit.role.seniority}
            valueClassName="text-xl font-semibold"
          />
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Core responsibilities</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Edit or add evidence you want to prepare.
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {kit.role.responsibilities.map((item, index) => (
            <ResponsibilityEditor index={index} key={`${index}-${item}`} value={item} />
          ))}
        </ul>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={addResponsibility}>
          <label className="sr-only" htmlFor="new-responsibility">
            New responsibility
          </label>
          <input
            className={fieldClass}
            id="new-responsibility"
            onChange={(event) => setResponsibility(event.target.value)}
            placeholder="Add another responsibility"
            value={responsibility}
          />
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-[var(--ink)] px-5 font-semibold text-[var(--paper)]"
            type="submit"
          >
            <Plus size={17} /> Add
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-semibold">Requirements</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coverage updates automatically when requirements or questions change.
        </p>
        <div className="mt-4 overflow-x-auto border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[var(--surface-subtle)] text-sm text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Requirement</th>
                <th className="px-4 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {kit.role.requirements.map((item) => (
                <RequirementRow key={item.id} requirement={item} />
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mt-4 grid gap-3 border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[minmax(0,1fr)_150px_140px_auto]"
          onSubmit={addRequirement}
        >
          <label className="sr-only" htmlFor="new-requirement">
            New requirement
          </label>
          <input
            className={fieldClass}
            id="new-requirement"
            onChange={(event) => setRequirement(event.target.value)}
            placeholder="Add a missing requirement"
            value={requirement}
          />
          <select
            aria-label="New requirement area"
            className={fieldClass}
            onChange={(event) => setKind(event.target.value as Requirement['kind'])}
            value={kind}
          >
            <option value="technical">Technical</option>
            <option value="behavioural">Behavioural</option>
            <option value="domain">Domain</option>
          </select>
          <select
            aria-label="New requirement priority"
            className={fieldClass}
            onChange={(event) => setPriority(event.target.value as Requirement['priority'])}
            value={priority}
          >
            <option value="must">Required</option>
            <option value="nice">Preferred</option>
          </select>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--ink)] px-4 font-semibold text-[var(--paper)]"
            type="submit"
          >
            <Plus size={17} /> Add
          </button>
        </form>
      </section>
    </div>
  );
}
