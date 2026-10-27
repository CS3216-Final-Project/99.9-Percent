import { introductionActive } from "@/sim/introduction";
import { pendingStop } from "@/sim/step";
import { milestoneBlocks } from "@/game/campaignGuidance";
import { ACTION_NAMES } from "@/game/reportEvents";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import "./PendingDeployments.css";

const appName = (id: string) => `App ${id.slice(4)}`;

/**
 * Scheduled upgrades and deployments wait out their activation delay off the left edge of the room.
 * Deploy now is not instant: it starts a 20x rush so the same deterministic steps run, just sooner.
 */
export function PendingDeployments() {
  const { game, deployRush, rushDeploy, cancelDeployRush } = useGame();
  const c = game.campaign;
  if (!c || !c.pending.length || introductionActive(c)) return null;
  const disabled = pendingStop(c) !== null || milestoneBlocks(game) || game.phase === "review" || game.phase === "ended";
  return <aside className="pending-deployments" aria-label="Pending deployments">
    <h3><Icon name="time" size={16} />Deployments</h3>
    <ul>
      {c.pending.map(a => {
        const name = `${ACTION_NAMES[a.type]}${a.targetId ? ` (${appName(a.targetId)})` : ""}`;
        const remaining = a.activationStep - c.step;
        const delay = a.activationStep - a.requestedStep;
        const progress = delay > 0 ? Math.min(1, Math.max(0, (c.step - a.requestedStep) / delay)) : 1;
        return <li key={a.id}>
          <span className="pending-name">{name}</span>
          <span className="pending-when">in {remaining} s</span>
          <span className="instance-bar" role="progressbar" aria-label={`${name} deployment`} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)} aria-valuetext={`in ${remaining} s`}>
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        </li>;
      })}
    </ul>
    <button type="button" className="btn btn-small pending-skip" aria-pressed={deployRush} disabled={disabled}
      {...tipProps("Fast-forward time until every scheduled deployment activates (20×). Stops early if something needs you.")}
      onClick={() => deployRush ? cancelDeployRush() : rushDeploy()}>
      <Icon name="stepMany" size={16} /><span>{deployRush ? "Cancel rush" : "Deploy now"}</span>
    </button>
  </aside>;
}
