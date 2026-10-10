"use client";

import { BALANCE, BRANCHES, missingPrerequisites, TECH, TECH_ORDER, techStatus, type GameState, type TechId, type TechStatus } from "@/sim";
import { moneyFull, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { TECH_ICON } from "./presentation";
import { Act, Chip, Concept, ReleaseRow, TaskRow } from "./ui";

const NODE_W = 204;
const NODE_H = 60;
const COL_GAP = 252;
const ROW_GAP = 78;
const PAD_X = 128;
const PAD_Y = 12;
const LANE_GAP = 14;

/** Rows are grouped into one lane per branch. */
const LANES = [
  { branch: "capacity", rows: [0, 0] },
  { branch: "data", rows: [1, 1] },
  { branch: "reliability", rows: [2, 2] },
] as const;

function laneIndex(row: number): number {
  return LANES.findIndex((l) => row >= l.rows[0] && row <= l.rows[1]);
}

function nodePos(id: TechId): { x: number; y: number } {
  const t = TECH[id];
  return { x: PAD_X + t.col * COL_GAP, y: PAD_Y + t.row * ROW_GAP + laneIndex(t.row) * LANE_GAP };
}

const WIDTH = PAD_X + 2 * COL_GAP + NODE_W + 16;
const HEIGHT = PAD_Y + 3 * ROW_GAP + 2 * LANE_GAP;

const BRANCH_ICON: Record<string, IconName> = { capacity: "server", data: "database", reliability: "health" };

const STATUS_ICON: Record<TechStatus, IconName> = {
  locked: "lock",
  available: "plus",
  in_progress: "wrench",
  ready: "ship",
  done: "check",
};

const STATUS_WORD: Record<TechStatus, string> = {
  locked: "Locked",
  available: "Available",
  in_progress: "Building",
  ready: "Ready to ship",
  done: "Live",
};

function statusLine(game: GameState, id: TechId, status: TechStatus): string {
  if (status === "done") return "Live";
  if (status === "ready") return "Ready to ship";
  if (status === "in_progress") {
    const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.techId === id);
    return task ? `Building ${pct(task.progress / task.effort)}` : "Building";
  }
  if (status === "locked") return "Locked";
  return moneyFull(id === "larger_database" ? BALANCE.db.tiers[game.infra.dbTier + 1]?.cost ?? 0 : TECH[id].cost);
}

function Detail({ game, id }: { game: GameState; id: TechId }) {
  const act = useGame((s) => s.act);
  const focusTech = useGame((s) => s.focusTech);
  const nextTier = id === "larger_database" ? BALANCE.db.tiers[game.infra.dbTier + 1] : undefined;
  const def = nextTier ? { ...TECH[id], cost: nextTier.cost, effort: nextTier.effort, upkeepNote: `${moneyFull(nextTier.upkeep)}/wk` } : TECH[id];
  const status = techStatus(game, id);
  const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.kind === "tech" && t.techId === id);
  const release = game.releases.find((r) => id === "larger_database" ? r.kind === "db_upgrade" : r.techId === id);

  return (
    <div className="tree-detail">
      <span className={`tag tag-${status === "done" ? "ok" : status === "locked" ? "plain" : status === "available" ? "accent" : "warn"}`}>
        <Icon name={STATUS_ICON[status]} size={12} />
        {STATUS_WORD[status]}
      </span>
      <div className="tree-detail-head">
        <Concept kind={status === "locked" ? "muted" : "tech"} icon={TECH_ICON[id] ?? "tree"} />
        <h3>{def.name}</h3>
      </div>
      <p className="muted">{def.description}</p>
      <ul className="effects">
        {def.effects.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <div className="chips">
        <Chip icon="cash" tip="One-off cost to start building.">
          {moneyFull(def.cost)}
        </Chip>
        <Chip icon="team" tip="Engineer-weeks of work. Three engineers finish three engineer-weeks in one week.">
          {def.effort} engineer-weeks
        </Chip>
        {(def.upkeep > 0 || def.upkeepNote) && (
          <Chip icon="week" tip="Running cost once it is live.">
            {def.upkeepNote ?? `${moneyFull(def.upkeep)}/wk`}
          </Chip>
        )}
      </div>

      {def.requires.length > 0 && (
        <div className="chips">
          {def.requires.map((r) => {
            const met = techStatus(game, r) === "done";
            return (
              <button type="button" key={r} className={`tech-chip tech-${met ? "done" : "locked"}`} onClick={() => focusTech(r)}>
                <Icon name={met ? "check" : "lock"} size={16} />
                Needs {TECH[r].name}
              </button>
            );
          })}
        </div>
      )}

      {(status === "available" || (status === "done" && nextTier)) && (
        <Act primary tour="primary" icon="plus" label={nextTier ? `Upgrade to ${nextTier.name}` : "Start"} price={def.cost} disabled={game.phase !== "management"} onClick={() => act({ type: "start_tech", tech: id })} />
      )}
      {task && <TaskRow game={game} task={task} />}
      {release && <ReleaseRow game={game} release={release} />}
    </div>
  );
}

