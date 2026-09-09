# AI Interview Prep Kit

A full-stack application that turns a job description, company website, and preparation
window into a researched, editable interview preparation kit.

## Repository status

The project is being built incrementally from the assessment specification. The current
foundation is a TypeScript npm-workspaces monorepo containing a Next.js frontend, an Express
API, and shared packages for contracts, persistence, and the generation pipeline. Appendix A
kit data and Appendix B batch input/output are implemented as shared Zod schemas.

## Workspace layout

```text
apps/web            Next.js frontend
apps/api            Express API and generation worker
packages/contracts  Shared runtime schemas and TypeScript types
packages/database   Persistence models and repositories
packages/pipeline   Research, generation, coverage, and scheduling
tests               Cross-package tests
```

## Local commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Copy `.env.example` to `.env` before running services that require external configuration.

## Batch evaluation

The mandatory evaluator validates Appendix B input, processes every case through the shared
pipeline package, continues after individual generation failures, validates successful kits,
and writes one Appendix B output file. Shared packages are compiled automatically before the
command runs, so no separate build command is required.

The current evaluator uses an explicitly temporary scaffold generator. It produces honest,
schema-valid `research pending` kits with exact schedule lengths so the command and failure
boundaries can be tested before retrieval and LLM generation are connected. The scaffold
generator will be replaced by the real shared generator in the pipeline implementation steps.

## Contract validation

The contracts package validates the prescribed kit and batch fields at runtime. It also rejects
duplicate identifiers, broken requirement/question references, non-sequential schedule days,
and schedules whose entry count differs from `days_available`. Useful extensions are preserved,
as permitted by the assessment, while the required field names remain mandatory.

## Deterministic coverage

`packages/pipeline/src/coverage.ts` checks coverage using stable requirement references rather
than asking the language model to judge its own output. It reports covered and uncovered
requirements in source order, separates must-have gaps from nice-to-have gaps, records unknown
references, and converts the result into Appendix A's exact `coverage` shape. Duplicate stable
IDs are rejected because they make the relationship between questions and requirements
ambiguous.

## Deterministic scheduling

`packages/pipeline/src/schedule.ts` allocates every generated question across exactly the
requested number of days. Questions covering must-have requirements are ordered before
nice-to-have or unlinked questions, with harder questions first within each priority group.
Initial work is balanced into contiguous day buckets; additional days become review sessions
that reference existing question IDs. The allocator refuses to run while a must-have
requirement is uncovered or while a question references an unknown requirement.
