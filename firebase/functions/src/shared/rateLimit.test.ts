import { describe, expect, it } from 'vitest';
import { applyRequest } from './rateLimit';

describe('applyRequest', () => {
  it('opens a new window on the first request', () => {
    expect(applyRequest(null, 5000, 2, 1000)).toEqual({ allowed: true, next: { count: 1, windowStart: 5000 } });
  });

  it('counts requests within the window and refuses past the limit', () => {
    const second = applyRequest({ count: 1, windowStart: 5000 }, 5500, 2, 1000);
    expect(second).toEqual({ allowed: true, next: { count: 2, windowStart: 5000 } });
    expect(applyRequest(second.next, 5600, 2, 1000).allowed).toBe(false);
  });

  it('resets once the window has passed', () => {
    expect(applyRequest({ count: 2, windowStart: 5000 }, 6001, 2, 1000))
      .toEqual({ allowed: true, next: { count: 1, windowStart: 6001 } });
  });
});