export default function TechTree() {
  const game = useGame((s) => s.game);
  const focus = useGame((s) => s.techFocus);
  const focusTech = useGame((s) => s.focusTech);
  const selected: TechId = focus && TECH_ORDER.includes(focus) ? focus : TECH_ORDER.find((t) => techStatus(game, t) === "available") ?? "larger_servers";

  return (
    <div className="tree">
      <div className="tree-scroll">
        <div className="tree-map">
          <div className="tree-canvas">
            {LANES.map((lane, i) => {
              const b = BRANCHES.find((x) => x.id === lane.branch);
              const top = PAD_Y + lane.rows[0] * ROW_GAP + i * LANE_GAP - 7;
              const height = (lane.rows[1] - lane.rows[0] + 1) * ROW_GAP - 4;
              return (
                <div key={lane.branch} className={`lane lane-${lane.branch}`} style={{ top: `${top / HEIGHT * 100}%`, height: `${height / HEIGHT * 100}%` }}>
                  <div className="lane-label" style={{ width: `${(PAD_X - 12) / WIDTH * 100}%` }}>
                    <strong>
                      <Icon name={BRANCH_ICON[lane.branch]} />
                      {b?.name}
                    </strong>
                    <span>{b?.blurb}</span>
                  </div>
                </div>
              );
            })}

            <svg className="tree-edges" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
              {TECH_ORDER.flatMap((id) =>
                TECH[id].requires.map((r) => {
                  const a = nodePos(r);
                  const b = nodePos(id);
                  const x1 = a.x + NODE_W;
                  const y1 = a.y + NODE_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const bend = Math.max(40, (x2 - x1) * 0.5);
                  const met = techStatus(game, r) === "done";
                  const cross = TECH[r].branch !== TECH[id].branch;
                  return (
                    <path
                      key={`${r}-${id}`}
                      vectorEffect="non-scaling-stroke"
                      d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                      className={`edge${met ? " is-met" : ""}${cross ? " is-cross" : ""}${selected === id || selected === r ? " is-focus" : ""}`}
                    />
                  );
                }),
              )}
            </svg>

            {TECH_ORDER.map((id) => {
              const status = techStatus(game, id);
              const p = nodePos(id);
              const task = game.tasks.find((t) => id === "larger_database" ? t.kind === "db_upgrade" : t.techId === id);
              const missing = status === "locked" ? missingPrerequisites(game, id).map((r) => TECH[r].name).join(" and ") : "";
              return (
                <button
                  type="button"
                  key={id}
                  data-tech={id}
                  className={`node node-${status}${selected === id ? " is-selected" : ""}`}
                  style={{ left: `${p.x / WIDTH * 100}%`, top: `${p.y / HEIGHT * 100}%`, width: `${NODE_W / WIDTH * 100}%`, height: `${NODE_H / HEIGHT * 100}%` }}
                  onClick={() => focusTech(id)}
                  aria-pressed={selected === id}
                  aria-label={`${TECH[id].name}: ${STATUS_WORD[status]}`}
                  title={missing ? `Needs ${missing}` : TECH[id].description}
                >
                  <span className="node-mark" aria-hidden="true">
                    <Icon name={TECH_ICON[id] ?? "tree"} />
                    <span className="node-badge">
                      <Icon name={STATUS_ICON[status]} size={12} />
                    </span>
                  </span>
                  <span className="node-name">{TECH[id].name}</span>
                  <span className="node-status">{statusLine(game, id, status)}</span>
                  {task && <span className="node-progress" style={{ width: `${(task.progress / task.effort) * 100}%` }} />}
                </button>
              );
            })}
          </div>
          <ul className="tree-legend" aria-label="Legend">
            <li><span className="swatch node-locked" />Locked</li>
            <li><span className="swatch node-available" />Available</li>
            <li><span className="swatch node-in_progress" />Building</li>
            <li><span className="swatch node-done" />Live</li>
            <li><span className="swatch swatch-dash" />Needs another branch</li>
          </ul>
        </div>
      </div>
      <Detail game={game} id={selected} />
    </div>
  );
}
