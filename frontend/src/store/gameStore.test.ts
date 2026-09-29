import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore.ts';

const initial = useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(initial, true);
});

describe('gameStore', () => {
  it('starts with Japanese at beginner level', () => {
    const { language, level } = useGameStore.getState();
    expect(language).toBe('ja-JP');
    expect(level).toBe('beginner');
  });

  it('updates the language and level', () => {
    useGameStore.getState().setLanguage('zh-CN');
    useGameStore.getState().setLevel('advanced');

    const { language, level } = useGameStore.getState();
    expect(language).toBe('zh-CN');
    expect(level).toBe('advanced');
  });
});
