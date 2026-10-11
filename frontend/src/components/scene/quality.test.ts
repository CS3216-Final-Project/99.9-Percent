import { describe, expect, it } from 'vitest';
import { GRAPHICS_QUALITIES } from '@/game/persist';
import { QUALITY_OPTIONS, resolveQuality } from './quality';

describe('Auto quality', () => {
  it('gives a graphics card the full HD finish', () => {
    const p = resolveQuality('auto', 'gpu');
    expect(p).toMatchObject({ detail: 'hd', effects: true, shadows: true, fps: null });
  });

  it('gives software rendering the lightest settings, as before', () => {
    expect(resolveQuality('auto', 'software')).toMatchObject({ detail: 'basic', effects: false, shadows: false, dpr: 0.5, fps: 20 });
  });

  it('stays basic until the renderer is known, even when HD is forced, so no HD textures download early', () => {
    expect(resolveQuality('auto', 'unknown').detail).toBe('basic');
    expect(resolveQuality('auto', 'unknown', 'hd').detail).toBe('basic');
    expect(resolveQuality('high', 'unknown').detail).toBe('basic');
  });
});

describe('chosen quality', () => {
  it('lowers the work per frame at every step down', () => {
    const [high, medium, low] = (['high', 'medium', 'low'] as const).map((q) => resolveQuality(q, 'gpu'));
    expect(high.effects && !medium.effects && !low.effects).toBe(true);
    expect(high.shadows && medium.shadows && !low.shadows).toBe(true);
    expect(high.detail).toBe('hd');
    expect(medium.detail).toBe('hd');
    expect(low.detail).toBe('basic');
    expect(high.shadowMapSize).toBeGreaterThan(medium.shadowMapSize);
    expect(low.dpr).toBeLessThan(1);
    expect(low.fps).toBe(30);
    expect(medium.fps).toBeNull();
  });

  it('applies the same way whatever draws the canvas, so a weak GPU can choose Low and a CPU can choose High', () => {
    for (const q of ['high', 'medium', 'low'] as const) expect(resolveQuality(q, 'software')).toEqual(resolveQuality(q, 'gpu'));
  });

  it('lets the address force a detail once the renderer is known, and effects follow HD only', () => {
    expect(resolveQuality('auto', 'software', 'hd')).toMatchObject({ detail: 'hd', effects: false });
    expect(resolveQuality('auto', 'gpu', 'basic')).toMatchObject({ detail: 'basic', effects: false });
    expect(resolveQuality('low', 'gpu', 'hd')).toMatchObject({ detail: 'hd', effects: false });
    expect(resolveQuality('high', 'gpu', 'hd')).toMatchObject({ detail: 'hd', effects: true });
  });

  it('does not change the shared profiles when a caller changes the result', () => {
    resolveQuality('high', 'gpu').shadowMapSize = 1;
    expect(resolveQuality('high', 'gpu').shadowMapSize).toBe(4096);
  });
});

describe('menu options', () => {
  it('describes every quality exactly once, Auto first', () => {
    expect(QUALITY_OPTIONS.map((o) => o.id)).toEqual([...GRAPHICS_QUALITIES]);
    for (const o of QUALITY_OPTIONS) expect(o.summary.length).toBeGreaterThan(10);
  });
});
