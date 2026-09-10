# Delivery guide

## Demo mode

The frontend is fully demonstrable without MongoDB, OpenAI, Brave Search, or the API server.
Keep the following value in `apps/web/.env.local`:

```text
NEXT_PUBLIC_USE_MOCK_API=true
```

Start only the frontend with:

```text
npm run dev --workspace @prep-kit/web
```

Sign in with:

```text
Email: candidate@example.com
Password: practice-ready
```

## Suggested product walkthrough

1. Open the public landing page and sign in.
2. Review the rich, thin-description, and company-unreachable kits on the dashboard.
3. Create a single kit, then inspect the live generation progress route.
4. Open the rich kit and move through Brief, Role, Questions, Flashcards, Schedule, and Coverage.
5. Edit brief or role text and confirm the background save indicator settles.
6. Edit a question, then preview category regeneration and confirm the edited question is protected.
7. Drag a question between categories or use its move-up and move-down controls.
8. Add or edit a flashcard, start practice mode, reveal cards, and record confidence.
9. Finish a session and confirm weaker material moves toward the front of the next session.
10. Create a batch kit from JSON or CSV and inspect per-row validation before submission.

## Live services

To use the Express API and MongoDB-backed worker, copy `apps/api/.env.example` to
`apps/api/.env`, copy `apps/web/.env.example` to `apps/web/.env.local`, set
`NEXT_PUBLIC_USE_MOCK_API=false`, and provide MongoDB plus the selected LLM provider's key and
model. Free accounts use Gemini generation without discussion search. Focus and Pro accounts also
use the same key for Google Search grounding. Missing paid grounding quota produces a warning
rather than invented data. OpenAI mode can optionally use Brave Search for paid accounts.

Start the complete web and API workspace with:

```text
npm run dev
```

## Batch evaluator

The mandatory evaluator is independent from MongoDB and processes every case even when an
individual case fails:

```text
npm run evaluate -- --input tests/fixtures/batch-cases.json --output kits.json
```

The evaluator needs live model credentials for production generation. Automated tests inject a
controlled provider and do not make paid model requests.

## Final verification

Run these from the project root:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The supported runtime is Node.js 22 or newer.

## Production

See `PRODUCTION.md` for the local real-data gate, Vercel project layout, environment variables,
release order, and post-deployment smoke tests.
