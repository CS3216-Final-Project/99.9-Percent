import { describe, expect, it } from 'vitest';
import { detailOverride, perfHook } from './detail';

describe('detail level', () => {
  it('reads a forced level from the address and ignores anything else', () => {
    expect(detailOverride('?graphics=hd')).toBe('hd');
    expect(detailOverride('?seed=7&graphics=basic')).toBe('basic');
    expect(detailOverride('?graphics=ultra')).toBeNull();
    expect(detailOverride('')).toBeNull();
  });

  it('reads the performance probe flag from the address', () => {
    expect(perfHook('?perf=1')).toBe(true);
    expect(perfHook('?perf')).toBe(true);
    expect(perfHook('?graphics=hd')).toBe(false);
    expect(perfHook('')).toBe(false);
  });
});
