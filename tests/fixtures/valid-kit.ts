import type { Kit } from '@prep-kit/contracts';

export function createValidKit(): Kit {
  return {
    source: {
      company: 'Example Labs',
      company_url: 'https://example.com',
      role: 'Senior Software Engineer',
      location: 'Remote',
      jd_chars: 1280,
      researched_at: '2026-09-08T10:30:00.000Z',
      pages_used: ['https://example.com/about', 'https://example.com/careers'],
    },
    company_brief: {
      summary: 'Example Labs builds developer tooling.',
      what_they_do: 'They help teams operate software reliably.',
      sources: ['https://example.com/about'],
    },
    role: {
      title: 'Senior Software Engineer',
      seniority: 'senior',
      responsibilities: ['Design reliable services', 'Mentor engineers'],
      requirements: [
        {
          id: 'r1',
          text: 'Build services with TypeScript',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r2',
          text: 'Mentor junior engineers',
          kind: 'behavioural',
          priority: 'nice',
        },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How would you design a reliable TypeScript service?',
        answer_outline: 'Discuss boundaries, validation, observability, and failure recovery.',
        difficulty: 3,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'behavioural',
        prompt: 'Tell me about a time you mentored another engineer.',
        answer_outline: 'Use a specific situation, action, and measurable result.',
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What makes a service observable?',
        back: 'Useful logs, metrics, traces, alerts, and actionable context.',
        requirement_ids: ['r1'],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        {
          day: 1,
          focus: 'Technical foundations',
          question_ids: ['q1'],
          minutes: 60,
        },
        {
          day: 2,
          focus: 'Behavioural preparation',
          question_ids: ['q2'],
          minutes: 45,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 2,
    },
  };
}
