import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGame } from '@/game/store';
import { sendFeedback } from '@/lib/feedback';
import { FeedbackButton } from './FeedbackButton';

vi.mock('@/lib/feedback', () => ({ sendFeedback: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  vi.mocked(sendFeedback).mockReset();
});
afterEach(cleanup);

it('sends only on explicit submission and keeps the company unchanged', async () => {
  vi.mocked(sendFeedback).mockResolvedValue({ id: 'confirmed' });
  const game = useGame.getState().game;
  render(<StrictMode><FeedbackButton /></StrictMode>);
  fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }));
  expect(sendFeedback).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Your feedback' }), { target: { value: '  Helpful evidence  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect((await screen.findByRole('status')).textContent).toContain('saved');
  expect(sendFeedback).toHaveBeenCalledTimes(1);
  expect(sendFeedback).toHaveBeenCalledWith(expect.objectContaining({ message: 'Helpful evidence', mode: 'campaign' }), expect.any(AbortSignal));
  expect(useGame.getState().game).toBe(game);
  expect(useGame.getState().started).toBe(false);
});

it('retains failed text and retries with the same submission ID', async () => {
  vi.mocked(sendFeedback).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'confirmed' });
  render(<FeedbackButton inline />);
  fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Please explain routing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await screen.findByRole('alert');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Please explain routing');
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await screen.findByRole('status');
  expect(vi.mocked(sendFeedback).mock.calls[0][0].id).toBe(vi.mocked(sendFeedback).mock.calls[1][0].id);
});

it('aborts a pending request when the form is unmounted', async () => {
  vi.mocked(sendFeedback).mockImplementation(() => new Promise(() => {}));
  const view = render(<FeedbackButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Feedback' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  await waitFor(() => expect(sendFeedback).toHaveBeenCalledOnce());
  const signal = vi.mocked(sendFeedback).mock.calls[0][1];
  view.unmount();
  expect(signal.aborted).toBe(true);
});
