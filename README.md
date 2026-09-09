# AI Interview Prep Kit

A full-stack application that turns a job description, company website, and preparation
window into a researched, editable interview preparation kit.

## Repository status

The project is being built incrementally from the assessment specification. The current
foundation is a TypeScript npm-workspaces monorepo containing a Next.js frontend, an Express
API, and shared packages for contracts, persistence, and the generation pipeline.

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
