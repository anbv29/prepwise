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

The web/API persistence layer uses `MONGODB_URI` and an optional `MONGODB_DATABASE` (default:
`interview_prep`). The batch evaluator remains independent from MongoDB because the assessment
must be able to run it directly from a clean clone.

## Batch evaluation

The mandatory evaluator validates Appendix B input, processes every case through the shared
pipeline package, continues after individual generation failures, validates successful kits,
and writes one Appendix B output file. Shared packages are compiled automatically before the
command runs, so no separate build command is required.

The evaluator now uses the same production generator as the API worker while remaining
independent from MongoDB. It reads OpenAI, optional Brave Search, and research safety settings
from `.env`, runs real bounded research and structured generation, and records an individual
failure without preventing later cases from running. Tests can still inject the deterministic
scaffold generator without making network or paid model requests.

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

## Persistence

`packages/database` uses the official MongoDB driver with runtime-validated document models and
ownership-scoped repositories. It stores users, hashed server-side sessions, kit drafts and
generated output, resumable generation jobs, expiring research results, and per-kit flashcard
practice progress. Startup creates the required uniqueness, ownership, queue, lookup, and TTL
indexes. Database connection state is explicitly returned and closed by the application rather
than hidden in a global singleton.

## Authentication and authorization

The API exposes registration, login, logout, and current-user endpoints under `/api/auth`.
Passwords are salted and hashed with Node's `scrypt`; the browser receives a random, HTTP-only,
SameSite session cookie while MongoDB stores only its SHA-256 digest. Production cookies are
also marked Secure. Browser origins are restricted to `WEB_ORIGIN`, state-changing requests
from other origins are rejected, and authentication responses never expose password hashes or
session records.

`GET /api/kits` and `GET /api/kits/:kitId` are the first protected resource routes. Every query
includes the authenticated user's id, and a kit owned by someone else is returned as a normal
404 rather than revealing that the record exists. Configure the optional one-to-thirty-day
session lifetime with `SESSION_TTL_DAYS` and the cookie name with `SESSION_COOKIE_NAME`.

## Background generation jobs

`POST /api/kits` validates the job description, company URL, and preparation window, then
creates a persistent queued kit and generation job. The request may include an
`Idempotency-Key` header; sending the same key and input again returns the original records
instead of duplicating generation work. `GET /api/jobs/:jobId` exposes owner-scoped status,
stage, percentage, attempt count, and structured failure information. Retryable failed work can
be requeued with `POST /api/jobs/:jobId/retry`.

The API runs a single-concurrency MongoDB-backed worker. Atomic oldest-first claiming lets
multiple application instances share the queue without claiming the same queued record. Jobs
and kits move together through queued, generating, complete, or failed states. The worker
recovers interrupted jobs after `WORKER_STALE_AFTER_MS`, enforces `WORKER_MAX_ATTEMPTS`, drains
cleanly during shutdown, and polls at `WORKER_POLL_INTERVAL_MS`.

Background execution now calls the complete production generator. Progress is persisted through
requirement extraction, company research, discussion search, company-brief generation, question
generation and coverage repair, flashcards, scheduling, and final validation. Research and
generation warnings are stored with the kit, while provider response IDs, model names, token
usage, and stage names are retained in the kit source metadata. Retryable provider and MongoDB
infrastructure failures remain distinguishable from permanent validation failures. Retrying a
job also moves its kit back to the queued state so both records stay synchronized.

## Secure research

`packages/pipeline/src/research` contains the bounded research layer. Company URLs are limited
to HTTP(S), reject credentials and unusual ports, resolve through public IP checks, and are
validated again at connection time to prevent DNS rebinding into loopback, private, link-local,
metadata, documentation, multicast, or reserved address ranges. Every redirect repeats the
same checks. The private-network escape hatch is limited to local development and is rejected
when `NODE_ENV=production`.

Responses have time, redirect, byte, content-type, page-count, and extracted-text limits. The
crawler honors robots.txt where available, follows only useful same-origin HTML pages, strips
scripts and layout noise, and returns plain text with source URLs, titles, truncation flags, and
recoverable warnings. MongoDB caching stores successful pages for a day by default and failed
requests briefly to avoid repeatedly hitting unavailable targets.

Public interview signals are obtained through the server-side Brave Search adapter using
separate site-restricted Reddit and Glassdoor queries. API responses are runtime validated;
only genuine HTTPS hosts are accepted, markup is removed from snippets, URLs are deduplicated,
and every signal retains its source query and URL. Configure it with `BRAVE_SEARCH_API_KEY`.
The API worker runs company requests through the MongoDB cache before crawling. Discussion
search is optional: when `BRAVE_SEARCH_API_KEY` is missing or a research source is unavailable,
the generator records a warning and continues with an explicit limited-research fallback rather
than inventing material.

## Structured LLM and requirement extraction

`packages/pipeline/src/llm` defines a provider-neutral structured-generation contract and an
OpenAI Responses API implementation. The adapter uses strict Zod Structured Outputs, disables
provider-side response storage, records response/model/token metadata, applies explicit request
timeouts, and retries only transient connection, throttling, conflict, or server failures with
bounded exponential backoff. API keys remain server-side. Set `OPENAI_API_KEY` and an explicit
`OPENAI_MODEL`; generic `LLM_API_KEY` and `LLM_MODEL` names remain supported.

The first model stage extracts role title, seniority, responsibilities, and atomic technical,
behavioural, or domain requirements from the job description. The job description is passed as
JSON-encoded untrusted data under higher-priority instructions that forbid following commands
inside it. Application code then normalizes and deduplicates results, promotes conflicting
must-have priority, assigns deterministic `req-001` identifiers, checks evidence against the
original description, and validates the final role with the shared Appendix A contract.

## Grounded kit-section generation

The remaining model stages generate the company brief, interview questions with answer
outlines, and active-recall flashcards. Company pages and public discussion snippets remain
JSON-encoded untrusted data. Company citations are model-selected opaque source IDs that
application code maps back to the crawled URL allowlist, so an invented citation cannot enter
the kit. No available company pages produces an explicit no-research fallback instead of an
invented brief.

Question and flashcard identifiers are assigned deterministically by application code. Unknown
requirement references and duplicate content are removed. After each initial generation, code
checks every must-have requirement and makes one narrowly targeted repair request for any gaps;
if the repair still misses a must-have, generation fails rather than producing a misleadingly
complete kit. Every model call records its stage, response ID, model, and token usage.

## Complete generation pipeline

`packages/pipeline/src/full-generator.ts` is the shared API and batch composition root. It
extracts the role and location, performs bounded company and optional discussion research,
generates all grounded sections, runs deterministic coverage and schedule construction, and
validates the final Appendix A object before returning it. Company and discussion research run
concurrently after role extraction, while dependent model stages remain ordered. The API adds
MongoDB-backed fetch caching and persistent progress/warning callbacks; the evaluator invokes
the same generator directly without requiring a database.
