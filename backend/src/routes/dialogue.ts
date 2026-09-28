import { Router } from 'express';
import type { DialogueRequest, DialogueResponse } from '../../../shared/dialogue.ts';
import { replyAsNpc } from '../ai/npc.js';

export const dialogueRouter = Router();

dialogueRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Partial<DialogueRequest>;
    if (!body.playerText || !body.npcId || !body.missionId) {
      res.status(400).json({ error: 'playerText, npcId and missionId are required' });
      return;
    }
    const reply: DialogueResponse = await replyAsNpc(body as DialogueRequest);
    res.json(reply);
  } catch (err) {
    next(err);
  }
});
