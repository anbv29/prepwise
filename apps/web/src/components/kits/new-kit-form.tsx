'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileJson, LoaderCircle, Minus, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, type BatchKitInput, type CreateKitInput } from '@/lib/api';

const singleSchema = z.object({
  companyUrl: z.string().url('Enter a complete company URL, including https://.'),
  daysAvailable: z.number().int().min(1).max(30),
  jobDescription: z
    .string()
    .trim()
    .min(20, 'Paste at least 20 characters from the job description.'),
});

type SingleForm = z.infer<typeof singleSchema>;

interface BatchPreviewRow extends BatchKitInput {
  errors: string[];
}

const fieldClass =
  'paper-field mt-2 px-4 text-base';

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function validateBatchRows(value: unknown): BatchPreviewRow[] {
  const rawRows = Array.isArray(value) ? value : [];

  return rawRows.map((raw, index) => {
    const candidate = raw as Record<string, unknown>;
    const normalized: BatchKitInput = {
      id: String(candidate.id ?? `row-${index + 1}`),
      jobDescription: String(candidate.jobDescription ?? candidate.jd ?? ''),
      companyUrl: String(candidate.companyUrl ?? candidate.company_url ?? ''),
      daysAvailable: Number(candidate.daysAvailable ?? candidate.days ?? 7),
    };
    const parsed = singleSchema.safeParse(normalized);
    return {
      ...normalized,
      errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
    };
  });
}

async function rowsFromFile(file: File) {
  const text = await file.text();

  if (file.name.toLowerCase().endsWith('.json')) {
    return validateBatchRows(JSON.parse(text));
  }

  const [headers, ...rows] = parseCsv(text);

  if (!headers) return [];
  return validateBatchRows(
    rows.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index]])),
    ),
  );
}

