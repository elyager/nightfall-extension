import { describe, expect, it } from 'vitest';
import { pagePath, repairsForPath } from '../utils/repairs';

describe('element repairs', () => {
  it('scopes fixes to the URL pathname and ignores query state', () => {
    expect(pagePath('https://example.com/pricing?plan=pro#faq')).toBe('/pricing');
    expect(pagePath('not a url')).toBe('/');
  });

  it('returns only fixes saved for the current page', () => {
    const repairs = [
      { selector: '#hero', path: '/' },
      { selector: '.price-card', path: '/pricing' },
    ];
    expect(repairsForPath(repairs, '/pricing')).toEqual([repairs[1]]);
  });
});
