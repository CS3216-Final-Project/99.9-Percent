import { describe, expect, it } from 'vitest';
import { buildBody, faceZ } from './body';
import { ALL_ROLES, look } from './cast';

/** Vertices one person may cost, so a crowd stays cheap to draw without a GPU. */
const VERTEX_BUDGET = 7000;

const vertices = (b: ReturnType<typeof buildBody>) => Object.values(b).reduce((n, g) => n + g.attributes.position.count, 0);

describe('the cast', () => {
  it('gives the same number the same person', () => {
    expect(look(7)).toEqual(look(7));
    expect(look(7, 'pm')).toEqual(look(7, 'pm'));
  });

  it('dresses every role in a silhouette of its own', () => {
    const silhouette = (n: number) => ALL_ROLES.map((role) => {
      const l = look(n, role);
      return [l.topStyle, l.hat ?? '', l.bag ?? '', l.headset ?? '', l.bottom].join('|');
    });
    for (const n of [0, 1, 2, 3]) expect(new Set(silhouette(n)).size).toBe(ALL_ROLES.length);
  });

  it('mixes roles among neighbouring desks', () => {
    const roles = new Set(Array.from({ length: 8 }, (_, i) => look(i).role));
    expect(roles.size).toBeGreaterThanOrEqual(6);
  });
});

describe('bodies', () => {
  it.each(ALL_ROLES)('builds every %s variant within the vertex budget', (role) => {
    for (let n = 0; n < 8; n++) {
      for (const seated of [false, true]) {
        const body = buildBody(look(n, role), seated);
        for (const part of Object.values(body)) {
          expect(part.attributes.color.count).toBe(part.attributes.position.count);
          part.computeBoundingBox();
          expect(Number.isFinite(part.boundingBox!.max.y)).toBe(true);
        }
        expect(vertices(body)).toBeLessThan(VERTEX_BUDGET);
      }
    }
  });

  it('hangs a backpack on the chair when sitting down', () => {
    const intern = look(1, 'intern');
    expect(intern.bag).toBe('backpack');
    const standing = buildBody(intern).torso;
    const seated = buildBody(intern, true).torso;
    standing.computeBoundingBox();
    seated.computeBoundingBox();
    expect(seated.attributes.position.count).toBeLessThan(standing.attributes.position.count);
    // Nothing sticks out behind a seated person's back.
    expect(seated.boundingBox!.max.z).toBeLessThan(standing.boundingBox!.max.z - 0.1);
  });

  it('keeps the face in front of the head and centred', () => {
    expect(faceZ(0, 0.145)).toBeLessThan(-0.1);
    expect(faceZ(0.04, 0.145)).toBeCloseTo(faceZ(-0.04, 0.145));
    expect(faceZ(0.2, 0.145)).toBe(0);
  });
});
