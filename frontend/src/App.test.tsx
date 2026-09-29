import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import { getHealth } from './lib/api.ts';

// The 3D scene needs WebGL, which jsdom doesn't have.
vi.mock('./scene/World.tsx', () => ({ World: () => null }));
vi.mock('./lib/api.ts', () => ({ getHealth: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(getHealth).mockReset();
});

describe('App HUD', () => {
  it('shows the language, level and API status', async () => {
    vi.mocked(getHealth).mockResolvedValue({ status: 'ok', time: '2026-01-01T00:00:00Z' });
    render(<App />);

    expect(screen.getByText('ja-JP · beginner')).toBeTruthy();
    expect(await screen.findByText('API: ok (2026-01-01T00:00:00Z)')).toBeTruthy();
  });

  it('shows the API as offline when the health check fails', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('API returned 503'));
    render(<App />);

    expect(await screen.findByText('API: offline: API returned 503')).toBeTruthy();
  });
});
