import { describe, expect, it } from 'vitest';
import { detailOverride } from './detail';

describe('detail level', () => {
  it('reads a forced level from the address and ignores anything else', () => {
    expect(detailOverride('?graphics=hd')).toBe('hd');
    expect(detailOverride('?seed=7&graphics=basic')).toBe('basic');
    expect(detailOverride('?graphics=ultra')).toBeNull();
    expect(detailOverride('')).toBeNull();
  });
});
