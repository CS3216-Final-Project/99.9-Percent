import { describe, expect, it } from 'vitest';
import { applyDaylight, world } from './cityLight';
import { daylight } from './sky';

describe("the city's light", () => {
  it('tells the shadows whether colours are blended in linear light, and gives the horizon in the same space', () => {
    const noon = daylight(0.5);
    applyDaylight(noon, true);
    expect(world.uLinear.value).toBe(1);
    const linear = world.uHorizon.value.clone();
    applyDaylight(noon, false);
    expect(world.uLinear.value).toBe(0);
    // The same sky as a display colour has larger values than in linear light.
    expect(world.uHorizon.value.r).toBeGreaterThan(linear.r);
    expect(world.uHorizon.value.b).toBeGreaterThan(linear.b);
  });
});
