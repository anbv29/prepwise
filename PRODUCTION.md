# Production runbook

This application deploys as two Vercel projects from one npm-workspaces monorepo:

- `apps/web` is the public Next.js website.
- `apps/api` is the authenticated Express API and AI generation function.
- MongoDB Atlas provides durable users, sessions, kits, job state, research cache, and practice progress.
- Gemini provides strict generation for every plan and Google Search grounding for paid plans.

The browser talks only to the API URL configured at build time. The API accepts browser requests
only from its configured `WEB_ORIGIN`, and session cookies are HTTP-only and Secure in production.

## Real local run

The local files are intentionally ignored by source control:

- `apps/web/.env.local`
- `apps/api/.env`

The checked-in templates are `apps/web/.env.example` and `apps/api/.env.example`.

For the current workstation, a project-specific MongoDB 8 container named `prep-kit-mongo` is
bound to `127.0.0.1:27017`, and both local environment files have already been created. Choose an
LLM provider in `apps/api/.env`, add only that provider's key, then run from the repository root:

```text
npm run dev
```

Open `http://localhost:3000`, create a new account, paste a real job description and company URL,
and wait for the job page to finish. New accounts are Free and do not call Google Search grounding.
Focus and Pro accounts use the same Gemini key for generation and grounded public interview
research. If its grounding quota is unavailable, a paid user's kit still finishes with a
limited-research note.

To stop or restart the local database later:

```text
docker stop prep-kit-mongo
docker start prep-kit-mongo
```

The database is stored in the named Docker volume `prep-kit-mongo-data`, so stopping the container
does not delete local data.

## Deployment prerequisites

1. Create a MongoDB Atlas database user with access only to the application database.
2. Obtain its `mongodb+srv://` connection string.
3. Keep the Gemini or OpenAI key and MongoDB credentials only in Vercel environment variables.
4. Choose stable Vercel project names for the API and web app so their production URLs are known.
5. Use Vercel CLI 20.1 or newer from the monorepo root. Git is not required for CLI deployment.
6. Connect the payment provider's verified server-side webhook to `UserRepository.updatePlan`;
   never accept a paid plan value directly from browser registration or pricing buttons.

If Atlas must allow Vercel's dynamic outbound addresses, use strong unique database credentials and
TLS. A Vercel plan with static egress plus a narrow Atlas IP allowlist is the stricter option.

## API Vercel project

Create the first project with Root Directory `apps/api` and make sure **Include source files outside
of the Root Directory** is enabled so the shared workspace packages are available. Add these
Production and Preview variables:

```text
MONGODB_URI=<MongoDB Atlas connection string>
MONGODB_DATABASE=interview_prep
WEB_ORIGIN=https://<stable-web-project-name>.vercel.app
SESSION_TTL_DAYS=7
SESSION_COOKIE_NAME=prep_session
LLM_PROVIDER=gemini
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.5-flash
LLM_TIMEOUT_MS=60000
LLM_MAX_RETRIES=2
WORKER_STALE_AFTER_MS=900000
WORKER_MAX_ATTEMPTS=3
RESEARCH_MAX_PAGES=5
RESEARCH_MAX_REDIRECTS=3
RESEARCH_MAX_RESPONSE_BYTES=1000000
RESEARCH_MAX_TEXT_CHARS=25000
RESEARCH_REQUEST_TIMEOUT_MS=10000
RESEARCH_CACHE_TTL_MS=86400000
RESEARCH_FAILURE_CACHE_TTL_MS=300000
```

To use OpenAI instead, set `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL=gpt-5.5`
instead of the three Gemini variables. Add `BRAVE_SEARCH_API_KEY` only if OpenAI mode should also
include public interview discussion signals.

Do not set `ALLOW_PRIVATE_NETWORKS=true` on Vercel. Google Search grounding may require billing to
be enabled on the Google AI project even when its current plan includes a search allowance.

The API Vercel configuration gives the function a 300-second maximum duration. Each queued job is
atomically claimed from MongoDB and attached to the Vercel request lifecycle. If an invocation is
interrupted, the persisted stale-job recovery makes the job retryable instead of losing it.

## Web Vercel project

Create the second project with Root Directory `apps/web`, again including files outside the Root
Directory. Add these Production and Preview variables before building:

```text
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_ORIGIN=https://<deployed-api-project>.vercel.app
```

These values are public browser configuration, not secrets. Any change requires a new deployment
because Next.js embeds `NEXT_PUBLIC_` values during the build.

## Release order

1. Run `npm run typecheck`, `npm test`, and `npm run build` locally.
2. Start the real local stack and complete registration, generation, editing, regeneration, and
   practice-progress smoke tests.
3. Install and sign in to Vercel CLI.
4. Link the monorepo projects from the repository root.
5. Deploy the API to Preview and verify `/health` returns `{ "status": "ok" }`.
6. Deploy the web app to Preview with its API origin set to the API URL.
7. Set `WEB_ORIGIN` to the exact web Preview origin and redeploy the API when testing a unique
   Preview URL.
8. Run the same smoke test against Preview.
9. Deploy the API and then the web project to Production.
10. Verify the production health endpoint, registration, one full generation, kit editing, and a
    saved flashcard confidence result. Review Vercel function logs for errors.

The build scripts intentionally reject a Vercel deployment if required production values are
missing or if the web app is still configured to use mock data.
