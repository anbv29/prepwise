import { describe, expect, it } from 'vitest';

import { readResearchConfig, ResearchConfigError } from './config.js';

describe('research configuration', () => {
  it('defaults to bounded public-network-only research', () => {
    expect(readResearchConfig({})).toMatchObject({
      allowPrivateNetworks: false,
      maxPages: 5,
      maxRedirects: 3,
      maxResponseBytes: 1_000_000,
      maxTextCharsPerPage: 25_000,
      requestTimeoutMs: 10_000,
    });
  });

  it('never allows the private-network escape hatch in production', () => {
    expect(() =>
      readResearchConfig({ NODE_ENV: 'production', ALLOW_PRIVATE_NETWORKS: 'true' }),
    ).toThrow(ResearchConfigError);
  });

  it('rejects invalid bounds and boolean values', () => {
    expect(() => readResearchConfig({ RESEARCH_MAX_PAGES: '50' })).toThrow(ResearchConfigError);
    expect(() => readResearchConfig({ ALLOW_PRIVATE_NETWORKS: 'yes' })).toThrow(
      ResearchConfigError,
    );
  });
});
