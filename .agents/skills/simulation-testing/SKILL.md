---
name: simulation-testing
description: Change or test the 99.99% simulation, incident recovery, seeded replay, economics or technology balance. Use for rules in frontend/src/sim and deterministic regressions; browser UI and API tasks use their own skills.
---

# Simulation changes

1. Read the affected engine function, its types and the relevant existing cases in `frontend/src/sim/__tests__/sim.test.ts`. Trace the public entry points in `index.ts` before introducing another path.
2. Build the smallest realistic state with `newGame(seed)` and public actions. Explicit fixture overrides are appropriate for a specific boundary such as overload, but document why they represent the scenario. Assert the incident type or phase so a fixture cannot silently test the wrong branch.
3. Test the result a player depends on: cost, capacity, permitted action, phase transition, damage or report. Include a rejected or wrong action where relevant. Check source state immutability when changing mutation logic. Avoid assertions that just repeat a constant.
4. Preserve seeded RNG state and JSON replay. For clock or recovery changes, compare continuation after serialization with uninterrupted continuation. Keep time and random inputs explicit.
5. Run the focused case, then `npm test` in `frontend/`. Run `npm run balance` when economics, prerequisites, capacity, hazards or recovery outcomes change. Review each scripted player's results across the seed set; do not loosen assertions merely to make a new balance pass.

Balance bots are regression evidence, not proof that the game is fun or every seed is winnable. Record intentional tradeoffs and use a browser playthrough for a changed player decision. Tests for browser storage and the Zustand lifecycle belong beside `frontend/src/game/`; keep those dependencies out of engine tests.
