import { z } from 'zod';

import { KitSchema } from './kit.js';

const identifierSchema = z.string().min(1, 'An id cannot be empty.');

export const BatchInputCaseSchema = z
  .object({
    id: identifierSchema,
    jd: z.string(),
    company_url: z.string(),
    days: z.number().int().positive(),
  })
  .passthrough();
export type BatchInputCase = z.infer<typeof BatchInputCaseSchema>;

export const BatchInputSchema = z.array(BatchInputCaseSchema).superRefine((cases, context) => {
  const seenIds = new Set<string>();

  cases.forEach((batchCase, index) => {
    if (seenIds.has(batchCase.id)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: `Duplicate batch case id: ${batchCase.id}`,
      });
    }

    seenIds.add(batchCase.id);
  });
});
export type BatchInput = z.infer<typeof BatchInputSchema>;

export const BatchErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .passthrough();
export type BatchError = z.infer<typeof BatchErrorSchema>;

export const SuccessfulBatchResultSchema = z
  .object({
    id: identifierSchema,
    status: z.literal('ok'),
    kit: KitSchema,
    error: z.null(),
  })
  .passthrough();
export type SuccessfulBatchResult = z.infer<typeof SuccessfulBatchResultSchema>;

export const FailedBatchResultSchema = z
  .object({
    id: identifierSchema,
    status: z.literal('failed'),
    kit: z.null(),
    error: BatchErrorSchema,
  })
  .passthrough();
export type FailedBatchResult = z.infer<typeof FailedBatchResultSchema>;

export const BatchResultSchema = z.discriminatedUnion('status', [
  SuccessfulBatchResultSchema,
  FailedBatchResultSchema,
]);
export type BatchResult = z.infer<typeof BatchResultSchema>;

export const BatchOutputSchema = z
  .object({
    version: z.literal('1.0'),
    generated_at: z.string().datetime({ offset: true }),
    kits: z.array(BatchResultSchema),
  })
  .passthrough()
  .superRefine((output, context) => {
    const seenIds = new Set<string>();

    output.kits.forEach((result, index) => {
      if (seenIds.has(result.id)) {
        context.addIssue({
          code: 'custom',
          path: ['kits', index, 'id'],
          message: `Duplicate batch result id: ${result.id}`,
        });
      }

      seenIds.add(result.id);
    });
  });
export type BatchOutput = z.infer<typeof BatchOutputSchema>;
