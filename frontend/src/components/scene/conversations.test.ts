import { describe, expect, it } from 'vitest';
import { GROUPS, INCIDENT_LINES, MAX_LINE, memberRotation, SPEAKING, TURN_SECONDS, turnAt } from './conversations';
import { CLOSED_ROOMS, OBSTACLES } from './floorplan';
import { ROOM } from './layout';
import { heading, wrapAngle } from './routes';

/** How much room a member takes up, from their centre. */
const MEMBER_RADIUS = 0.3;

function clearance(x: number, z: number): number {
  return Math.min(
    ...OBSTACLES.map((o) => {
      if ('disc' in o) return Math.hypot(x - o.disc[0], z - o.disc[1]) - o.disc[2];
      const [x0, z0, x1, z1] = o.box;
      return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
    }),
  );
}

describe('office conversations', () => {
  it('stands every group in the open, each member facing the middle', () => {
    for (const g of GROUPS) {
      g.members.forEach((m, i) => {
        expect(clearance(m.x, m.z), `${g.name} member ${i}`).toBeGreaterThanOrEqual(MEMBER_RADIUS);
        expect(m.x).toBeGreaterThan(ROOM.x0 + 0.5);
        expect(m.x).toBeLessThan(ROOM.x1 - 0.5);
        expect(m.z).toBeGreaterThan(ROOM.z0 + 0.5);
        expect(m.z).toBeLessThan(ROOM.z1 - 0.5);
        for (const [x0, z0, x1, z1] of CLOSED_ROOMS) expect(m.x >= x0 && m.x <= x1 && m.z >= z0 && m.z <= z1, `${g.name} member ${i} is in a closed room`).toBe(false);
        expect(wrapAngle(memberRotation(g, i) - heading(g.centre[0] - m.x, g.centre[1] - m.z))).toBeCloseTo(0);
      });
      // Nobody stands inside anyone else.
      for (let i = 0; i < g.members.length; i++)
        for (let j = i + 1; j < g.members.length; j++) expect(Math.hypot(g.members[i].x - g.members[j].x, g.members[i].z - g.members[j].z)).toBeGreaterThan(0.9);
    }
  });

  it('keeps every line short enough for a bubble, in plain text', () => {
    for (const line of [...GROUPS.flatMap((g) => g.lines), ...INCIDENT_LINES]) {
      expect(line.length, line).toBeLessThanOrEqual(MAX_LINE);
      expect(line, line).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it('passes the word round the group, a fresh line each turn, with a pause between speakers', () => {
    for (const g of GROUPS) {
      const turns = Array.from({ length: 12 }, (_, k) => turnAt(g, k * TURN_SECONDS + 0.1 - g.offset, false));
      expect(new Set(turns.map((t) => t.speaker))).toEqual(new Set(g.members.map((_, i) => i)));
      for (let k = 1; k < turns.length; k++) {
        expect(turns[k].speaker).not.toBe(turns[k - 1].speaker);
        expect(turns[k].line).not.toBe(turns[k - 1].line);
      }
      expect(turnAt(g, (SPEAKING + 0.1) * TURN_SECONDS - g.offset, false).line).toBeNull();
    }
  });

  it('gets round to every line it knows', () => {
    for (const g of GROUPS) {
      const said = new Set(Array.from({ length: g.lines.length }, (_, k) => turnAt(g, k * TURN_SECONDS + 0.1 - g.offset, false).line));
      expect(said.size).toBe(g.lines.length);
    }
  });

  it('talks about the outage during an incident, and says the same thing at the same time', () => {
    const g = GROUPS[0];
    const line = turnAt(g, 10, true).line;
    expect(INCIDENT_LINES).toContain(line);
    expect(g.lines).not.toContain(line);
    expect(turnAt(g, 10, true)).toEqual(turnAt(g, 10, true));
  });
});
