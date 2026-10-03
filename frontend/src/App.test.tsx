import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_META, loadGame, saveGame, saveMeta } from './game/persist';
import { useGame } from './game/store';
import { advanceTurn, BALANCE, newGame } from './sim';

// Exercise the real game shell and store; jsdom cannot render WebGL.
vi.mock('./components/scene/Facility', () => ({ default: () => <div data-testid="facility" /> }));

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
});

afterEach(() => {
  cleanup();
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
});