export function NewKitForm({ initialMode = 'single' }: { initialMode?: 'single' | 'batch' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState(initialMode);
  const [batchRows, setBatchRows] = useState<BatchPreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const form = useForm<SingleForm>({
    defaultValues: {
      companyUrl: '',
      daysAvailable: 7,
      jobDescription: '',
    },
    resolver: zodResolver(singleSchema),
  });

  function openProgress(result: Awaited<ReturnType<typeof api.createKit>>) {
    void queryClient.invalidateQueries({ queryKey: ['kits'] });
    router.push(`/kits/${result.kit.id}/progress?job=${result.job.id}`);
  }

  const createSingle = useMutation({
    mutationFn: (input: CreateKitInput) => api.createKit(input),
    onSuccess: openProgress,
    onError: (error: Error) => toast.error(error.message),
  });
  const createBatch = useMutation({
    mutationFn: (items: readonly BatchKitInput[]) => api.createBatch(items),
    onSuccess: (results) => {
      void queryClient.invalidateQueries({ queryKey: ['kits'] });
      toast.success(`${results.length} kit${results.length === 1 ? '' : 's'} queued.`);
      const first = results[0];
      if (first) router.push(`/kits/${first.kit.id}/progress?job=${first.job.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const days = form.watch('daysAvailable');
  const validBatchRows = batchRows.filter((row) => row.errors.length === 0);

  async function handleFile(file?: File) {
    if (!file) return;

    try {
      const rows = await rowsFromFile(file);
      setFileName(file.name);
      setBatchRows(rows);
      if (rows.length === 0) toast.error('The file did not contain any rows.');
    } catch {
      setBatchRows([]);
      toast.error('That file could not be read. Check its JSON or CSV structure.');
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8 sm:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        href="/dashboard"
      >
        <ArrowLeft size={16} /> Back to kits
      </Link>
      <div className="mt-9 grid gap-5 border-b border-[var(--divider)] pb-9 lg:grid-cols-[0.7fr_1fr] lg:items-end">
        <h1 className="editorial-title text-4xl sm:text-5xl">Build a new preparation folio.</h1>
        <p className="max-w-2xl text-[var(--ink-secondary)]">
          Add the source material once. You can refine every generated section later.
        </p>
      </div>

      <div className="mt-8 grid gap-3 border-y border-[var(--divider)] py-5 text-sm text-[var(--muted)] sm:grid-cols-3">
        <span>Company research with sources</span>
        <span>Requirement-linked practice</span>
        <span>Exact-day preparation schedule</span>
      </div>

      <Tabs
        className="pt-9"
        onValueChange={(value) => {
          if (value === 'single' || value === 'batch') setMode(value);
        }}
        value={mode}
      >
        <TabsList aria-label="Kit creation mode">
          <TabsTrigger value="single">Single role</TabsTrigger>
          <TabsTrigger value="batch">Batch upload</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <form
            className="paper-panel space-y-7 p-5 sm:p-8"
            onSubmit={form.handleSubmit((values) => createSingle.mutate(values))}
          >
            <label className="block font-semibold" htmlFor="job-description">
              Job description
              <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                Paste the complete listing when possible. Short descriptions still work, with honest
                gaps.
              </span>
              <textarea
                className={`${fieldClass} min-h-72 resize-y py-4 leading-7`}
                id="job-description"
                placeholder="Paste the job description here…"
                {...form.register('jobDescription')}
              />
              {form.formState.errors.jobDescription ? (
                <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
                  {form.formState.errors.jobDescription.message}
                </span>
              ) : null}
            </label>

            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block font-semibold" htmlFor="company-url">
                Company URL
                <input
                  className={fieldClass}
                  id="company-url"
                  placeholder="https://company.com"
                  type="url"
                  {...form.register('companyUrl')}
                />
                {form.formState.errors.companyUrl ? (
                  <span className="mt-1 block text-sm font-normal text-[var(--danger)]">
                    {form.formState.errors.companyUrl.message}
                  </span>
                ) : null}
              </label>
              <fieldset>
                <legend className="font-semibold">Days until interview</legend>
                <div className="mt-2 grid min-h-12 grid-cols-[48px_1fr_48px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
                  <button
                    aria-label="Decrease preparation days"
                    className="grid place-items-center border-r border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={days <= 1}
                    onClick={() => form.setValue('daysAvailable', Math.max(1, days - 1))}
                    type="button"
                  >
                    <Minus size={17} />
                  </button>
                  <output className="grid place-items-center font-semibold tabular-nums">
                    {days}
                  </output>
                  <button
                    aria-label="Increase preparation days"
                    className="grid place-items-center border-l border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={days >= 30}
                    onClick={() => form.setValue('daysAvailable', Math.min(30, days + 1))}
                    type="button"
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </fieldset>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-7">
              <button
                className="primary-action px-6"
                disabled={createSingle.isPending}
                type="submit"
              >
                {createSingle.isPending ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : null}
                Build my kit
              </button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="batch">
          <div className="paper-panel space-y-6 p-5 sm:p-8">
            <button
              className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-6 text-center transition-colors hover:border-[var(--accent)]"
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] text-[var(--accent)]">
                <Upload size={20} />
              </span>
              <span className="mt-4 font-semibold">Choose a JSON or CSV file</span>
              <span className="mt-1 text-sm text-[var(--muted)]">
                Use jobDescription, companyUrl, and daysAvailable columns. Nothing is submitted
                before preview.
              </span>
            </button>
            <input
              accept=".json,.csv,application/json,text/csv"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              ref={fileInput}
              type="file"
            />

            {batchRows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <FileJson size={18} /> {fileName}
                  </span>
                  <span className="text-sm text-[var(--muted)] tabular-nums">
                    {validBatchRows.length}/{batchRows.length} valid
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                    <thead className="bg-[var(--surface-subtle)] text-[var(--muted)]">
                      <tr>
                        <th className="px-5 py-3 font-semibold">ID</th>
                        <th className="px-5 py-3 font-semibold">Company</th>
                        <th className="px-5 py-3 font-semibold">Description</th>
                        <th className="px-5 py-3 font-semibold">Days</th>
                        <th className="px-5 py-3 font-semibold">Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((row) => (
                        <tr className="border-t border-[var(--border)]" key={row.id}>
                          <td className="px-5 py-4 font-medium">{row.id}</td>
                          <td className="max-w-48 truncate px-5 py-4">{row.companyUrl}</td>
                          <td className="max-w-64 truncate px-5 py-4 text-[var(--muted)]">
                            {row.jobDescription}
                          </td>
                          <td className="px-5 py-4 tabular-nums">{row.daysAvailable}</td>
                          <td className="px-5 py-4">
                            {row.errors.length === 0 ? (
                              <span className="font-semibold text-[var(--success)]">Ready</span>
                            ) : (
                              <span className="text-[var(--danger)]">{row.errors.join(' ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-[var(--border)] pt-7">
              <button
                className="primary-action px-6"
                disabled={
                  createBatch.isPending ||
                  batchRows.length === 0 ||
                  validBatchRows.length !== batchRows.length
                }
                onClick={() => createBatch.mutate(validBatchRows)}
                type="button"
              >
                {createBatch.isPending ? <LoaderCircle className="animate-spin" size={18} /> : null}
                {batchRows.length > 0
                  ? `Queue ${batchRows.length} kit${batchRows.length === 1 ? '' : 's'}`
                  : 'Queue kits'}
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
