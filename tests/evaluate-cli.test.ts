import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BatchOutputSchema } from '@prep-kit/contracts';
import { createScaffoldKit } from '@prep-kit/pipeline';

import { EvaluateCliError, parseEvaluateArguments, runEvaluate } from '../scripts/evaluate.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('parseEvaluateArguments', () => {
  it('parses the exact assessment command arguments', () => {
    expect(parseEvaluateArguments(['--input', 'cases.json', '--output', 'kits.json'])).toEqual({
      inputPath: 'cases.json',
      outputPath: 'kits.json',
    });
  });

  it('also accepts equals-style arguments', () => {
    expect(parseEvaluateArguments(['--input=cases.json', '--output=kits.json'])).toEqual({
      inputPath: 'cases.json',
      outputPath: 'kits.json',
    });
  });

  it.each([
    { argumentsToParse: [] },
    { argumentsToParse: ['--input', 'cases.json'] },
    { argumentsToParse: ['--output', 'kits.json'] },
    { argumentsToParse: ['--unknown', 'value'] },
    { argumentsToParse: ['--input', 'same.json', '--output', 'same.json'] },
  ])('rejects invalid arguments: $argumentsToParse', ({ argumentsToParse }) => {
    expect(() => parseEvaluateArguments(argumentsToParse)).toThrowError(EvaluateCliError);
  });
});

describe('runEvaluate', () => {
  it('reads cases and writes schema-valid Appendix B output', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'prep-kit-evaluate-'));
    temporaryDirectories.push(temporaryDirectory);
    const inputPath = join(temporaryDirectory, 'fixtures', 'cases.json');
    const outputPath = join(temporaryDirectory, 'results', 'kits.json');

    await mkdir(join(temporaryDirectory, 'fixtures'), { recursive: true });
    await writeFile(
      inputPath,
      JSON.stringify([
        {
          id: 'case-01',
          jd: 'Senior Backend Engineer\n\nBuild reliable APIs.',
          company_url: 'http://localhost:8099/acme/',
          days: 3,
        },
      ]),
      'utf8',
    );

    const result = await runEvaluate(['--input', inputPath, '--output', outputPath], {
      generateKit: createScaffoldKit,
      now: () => new Date('2026-09-09T08:00:00.000Z'),
    });
    const writtenOutput: unknown = JSON.parse(await readFile(outputPath, 'utf8'));

    expect(result.outputPath).toBe(outputPath);
    expect(BatchOutputSchema.safeParse(writtenOutput).success).toBe(true);
    expect(result.output.kits[0]?.status).toBe('ok');
    expect(result.output.kits[0]?.kit?.schedule.days).toHaveLength(3);
  });

  it('does not write output for malformed JSON input', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'prep-kit-evaluate-'));
    temporaryDirectories.push(temporaryDirectory);
    const inputPath = join(temporaryDirectory, 'cases.json');
    const outputPath = join(temporaryDirectory, 'kits.json');

    await writeFile(inputPath, '{not-json}', 'utf8');

    await expect(runEvaluate(['--input', inputPath, '--output', outputPath])).rejects.toThrowError(
      EvaluateCliError,
    );
    await expect(readFile(outputPath, 'utf8')).rejects.toThrow();
  });
});
