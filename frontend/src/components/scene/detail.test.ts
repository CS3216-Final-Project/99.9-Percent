import { describe, expect, it } from 'vitest';
import { chooseDetail, detailOverride } from './detail';

describe('detail level', () => {
  it('reads a forced level from the address and ignores anything else', () => {
    expect(detailOverride('?graphics=hd')).toBe('hd');
    expect(detailOverride('?seed=7&graphics=basic')).toBe('basic');
    expect(detailOverride('?graphics=ultra')).toBeNull();
    expect(detailOverride('')).toBeNull();
  });

  it('gives a GPU HD detail and software rendering the basic look', () => {
    expect(chooseDetail('gpu', null)).toBe('hd');
    expect(chooseDetail('software', null)).toBe('basic');
  });

  it('stays basic until the renderer is known, even when HD is forced', () => {
    expect(chooseDetail('unknown', null)).toBe('basic');
    expect(chooseDetail('unknown', 'hd')).toBe('basic');
  });

  it('lets the address override the renderer once it is known', () => {
    expect(chooseDetail('software', 'hd')).toBe('hd');
    expect(chooseDetail('gpu', 'basic')).toBe('basic');
  });
});
