import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_META, loadGame, saveGame, saveMeta } from './game/persist';
import { useGame } from './game/store';
import { advanceTurn, BALANCE, newGame } from './sim';

// Exercise the real game shell and store; jsdom cannot render WebGL.
vi.mock('./components/scene/Facility', () => ({ default: () => <div data-testid="facility" /> }));

beforeEach(() => {
  localStorage.clear();
  // jsdom has no layout scrolling; the browser suite exercises the real API.
  HTMLElement.prototype.scrollTo = vi.fn();
  useGame.setState(useGame.getInitialState(), true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('prototype game in the Vite app', () => {
  it('boots once under StrictMode and starts the first-run tutorial', async () => {
    render(<StrictMode><App /></StrictMode>);

    expect(screen.getByRole('heading', { name: '99.99%' })).toBeTruthy();
    expect(await screen.findByTestId('facility')).toBeTruthy();
    expect(useGame.getState().meta.runsStarted).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('dialog', { name: /Tutorial, step 1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGame.getState().meta.tutorialDone).toBe(true);
  });

  it('advances weeks and saves progress without a backend connection', () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(useGame.getState().game.turn).toBe(2);
    const saved = loadGame();
    expect(saved.status).toBe('ok');
    if (saved.status === 'ok') expect(saved.game.turn).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Tech' }));
    expect(screen.getByRole('region', { name: 'Tech tree' })).toBeTruthy();
  });

  it('resumes an existing save instead of starting over', () => {
    const game = advanceTurn(newGame(BALANCE.introSeed));
    saveGame(game);
    saveMeta({ ...DEFAULT_META, tutorialDone: true, runsStarted: 1 });
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue week 2' }));
    expect(useGame.getState().game).toEqual(game);
    expect(useGame.getState().meta.runsStarted).toBe(1);
  });

  it('shows the documented tree and routes its database decision through the real store', () => {
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tech' }));
    const tree = screen.getByRole('region', { name: 'Tech tree' });
    expect(tree.querySelectorAll('.node')).toHaveLength(9);
    expect(within(tree).queryByRole('button', { name: /Monitoring:/ })).toBeNull();
    expect(within(tree).queryByRole('button', { name: /Database Replica:/ })).toBeNull();
    fireEvent.click(within(tree).getByRole('button', { name: 'Larger Database: Available' }));
    fireEvent.click(within(tree).getByRole('button', { name: /^Upgrade to Standard/ }));
    expect(useGame.getState().game.tasks[0].kind).toBe('db_upgrade');
    expect(useGame.getState().game.infra.dbTier).toBe(0);
    expect(within(tree).getByRole('button', { name: 'Larger Database: Building' })).toBeTruthy();
  });

  it('schedules one management turn under StrictMode and cancels it when a view opens', () => {
    vi.useFakeTimers();
    saveMeta({ ...DEFAULT_META, tutorialDone: true });
    render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-advance weeks' }));
    act(() => vi.advanceTimersByTime(6000));
    expect(useGame.getState().game.turn).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Tech' }));
    act(() => vi.advanceTimersByTime(12000));
    expect(useGame.getState().game.turn).toBe(3);
    expect(useGame.getState().running).toBe(false);
  });

  it('runs the incident clock only while playing and cleans up on unmount', () => {
    vi.useFakeTimers();
    const game = advanceTurn({ ...newGame(1), users: 4500 });
    saveGame(game);
    saveMeta({ ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true });
    const view = render(<StrictMode><App /></StrictMode>);
    act(() => vi.advanceTimersByTime(2000));
    expect(useGame.getState().game).toEqual(game);
    fireEvent.click(screen.getByRole('button', { name: 'Continue week 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume the incident clock' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(useGame.getState().game.incident?.elapsed).toBeCloseTo(1);
    fireEvent.keyDown(window, { key: 'p' });
    act(() => vi.advanceTimersByTime(1000));
    expect(useGame.getState().game.incident?.elapsed).toBeCloseTo(1);
    fireEvent.keyDown(window, { key: 'p' });
    view.unmount();
    const stopped = useGame.getState().game;
    vi.advanceTimersByTime(2000);
    fireEvent.keyDown(window, { key: 'p' });
    expect(useGame.getState().game).toBe(stopped);
    expect(useGame.getState().running).toBe(true); // The removed keyboard listener cannot toggle it.
  });
});
