import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ROLES, ALL_SPECIES, CLIPS, creature, motionFor, SPECIES, standsAtDesk, type Activity, type Kind } from './cast';

const ACTIVITIES: Activity[] = ['type', 'relax', 'mug', 'laptop', 'idle', 'chat', 'walk', 'listen', 'present', 'panic', 'play'];

/** The animation names inside a GLB file, without the armature prefix. */
function clipsInFile(file: string): string[] {
  // Tests run from the frontend package.
  const path = resolve(process.cwd(), 'public/models/creatures', `${file}.glb`);
  const glb = readFileSync(path);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as { animations?: { name: string }[] };
  return (json.animations ?? []).map((a) => a.name.replace(/^CharacterArmature\|/, ''));
}

describe('the crew', () => {
  it('gives the same number the same species', () => {
    expect(creature(7)).toBe(creature(7));
    expect(creature(12, 'sre')).toBe('yeti');
  });

  it('casts every role with a known species', () => {
    for (const role of ALL_ROLES) for (let n = 0; n < 12; n++) expect(ALL_SPECIES).toContain(creature(n, role));
  });

  it('puts different species at neighbouring desks', () => {
    const desks = new Set(Array.from({ length: 8 }, (_, i) => creature(i)));
    expect(desks.size).toBeGreaterThanOrEqual(6);
  });
});

describe('animations', () => {
  it.each(Object.keys(CLIPS) as Kind[])('asks a %s only for clips its body plan has', (kind) => {
    for (const activity of ACTIVITIES) {
      const m = motionFor(kind, activity);
      expect(CLIPS[kind]).toContain(m.clip);
      expect(m.speed).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SPECIES)('finds every clip %s needs in its model file', (species) => {
    const { file, kind } = SPECIES[species];
    const inFile = clipsInFile(file);
    for (const activity of ACTIVITIES) expect(inFile).toContain(motionFor(kind, activity).clip);
  });

  it('walks walkers and keeps flyers in the air', () => {
    expect(motionFor('blob', 'walk').clip).toBe('Walk');
    expect(motionFor('flyer', 'walk').clip).toBe('Fast_Flying');
    expect(motionFor('flyer', 'type').clip).toBe('Flying_Idle');
  });
});

describe('standing desks', () => {
  it('stands exactly the big species at their desks, and seats everyone else', () => {
    for (const s of ALL_SPECIES) expect(standsAtDesk(s), s).toBe(SPECIES[s].kind === 'big');
    expect(standsAtDesk('yeti')).toBe(true);
    expect(standsAtDesk('cat')).toBe(false);
  });
});
