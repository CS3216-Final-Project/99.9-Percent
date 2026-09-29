import type { DialogueRequest, DialogueResponse } from '../../../shared/dialogue.ts';

// Stub so the frontend can build against the real API shape from day 1.
// Zi Yao replaces this with the OpenAI call (key read from process.env.OPENAI_API_KEY).
export async function replyAsNpc(req: DialogueRequest): Promise<DialogueResponse> {
  return {
    npcText: `(stub) You said: "${req.playerText}"`,
    completedObjectives: [],
    missionComplete: false,
  };
}
