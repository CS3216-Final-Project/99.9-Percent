// Dialogue API contract (Zi Yao -> Qi Jun).
// POST /api/dialogue
// Change this file only with agreement from both sides.

import type { Proficiency } from './common.ts';

export interface DialogueRequest {
  sessionId: string;
  missionId: string;
  npcId: string;
  language: string; // BCP-47 tag, e.g. "ja-JP", "zh-CN"
  level: Proficiency;
  /** What the player said, as text from speech-to-text. */
  playerText: string;
}

export interface DialogueResponse {
  npcText: string;
  /** URL or data URL of the NPC's voice. Empty until text-to-speech is wired in. */
  npcAudioUrl?: string;
  /** Checklist items from the mission that this turn completed. */
  completedObjectives: string[];
  missionComplete: boolean;
}
