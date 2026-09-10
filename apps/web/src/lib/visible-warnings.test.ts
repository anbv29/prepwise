import { describe, expect, it } from 'vitest';

import { visibleWarnings } from './visible-warnings';

describe('visibleWarnings', () => {
  it('hides grounding quota notices but keeps actionable source warnings', () => {
    expect(
      visibleWarnings([
        { code: 'SEARCH_QUOTA_EXHAUSTED', message: 'Grounding quota is unavailable.' },
        { code: 'COMPANY_UNREACHABLE', message: 'The company site could not be reached.' },
      ]),
    ).toEqual([{ code: 'COMPANY_UNREACHABLE', message: 'The company site could not be reached.' }]);
  });
});
