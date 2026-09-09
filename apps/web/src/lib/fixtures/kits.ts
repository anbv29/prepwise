import type { Kit, KitRecord } from '@/types/kit';

const researchedAt = '2026-09-08T10:30:00.000Z';

export const richKit: Kit = {
  source: {
    company: 'Northstar Labs',
    company_url: 'https://northstar.example',
    role: 'Senior Platform Engineer',
    location: 'Bengaluru, Hybrid',
    jd_chars: 4_862,
    researched_at: researchedAt,
    pages_used: [
      'https://northstar.example/about',
      'https://northstar.example/engineering',
      'https://reddit.com/r/interviews/example',
    ],
  },
  company_brief: {
    summary:
      'Northstar Labs builds workflow infrastructure for operations teams that need reliable, auditable automation across fragmented systems. Its engineering work centres on durable execution, clear failure handling, and integrations that remain dependable as customer workflows become more complex.',
    what_they_do:
      'The platform connects operational data, orchestrates multi-step workflows, and gives teams visibility into failures and manual intervention points. Customers use it to replace brittle manual processes while retaining audit history, permission controls, and a clear path for human review when automation cannot proceed safely.',
    sources: ['https://northstar.example/about', 'https://northstar.example/engineering'],
  },
  role: {
    title: 'Senior Platform Engineer',
    seniority: 'Senior individual contributor',
    responsibilities: [
      'Design and operate reliable TypeScript services.',
      'Lead system-design decisions across platform teams.',
      'Partner with product and support on ambiguous customer problems.',
      'Improve observability and operational response for distributed workloads.',
      'Mentor engineers and raise the quality of technical decision-making.',
    ],
    requirements: [
      {
        id: 'req-001',
        text: 'Production TypeScript and Node.js experience',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-002',
        text: 'Distributed-system design and failure recovery',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-003',
        text: 'Clear cross-functional communication',
        kind: 'behavioural',
        priority: 'must',
      },
      {
        id: 'req-004',
        text: 'Workflow automation domain experience',
        kind: 'domain',
        priority: 'nice',
      },
      {
        id: 'req-005',
        text: 'API design, versioning, and integration reliability',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-006',
        text: 'Production observability and incident response',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-007',
        text: 'Technical leadership and engineering mentorship',
        kind: 'behavioural',
        priority: 'must',
      },
      {
        id: 'req-008',
        text: 'Experience with event-driven architecture',
        kind: 'technical',
        priority: 'nice',
      },
    ],
  },
  questions: [
    {
      id: 'question-001',
      requirement_ids: ['req-001'],
      category: 'technical',
      prompt: 'How would you keep a large TypeScript service boundary safe as its API evolves?',
      answer_outline:
        'Start with explicit contracts and runtime validation, then discuss compatibility, observability, focused tests, and migration strategy.',
      difficulty: 2,
    },
    {
      id: 'question-002',
      requirement_ids: ['req-002', 'req-004'],
      category: 'system-design',
      prompt: 'Design a workflow engine that can recover safely after a worker crashes.',
      answer_outline:
        'Clarify delivery guarantees, model durable state transitions, use idempotency keys and leases, and cover retries, poison work, and monitoring.',
      difficulty: 3,
    },
    {
      id: 'question-003',
      requirement_ids: ['req-003'],
      category: 'behavioural',
      prompt: 'Tell me about a time you changed a technical plan after learning from another team.',
      answer_outline:
        'Use a concrete situation, explain the new evidence, show how you aligned people, and quantify the result without overstating personal credit.',
      difficulty: 2,
      edited: true,
    },
    {
      id: 'question-004',
      requirement_ids: [],
      category: 'company-fit',
      prompt: 'Why does operational workflow infrastructure interest you now?',
      answer_outline:
        'Connect the company problem to relevant experience, explain what you want to learn, and name one thoughtful product or engineering question.',
      difficulty: 1,
    },
    {
      id: 'question-005',
      requirement_ids: ['req-005'],
      category: 'technical',
      prompt:
        'How would you evolve a public API without breaking long-lived customer integrations?',
      answer_outline:
        'Clarify compatibility promises, describe additive change and versioning, cover deprecation telemetry and communication, and explain how contract tests protect critical integrations.',
      difficulty: 2,
    },
    {
      id: 'question-006',
      requirement_ids: ['req-002', 'req-008'],
      category: 'system-design',
      prompt:
        'Design an event-driven system that preserves ordering where it matters without serialising all work.',
      answer_outline:
        'Define the ordering boundary, partition deliberately, discuss consumer concurrency and idempotency, then cover replay, late events, monitoring, and operational recovery.',
      difficulty: 3,
    },
    {
      id: 'question-007',
      requirement_ids: ['req-001', 'req-005'],
      category: 'technical',
      prompt:
        'Where should runtime validation sit in a typed Node.js service, and what should happen when it fails?',
      answer_outline:
        'Identify every untrusted boundary, separate validation from domain logic, return stable errors, retain useful diagnostics, and avoid letting static types create false confidence.',
      difficulty: 2,
    },
    {
      id: 'question-008',
      requirement_ids: ['req-006'],
      category: 'technical',
      prompt: 'Which signals would you add before launching a high-volume workflow service?',
      answer_outline:
        'Start from user-visible outcomes, define service-level indicators, add structured events and traces, monitor queues and retry behaviour, and connect alerts to an actionable runbook.',
      difficulty: 2,
    },
    {
      id: 'question-009',
      requirement_ids: ['req-004', 'req-005'],
      category: 'system-design',
      prompt:
        'How would you design an integration platform for third-party APIs with inconsistent rate limits and reliability?',
      answer_outline:
        'Cover connector isolation, rate-limit budgets, backoff, circuit breaking, idempotency, credential handling, observability, and how failures are surfaced for human intervention.',
      difficulty: 3,
    },
    {
      id: 'question-010',
      requirement_ids: ['req-003'],
      category: 'behavioural',
      prompt:
        'Tell me about a technically correct decision that you had to explain differently to earn support.',
      answer_outline:
        'Describe the audience and resistance, show how you reframed the tradeoff around shared goals, explain the decision process, and finish with the measurable outcome.',
      difficulty: 2,
    },
    {
      id: 'question-011',
      requirement_ids: ['req-007'],
      category: 'behavioural',
      prompt:
        'How have you helped another engineer improve a design without taking ownership away from them?',
      answer_outline:
        'Use a specific example, explain the questions and feedback you offered, show how the engineer retained agency, and describe both the system and learning outcomes.',
      difficulty: 2,
    },
    {
      id: 'question-012',
      requirement_ids: [],
      category: 'company-fit',
      prompt:
        'What would you want to learn about Northstar Labs’ approach to human intervention in automated workflows?',
      answer_outline:
        'Ask about failure ownership, customer controls, escalation paths, audit requirements, and the product tradeoff between automation depth and understandable recovery.',
      difficulty: 1,
    },
    {
      id: 'question-013',
      requirement_ids: ['req-002', 'req-006'],
      category: 'system-design',
      prompt:
        'A queue backlog is growing while error rates remain low. How would you diagnose and stabilise the system?',
      answer_outline:
        'Confirm the symptom and impact, inspect arrival and service rates, segment by workload, find saturation points, apply safe load controls, and preserve evidence for the root-cause review.',
      difficulty: 3,
    },
    {
      id: 'question-014',
      requirement_ids: ['req-002'],
      category: 'technical',
      prompt:
        'Compare leases, heartbeats, and visibility timeouts for recovering work from failed workers.',
      answer_outline:
        'Explain each mechanism, identify clock and duplicate-delivery risks, compare operational complexity, and choose based on task duration, ownership semantics, and recovery requirements.',
      difficulty: 3,
    },
    {
      id: 'question-015',
      requirement_ids: ['req-001'],
      category: 'technical',
      prompt: 'How would you split a growing TypeScript service while preserving delivery speed?',
      answer_outline:
        'Start with change patterns and ownership, find stable domain seams, introduce explicit contracts and observability, migrate incrementally, and avoid a premature distributed rewrite.',
      difficulty: 2,
    },
    {
      id: 'question-016',
      requirement_ids: ['req-003', 'req-007'],
      category: 'behavioural',
      prompt:
        'Describe a time an incident revealed a team-process problem rather than only a code defect.',
      answer_outline:
        'Explain the incident without blame, identify the systemic condition, show how you involved the team in the correction, and quantify improvements to detection or recovery.',
      difficulty: 3,
    },
    {
      id: 'question-017',
      requirement_ids: ['req-005', 'req-006'],
      category: 'technical',
      prompt:
        'How do you decide whether a production integration failure should be retried, parked, or surfaced immediately?',
      answer_outline:
        'Classify transient and permanent failures, consider safety and idempotency, set bounded retry policies, retain diagnostic context, and define clear ownership for terminal cases.',
      difficulty: 2,
    },
    {
      id: 'question-018',
      requirement_ids: ['req-004', 'req-008'],
      category: 'company-fit',
      prompt:
        'Which engineering tradeoffs are distinctive in workflow products compared with ordinary CRUD applications?',
      answer_outline:
        'Discuss durable state, long-running execution, retries, human intervention, auditability, connector variability, and why user trust depends on understandable failure behaviour.',
      difficulty: 2,
    },
  ],
  flashcards: [
    {
      id: 'flashcard-001',
      front: 'What makes a retry safe?',
      back: 'Idempotent handling, bounded attempts, observable outcomes, and a deliberate terminal-failure path.',
      requirement_ids: ['req-002'],
    },
    {
      id: 'flashcard-002',
      front: 'What belongs at a TypeScript service boundary?',
      back: 'Narrow static types plus runtime validation for every value crossing an untrusted boundary.',
      requirement_ids: ['req-001'],
    },
    {
      id: 'flashcard-003',
      front: 'A concise structure for cross-functional conflict?',
      back: 'Shared goal, evidence, tradeoff, decision, and the measurable result.',
      requirement_ids: ['req-003'],
    },
    {
      id: 'flashcard-004',
      front: 'What makes an API change backward compatible?',
      back: 'Existing consumers keep their current behaviour while new capability is introduced additively, documented clearly, and protected by contract tests.',
      requirement_ids: ['req-005'],
    },
    {
      id: 'flashcard-005',
      front: 'When is event ordering actually required?',
      back: 'Only within the smallest business boundary where reordering changes correctness; global ordering is usually costly and unnecessary.',
      requirement_ids: ['req-002', 'req-008'],
    },
    {
      id: 'flashcard-006',
      front: 'What should a useful service-level indicator measure?',
      back: 'A user-visible outcome such as successful workflow completion, latency, freshness, or correctness rather than an isolated machine metric.',
      requirement_ids: ['req-006'],
    },
    {
      id: 'flashcard-007',
      front: 'Why use a dead-letter or parked-work queue?',
      back: 'It stops poison work consuming capacity while preserving payload, failure context, and a deliberate path for inspection and recovery.',
      requirement_ids: ['req-002', 'req-006'],
    },
    {
      id: 'flashcard-008',
      front: 'What belongs in an integration retry policy?',
      back: 'Failure classification, idempotency conditions, exponential backoff with jitter, attempt and time limits, observability, and a terminal owner.',
      requirement_ids: ['req-005', 'req-006'],
    },
    {
      id: 'flashcard-009',
      front: 'How should rate limits be handled across many tenants?',
      back: 'Use per-provider and per-tenant budgets, fair scheduling, backpressure, clear quota visibility, and isolation so one customer cannot exhaust shared capacity.',
      requirement_ids: ['req-004', 'req-005'],
    },
    {
      id: 'flashcard-010',
      front: 'What makes an alert actionable?',
      back: 'It identifies user impact, names the owning service, includes diagnostic context, and links to a tested first-response path.',
      requirement_ids: ['req-006'],
    },
    {
      id: 'flashcard-011',
      front: 'A practical framework for an engineering tradeoff?',
      back: 'State the goal, constraints, viable options, evidence, reversible and irreversible consequences, decision, and validation plan.',
      requirement_ids: ['req-003', 'req-007'],
    },
    {
      id: 'flashcard-012',
      front: 'How can a mentor preserve another engineer’s ownership?',
      back: 'Ask clarifying questions, make risks visible, offer alternatives and context, then let the engineer make and communicate the decision.',
      requirement_ids: ['req-007'],
    },
    {
      id: 'flashcard-013',
      front: 'What is a safe boundary for splitting a service?',
      back: 'A cohesive domain with clear ownership, a stable contract, observable behaviour, and fewer cross-boundary transactions than the alternatives.',
      requirement_ids: ['req-001'],
    },
    {
      id: 'flashcard-014',
      front: 'Why is backpressure part of reliability?',
      back: 'It keeps incoming work from overwhelming finite capacity, preserves recovery headroom, and turns silent collapse into controlled degradation.',
      requirement_ids: ['req-002', 'req-006'],
    },
    {
      id: 'flashcard-015',
      front: 'What should be captured for a failed workflow step?',
      back: 'Stable step identity, attempt number, sanitized inputs, dependency response, timing, error classification, trace context, and recovery decision.',
      requirement_ids: ['req-004', 'req-006'],
    },
    {
      id: 'flashcard-016',
      front: 'How do contract tests help integrations?',
      back: 'They verify assumptions at the provider-consumer boundary and catch incompatible schema or behaviour changes before production.',
      requirement_ids: ['req-005'],
    },
    {
      id: 'flashcard-017',
      front: 'What is the purpose of a visibility timeout?',
      back: 'It temporarily hides claimed work and makes it available again when the worker does not acknowledge completion within the expected window.',
      requirement_ids: ['req-002'],
    },
    {
      id: 'flashcard-018',
      front: 'How should weak public interview signals be used?',
      back: 'Use them to suggest plausible topic areas, keep them separate from verified facts, and never present them as guaranteed interview questions.',
      requirement_ids: ['req-003'],
    },
    {
      id: 'flashcard-019',
      front: 'What makes human intervention effective in automation?',
      back: 'The person receives enough context, authority, and safe controls to resolve the case without guessing or corrupting durable workflow state.',
      requirement_ids: ['req-004'],
    },
    {
      id: 'flashcard-020',
      front: 'What should happen after a production incident?',
      back: 'Restore safety first, preserve evidence, identify contributing system conditions, assign durable actions, and verify that detection and recovery improve.',
      requirement_ids: ['req-006', 'req-007'],
    },
  ],
  schedule: {
    days_available: 5,
    days: [
      {
        day: 1,
        focus: 'Distributed systems and recovery',
        question_ids: ['question-002', 'question-006', 'question-013', 'question-014'],
        minutes: 90,
      },
      {
        day: 2,
        focus: 'TypeScript, APIs, and integration safety',
        question_ids: ['question-001', 'question-005', 'question-007', 'question-015'],
        minutes: 80,
      },
      {
        day: 3,
        focus: 'Observability and leadership evidence',
        question_ids: ['question-008', 'question-010', 'question-011', 'question-016'],
        minutes: 75,
      },
      {
        day: 4,
        focus: 'Workflow domain and company fit',
        question_ids: ['question-004', 'question-009', 'question-012', 'question-018'],
        minutes: 65,
      },
      {
        day: 5,
        focus: 'Mixed review and failure decisions',
        question_ids: ['question-003', 'question-017', 'question-002'],
        minutes: 50,
      },
    ],
  },
  coverage: { uncovered_requirement_ids: [], passes: 2 },
};

