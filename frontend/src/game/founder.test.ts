import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advanceTurn, newLegacyGame as newGame, type Action } from '../sim';
import { clockLive, newJob, stationFor, useFounder, workOn } from './founder';
import { saveMode } from './persist';
import { inspectOrSelect, useGame } from './store';

describe('which machine an action is done at', () => {
  const game = newGame();
  it.each<[Action, string | null]>([
    [{ type: 'add_server' }, 'app'],
    [{ type: 'remove_server' }, 'app'],
    [{ type: 'replace_host', hostId: game.infra.appHosts[0].id }, 'app'],
    [{ type: 'replace_host', hostId: game.infra.dbHost.id }, 'db'],
    [{ type: 'start_db_upgrade' }, 'db'],
    [{ type: 'set_traffic_limit', enabled: true }, 'gateway'],
    [{ type: 'launch_promotion', promo: 'social' }, 'growth'],
    [{ type: 'hire_engineer' }, 'team'],
    [{ type: 'start_debt_paydown' }, 'team'],
    [{ type: 'deploy_release', releaseId: 'r1' }, 'deploy'],
    [{ type: 'test_release', releaseId: 'r1' }, 'deploy'],
    [{ type: 'incident_inspect', equipment: 'monitoring' }, 'monitoring'],
    [{ type: 'incident_action', recovery: 'rollback' }, 'deploy'],
    [{ type: 'incident_action', recovery: 'failover' }, 'db'],
    [{ type: 'incident_action', recovery: 'rate_limit' }, 'gateway'],
    [{ type: 'start_tech', tech: 'caching' }, null],
    [{ type: 'assign_engineers', taskId: 't1', count: 1 }, null],
    [{ type: 'incident_hint' }, null],
    [{ type: 'acknowledge_review' }, null],
  ])('%j is done at %s', (action, station) => {
    expect(stationFor(action, game)).toBe(station);
  });
});

describe('working a machine', () => {
  const job = newJob({ type: 'add_server' }, 'app');

  it('adds up work only at the machine and while the clock runs', () => {
    expect(workOn(job, { inReach: false, live: true, dt: 1 })).toBe(job);
    expect(workOn(job, { inReach: true, live: false, dt: 1 })).toBe(job);
    const half = workOn(job, { inReach: true, live: true, dt: job.total / 2 });
    expect(half).not.toBe('finished');
    expect(half !== 'finished' && half.done).toBeCloseTo(job.total / 2);
  });

  it('keeps the work done when the founder steps away, and finishes it on return', () => {
    let j = workOn(job, { inReach: true, live: true, dt: job.total - 0.5 });
    if (j === 'finished') throw new Error('finished early');
    j = workOn(j, { inReach: false, live: true, dt: 10 });
    if (j === 'finished') throw new Error('finished away from the machine');
    expect(workOn(j, { inReach: true, live: true, dt: 0.5 })).toBe('finished');
  });

  it('lands an inspection the moment the founder arrives', () => {
    expect(workOn(newJob({ type: 'incident_inspect', equipment: 'db' }, 'db'), { inReach: true, live: true, dt: 0 })).toBe('finished');
  });

  it('counts time while planning, and during an incident only while the crisis clock runs', () => {
    const planning = newGame();
    expect(clockLive(planning, false)).toBe(true);
    const incident = advanceTurn({ ...newGame(1), users: 4500 });
    expect(incident.phase).toBe('incident');
    expect(clockLive(incident, true)).toBe(true);
    expect(clockLive(incident, false)).toBe(false);
  });
});

describe('perform', () => {
  beforeEach(() => {
    localStorage.clear();
    saveMode('classic');
    useGame.setState(useGame.getInitialState(), true);
    useFounder.setState(useFounder.getInitialState(), true);
    useGame.getState().boot();
  });
  afterEach(() => localStorage.clear());

  it('acts at once when there is no founder on the floor', () => {
    expect(useGame.getState().perform({ type: 'add_server' })).toBe(true);
    expect(useGame.getState().game.infra.appHosts).toHaveLength(2);
    expect(useFounder.getState().job).toBeNull();
  });

  it('sends the founder to the machine and waits for the work before acting', () => {
    useFounder.getState().setPresent(true);
    const before = useGame.getState().game;
    expect(useGame.getState().perform({ type: 'add_server' })).toBe(true);
    expect(useGame.getState().game).toBe(before);
    expect(useGame.getState().selected).toBe('app');
    const { job, goal } = useFounder.getState();
    expect(job?.action).toEqual({ type: 'add_server' });
    expect(goal).toEqual({ station: 'app' });
  });

  it('refuses at once, without walking, what the game would refuse', () => {
    useFounder.getState().setPresent(true);
    useGame.setState({ game: { ...useGame.getState().game, cash: 0 } });
    expect(useGame.getState().perform({ type: 'add_server' })).toBe(false);
    expect(useGame.getState().toast?.kind).toBe('error');
    expect(useFounder.getState().job).toBeNull();
    expect(useFounder.getState().goal).toBeNull();
  });

  it('drops the job in hand for a new one, and says so', () => {
    useFounder.getState().setPresent(true);
    useGame.getState().perform({ type: 'add_server' });
    useGame.getState().perform({ type: 'hire_engineer' });
    expect(useFounder.getState().job?.station).toBe('team');
    expect(useGame.getState().toast?.text).toMatch(/Dropped: adding a server/);
  });

  it('makes decisions away from the machines at once', () => {
    useFounder.getState().setPresent(true);
    expect(useGame.getState().perform({ type: 'start_tech', tech: 'larger_servers' })).toBe(true);
    expect(useFounder.getState().job).toBeNull();
    expect(useGame.getState().game.tasks.some((t) => t.techId === 'larger_servers')).toBe(true);
  });

  it('walks to a clicked machine', () => {
    useFounder.getState().setPresent(true);
    inspectOrSelect('growth');
    expect(useGame.getState().selected).toBe('growth');
    expect(useFounder.getState().goal).toEqual({ station: 'growth' });
    expect(useFounder.getState().job).toBeNull();
  });
});
