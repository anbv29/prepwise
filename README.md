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
```

Copy `.env.example` to `.env` before running services that require external configuration.
The exact batch evaluation command will be added in its dedicated implementation step.

## Contract validation

The contracts package validates the prescribed kit and batch fields at runtime. It also rejects
duplicate identifiers, broken requirement/question references, non-sequential schedule days,
and schedules whose entry count differs from `days_available`. Useful extensions are preserved,
as permitted by the assessment, while the required field names remain mandatory.