export const thinKit: Kit = {
  source: {
    company: 'Fieldnote',
    company_url: 'https://fieldnote.example',
    role: 'Software Engineer',
    location: '',
    jd_chars: 118,
    researched_at: researchedAt,
    pages_used: ['https://fieldnote.example'],
  },
  company_brief: {
    summary: 'Fieldnote publishes a small collaborative notes product.',
    what_they_do: 'Available public material supports only a high-level product description.',
    sources: ['https://fieldnote.example'],
  },
  role: {
    title: 'Software Engineer',
    seniority: 'Unspecified',
    responsibilities: ['Build product features.'],
    requirements: [
      {
        id: 'req-001',
        text: 'General software development experience',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'req-002',
        text: 'Collaborative working style',
        kind: 'behavioural',
        priority: 'nice',
      },
    ],
  },
  questions: [
    {
      id: 'question-001',
      requirement_ids: ['req-001'],
      category: 'technical',
      prompt: 'Walk through a feature you shipped and the tradeoffs you made.',
      answer_outline: 'Explain the user need, constraints, decision, implementation, and outcome.',
      difficulty: 1,
    },
  ],
  flashcards: [
    {
      id: 'flashcard-001',
      front: 'What makes a strong project walkthrough?',
      back: 'Context, constraints, your decisions, alternatives, and a concrete result.',
      requirement_ids: ['req-001'],
    },
  ],
  schedule: {
    days_available: 2,
    days: [
      { day: 1, focus: 'Project walkthrough', question_ids: ['question-001'], minutes: 25 },
      { day: 2, focus: 'Review and questions', question_ids: ['question-001'], minutes: 15 },
    ],
  },
  coverage: { uncovered_requirement_ids: ['req-002'], passes: 1 },
};

