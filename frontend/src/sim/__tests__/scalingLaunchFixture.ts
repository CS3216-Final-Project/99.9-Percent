import { newGame, applyAction, type Action, type GameState } from "../index";
import { advanceSteps } from "../step";

export function launchAct(game: GameState, action: Action) {
  const result = applyAction(game, action);
  if (!result.ok) throw Error(result.message);
  return result.state;
}

export function recoveredOpeningCompany() {
  let game = advanceSteps(newGame(3, "player-launch"), 6).state;
  game = advanceSteps(launchAct(game, { type: "start_db_upgrade" }), 30).state;
  return launchAct(game, { type: "acknowledge_review" });
}

export function launchCompany(version: 1 | 2 = 2) {
  const game = recoveredOpeningCompany();
  return launchAct(game, { type: "acknowledge_milestone", ...(version === 2 ? { scalingVersion: 2 } : {}) });
}

export function preparedLaunchCompany() {
  let game = launchCompany();
  game = advanceSteps(launchAct(game, { type: "start_db_upgrade" }), 3).state;
  return advanceSteps(launchAct(game, { type: "scale_up", appId: "app-1" }), 3).state;
}
