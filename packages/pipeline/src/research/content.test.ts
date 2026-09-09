import { describe, expect, it } from 'vitest';

import { extractPageContent } from './content.js';

describe('extractPageContent', () => {
  it('extracts title, safe text, and links without executable or navigational content', () => {
    const result = extractPageContent(
      `<!doctype html><html><head><title> Example Careers </title><style>.x{}</style></head>
       <body><nav>Navigation noise</nav><h1>Build reliable systems</h1>
       <a href="/about"> About our team </a><script>alert('do not keep')</script></body></html>`,
      'text/html',
      1_000,
    );

    expect(result.title).toBe('Example Careers');
    expect(result.text).toBe('Build reliable systems About our team');
    expect(result.text).not.toContain('alert');
    expect(result.text).not.toContain('Navigation');
    expect(result.links).toEqual([{ href: '/about', text: 'About our team' }]);
    expect(result.truncated).toBe(false);
  });

  it('normalizes and truncates plain text deterministically', () => {
    expect(extractPageContent('A\n\n B   C', 'text/plain', 5)).toEqual({
      links: [],
      text: 'A B C',
      title: '',
      truncated: false,
    });
    expect(extractPageContent('123456', 'text/plain', 5).truncated).toBe(true);
  });
});
