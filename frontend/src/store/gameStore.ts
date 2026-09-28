import { create } from 'zustand';
import type { Proficiency } from '../../../shared/common.ts';

interface GameState {
  language: string;
  level: Proficiency;
  setLanguage: (language: string) => void;
  setLevel: (level: Proficiency) => void;
}

export const useGameStore = create<GameState>((set) => ({
  language: 'ja-JP',
  level: 'beginner',
  setLanguage: (language) => set({ language }),
  setLevel: (level) => set({ level }),
}));