export const companyUnreachableKit: Kit = {
  ...thinKit,
  source: {
    ...thinKit.source,
    company: 'Orbit Systems',
    company_url: 'https://orbit.invalid',
    role: 'Backend Engineer',
    pages_used: [],
  },
  company_brief: {
    summary: 'No public company pages were available for Orbit Systems.',
    what_they_do: 'Company activities could not be verified from the available sources.',
    sources: [],
  },
  role: {
    ...thinKit.role,
    title: 'Backend Engineer',
  },
};

export const fixtureKitRecords: KitRecord[] = [
  {
    id: 'full-kit',
    input: {
      jobDescription: 'Senior Platform Engineer role with TypeScript and distributed systems.',
      companyUrl: richKit.source.company_url,
      daysAvailable: 5,
    },
    status: 'ready',
    progress: { stage: 'complete', percent: 100, message: 'Kit generation complete.' },
    kit: richKit,
    warnings: [],
    version: 4,
    createdAt: '2026-09-06T09:00:00.000Z',
    updatedAt: '2026-09-08T10:30:00.000Z',
    interviewDate: '2026-09-14T09:00:00.000Z',
  },
  {
    id: 'thin-kit',
    input: {
      jobDescription: 'Software engineer. Build features and work with the team.',
      companyUrl: thinKit.source.company_url,
      daysAvailable: 2,
    },
    status: 'ready',
    progress: { stage: 'complete', percent: 100, message: 'Kit generation complete.' },
    kit: thinKit,
    warnings: [
      {
        code: 'THIN_JOB_DESCRIPTION',
        message: 'The short job description supplied only a few role-specific signals.',
      },
    ],
    version: 2,
    createdAt: '2026-09-07T12:00:00.000Z',
    updatedAt: '2026-09-08T08:10:00.000Z',
    interviewDate: '2026-09-11T09:00:00.000Z',
  },
  {
    id: 'unreachable-kit',
    input: {
      jobDescription: 'Backend engineer with reliable API experience.',
      companyUrl: companyUnreachableKit.source.company_url,
      daysAvailable: 4,
    },
    status: 'ready',
    progress: { stage: 'complete', percent: 100, message: 'Kit generated with warnings.' },
    kit: companyUnreachableKit,
    warnings: [
      {
        code: 'COMPANY_UNREACHABLE',
        message: 'The company website could not be reached. The role sections remain usable.',
        sourceUrl: 'https://orbit.invalid',
      },
    ],
    version: 3,
    createdAt: '2026-09-05T15:20:00.000Z',
    updatedAt: '2026-09-08T07:45:00.000Z',
    interviewDate: '2026-09-16T09:00:00.000Z',
  },
];
