import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOverheard, onOverheard, overhear, type Overheard } from './overheard';

describe('overheard', () => {
  beforeEach(clearOverheard);

  it('publishes the first group in earshot, only when the line actually changes', () => {
    const listener = vi.fn();
    const stop = onOverheard(listener);
    const line: Overheard = { speaker: 'frontdesk', line: 'Coffee run?', alarmed: false };
    overhear('catch-up by reception', line);
    expect(listener).toHaveBeenLastCalledWith(line);
    // The same words again do not nag the page.
    overhear('catch-up by reception', { ...line });
    expect(listener).toHaveBeenCalledTimes(1);
    overhear('catch-up by reception', { ...line, line: "Pizza's here!" });
    expect(listener).toHaveBeenLastCalledWith({ ...line, line: "Pizza's here!" });
    stop();
  });

  it('publishes the same words again when someone else says them', () => {
    const listener = vi.fn();
    onOverheard(listener);
    overhear('catch-up by reception', { speaker: 'frontdesk', line: 'Coffee run?', alarmed: false });
    overhear('catch-up by reception', { speaker: 'marketer', line: 'Coffee run?', alarmed: false });
    expect(listener).toHaveBeenLastCalledWith({ speaker: 'marketer', line: 'Coffee run?', alarmed: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('drops to nothing when the group goes quiet', () => {
    const listener = vi.fn();
    onOverheard(listener);
    overhear('catch-up by reception', { speaker: 'frontdesk', line: 'Coffee run?', alarmed: false });
    overhear('catch-up by reception', null);
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('empties everything and says so once', () => {
    const listener = vi.fn();
    onOverheard(listener);
    overhear('catch-up by reception', { speaker: 'frontdesk', line: 'Coffee run?', alarmed: false });
    clearOverheard();
    expect(listener).toHaveBeenLastCalledWith(null);
    const calls = listener.mock.calls.length;
    clearOverheard();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});
