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
      'Northstar Labs builds workflow infrastructure for operations teams that need reliable, auditable automation across fragmented systems.',
    what_they_do:
      'The platform connects operational data, orchestrates multi-step workflows, and gives teams visibility into failures and manual intervention points.',
    sources: ['https://northstar.example/about', 'https://northstar.example/engineering'],
  },
  role: {
    title: 'Senior Platform Engineer',
    seniority: 'Senior individual contributor',
    responsibilities: [
      'Design and operate reliable TypeScript services.',
      'Lead system-design decisions across platform teams.',
      'Partner with product and support on ambiguous customer problems.',
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
  ],
  schedule: {
    days_available: 5,
    days: [
      { day: 1, focus: 'System design foundations', question_ids: ['question-002'], minutes: 45 },
      { day: 2, focus: 'Technical depth', question_ids: ['question-001'], minutes: 35 },
      { day: 3, focus: 'Behavioural evidence', question_ids: ['question-003'], minutes: 30 },
      { day: 4, focus: 'Company fit', question_ids: ['question-004'], minutes: 25 },
      { day: 5, focus: 'Mixed review', question_ids: ['question-002'], minutes: 20 },
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
