import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BatchInputSchema, type BatchOutput } from '@prep-kit/contracts';
import {
  BraveDiscussionSearchProvider,
  createFullKitGenerator,
  evaluateBatch,
  OpenAiStructuredLlmProvider,
  readBraveSearchConfig,
  readOpenAiLlmConfig,
  readResearchConfig,
  type EvaluateBatchOptions,
  type KitGenerator,
} from '@prep-kit/pipeline';

export interface EvaluateArguments {
  inputPath: string;
  outputPath: string;
}

export class EvaluateCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluateCliError';
  }
}

function assignArgument(currentValue: string | undefined, option: string, value: string) {
  if (currentValue !== undefined) {
    throw new EvaluateCliError(`${option} can only be provided once.`);
  }

  if (value.length === 0) {
    throw new EvaluateCliError(`${option} requires a file path.`);
  }

  return value;
}

export function parseEvaluateArguments(argumentsToParse: readonly string[]): EvaluateArguments {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < argumentsToParse.length; index += 1) {
    const argument = argumentsToParse[index];

    if (argument === '--input' || argument === '--output') {
      const value = argumentsToParse[index + 1];

      if (value === undefined || value.startsWith('--')) {
        throw new EvaluateCliError(`${argument} requires a file path.`);
      }

      if (argument === '--input') {
        inputPath = assignArgument(inputPath, '--input', value);
      } else {
        outputPath = assignArgument(outputPath, '--output', value);
      }

      index += 1;
      continue;
    }

    if (argument?.startsWith('--input=')) {
      inputPath = assignArgument(inputPath, '--input', argument.slice('--input='.length));
      continue;
    }

    if (argument?.startsWith('--output=')) {
      outputPath = assignArgument(outputPath, '--output', argument.slice('--output='.length));
      continue;
    }

    throw new EvaluateCliError(`Unknown argument: ${argument ?? ''}`);
  }

  if (inputPath === undefined || outputPath === undefined) {
    throw new EvaluateCliError(
      'Usage: npm run evaluate -- --input <cases.json> --output <kits.json>',
    );
  }

  if (resolve(inputPath) === resolve(outputPath)) {
    throw new EvaluateCliError('Input and output paths must be different files.');
  }

  return { inputPath, outputPath };
}

function summariseValidationError(issues: readonly { path: PropertyKey[]; message: string }[]) {
  return issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join('.') : 'input';
      return `${location}: ${issue.message}`;
    })
    .join('; ');
}

export interface RunEvaluateOptions extends EvaluateBatchOptions {
  generateKit?: KitGenerator;
}

export function createEnvironmentKitGenerator(
  environment: Record<string, string | undefined> = process.env,
) {
  const researchConfig = readResearchConfig(environment);
  const provider = new OpenAiStructuredLlmProvider(readOpenAiLlmConfig(environment));
  const hasDiscussionSearchKey = Boolean(
    environment.BRAVE_SEARCH_API_KEY?.trim() || environment.SEARCH_API_KEY?.trim(),
  );

  return createFullKitGenerator({
    provider,
    researchConfig,
    ...(hasDiscussionSearchKey
      ? {
          discussionProvider: new BraveDiscussionSearchProvider(readBraveSearchConfig(environment)),
        }
      : {}),
  });
}

export async function runEvaluate(
  rawArguments: readonly string[],
  options: RunEvaluateOptions = {},
): Promise<{ outputPath: string; output: BatchOutput }> {
  const argumentsParsed = parseEvaluateArguments(rawArguments);
  const inputPath = resolve(argumentsParsed.inputPath);
  const outputPath = resolve(argumentsParsed.outputPath);
  const rawInput = await readFile(inputPath, 'utf8');
  let decodedInput: unknown;

  try {
    decodedInput = JSON.parse(rawInput);
  } catch {
    throw new EvaluateCliError(`Input file is not valid JSON: ${inputPath}`);
  }

  const parsedInput = BatchInputSchema.safeParse(decodedInput);

  if (!parsedInput.success) {
    throw new EvaluateCliError(
      `Input file does not match Appendix B: ${summariseValidationError(parsedInput.error.issues)}`,
    );
  }

  const batchOptions: EvaluateBatchOptions = options.now === undefined ? {} : { now: options.now };
  const output = await evaluateBatch(
    parsedInput.data,
    options.generateKit ?? createEnvironmentKitGenerator(),
    batchOptions,
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  return { outputPath, output };
}

const executedFile = process.argv[1];
const isDirectExecution =
  executedFile !== undefined && import.meta.url === pathToFileURL(resolve(executedFile)).href;

if (isDirectExecution) {
  runEvaluate(process.argv.slice(2))
    .then(({ output, outputPath }) => {
      console.log(`Wrote ${output.kits.length} result(s) to ${outputPath}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Batch evaluation failed.';
      console.error(message);
      process.exitCode = 1;
    });
}
