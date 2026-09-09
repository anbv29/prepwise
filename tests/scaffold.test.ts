import { describe, expect, it } from 'vitest';

import { KIT_SCHEMA_VERSION } from '../packages/contracts/src/index.js';

describe('workspace scaffold', () => {
  it('exposes the initial kit schema version', () => {
    expect(KIT_SCHEMA_VERSION).toBe('1.0');
  });
});
