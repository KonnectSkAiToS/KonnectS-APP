import { describe, it, expect, vi } from 'vitest';
import { clip, toNumber, rateLimit, requireAuth } from '../../server/security';

function mockRes() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as any };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

describe('server security helpers', () => {
  it('clip bounds length and strips control characters', () => {
    expect(clip('a'.repeat(1000), 10)).toHaveLength(10);
    expect(clip('hi\u0000\u0007there')).toBe('hithere');
    expect(clip(undefined)).toBe('');
  });

  it('toNumber clamps and falls back for junk input', () => {
    expect(toNumber('abc', 100, 0, 10000)).toBe(100);
    expect(toNumber(-5, 100, 0, 10000)).toBe(0);
    expect(toNumber(99999999, 100, 0, 10000)).toBe(10000);
    expect(toNumber('42.5', 0, 0, 100)).toBe(42.5);
    expect(toNumber(Infinity, 7, 0, 100)).toBe(7);
  });

  it('rateLimit blocks after the limit and keeps users separate', () => {
    const limiter = rateLimit({ name: 'test', windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const run = (uid: string) => { const res = mockRes(); limiter({ uid } as any, res, next); return res; };

    run('alice'); run('alice');
    const blocked = run('alice');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();

    const other = run('bob');
    expect(other.statusCode).toBe(200);
  });

  it('requireAuth rejects requests without a bearer token', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth({ headers: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth rejects a malformed Authorization header', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAuth({ headers: { authorization: 'Basic abc' } } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
