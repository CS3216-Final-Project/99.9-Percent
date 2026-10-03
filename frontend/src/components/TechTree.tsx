"use client";

import { BRANCHES, missingPrerequisites, TECH, TECH_ORDER, techStatus, type GameState, type TechId, type TechStatus } from "@/sim";
import { moneyFull, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Act, Chip, ReleaseRow, TaskRow } from "./ui";

const NODE_W = 204;
const NODE_H = 60;
const COL_GAP = 252;
const ROW_GAP = 78;
const PAD_X = 128;
const PAD_Y = 12;
const LANE_GAP = 14;

/** Rows are grouped into one lane per branch. */
const LANES = [
  { branch: "growth", rows: [0, 0] },
  { branch: "capacity", rows: [1, 2] },
  { branch: "reliability", rows: [3, 4] },
  { branch: "engineering", rows: [5, 6] },
] as const;

function laneIndex(row: number): number {
  return LANES.findIndex((l) => row >= l.rows[0] && row <= l.rows[1]);
}

function nodePos(id: TechId): { x: number; y: number } {
  const t = TECH[id];
  return { x: PAD_X + t.col * COL_GAP, y: PAD_Y + t.row * ROW_GAP + laneIndex(t.row) * LANE_GAP };
}

const WIDTH = PAD_X + 2 * COL_GAP + NODE_W + 16;
const HEIGHT = PAD_Y + 7 * ROW_GAP + 3 * LANE_GAP;

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
    const task = game.tasks.find((t) => t.techId === id);
    return task ? `Building ${pct(task.progress / task.effort)}` : "Building";
  }
  if (status === "locked") return "Locked";
  return moneyFull(TECH[id].cost);
}

function Detail({ game, id }: { game: GameState; id: TechId }) {
  const act = useGame((s) => s.act);
  const focusTech = useGame((s) => s.focusTech);
  const def = TECH[id];
  const status = techStatus(game, id);
  const task = game.tasks.find((t) => t.kind === "tech" && t.techId === id);
  const release = game.releases.find((r) => r.techId === id);

  return (
    <div className="tree-detail">
      <span className={`tag tag-${status === "done" ? "ok" : status === "locked" ? "plain" : "accent"}`}>{STATUS_WORD[status]}</span>
      <h3>{def.name}</h3>
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
        <Chip icon="wrench" tip="Engineer-weeks of work. Three engineers finish three engineer-weeks in one week.">
          {def.effort} engineer-weeks
        </Chip>
        {(def.upkeep > 0 || def.upkeepNote) && <Chip tip="Running cost once it is live.">{def.upkeepNote ?? `${moneyFull(def.upkeep)}/wk`}</Chip>}
      </div>

      {def.requires.length > 0 && (
        <div className="chips">
          {def.requires.map((r) => {
            const met = techStatus(game, r) === "done";
            return (
              <button type="button" key={r} className={`tech-chip tech-${met ? "done" : "locked"}`} onClick={() => focusTech(r)}>
                <Icon name={met ? "check" : "lock"} size={12} />
                Needs {TECH[r].name}
              </button>
            );
          })}
        </div>
      )}

      {status === "available" && (
        <Act primary tour="primary" icon="plus" label="Start" price={def.cost} disabled={game.phase !== "management"} onClick={() => act({ type: "start_tech", tech: id })} />
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
  const selected: TechId = focus ?? TECH_ORDER.find((t) => techStatus(game, t) === "available") ?? "monitoring";

  return (
    <div className="tree">
      <div className="tree-scroll">
        <div className="tree-canvas" style={{ width: WIDTH, height: HEIGHT }}>
          {LANES.map((lane, i) => {
            const b = BRANCHES.find((x) => x.id === lane.branch);
            const top = PAD_Y + lane.rows[0] * ROW_GAP + i * LANE_GAP - 7;
            const height = (lane.rows[1] - lane.rows[0] + 1) * ROW_GAP - 4;
            return (
              <div key={lane.branch} className="lane" style={{ top, height, width: WIDTH }}>
                <div className="lane-label">
                  <strong>{b?.name}</strong>
                  <span>{b?.blurb}</span>
                </div>
              </div>
            );
          })}

          <svg className="tree-edges" width={WIDTH} height={HEIGHT} aria-hidden="true">
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
            const task = game.tasks.find((t) => t.techId === id);
            const missing = status === "locked" ? missingPrerequisites(game, id).map((r) => TECH[r].name).join(" and ") : "";
            return (
              <button
                type="button"
                key={id}
                data-tech={id}
                className={`node node-${status}${selected === id ? " is-selected" : ""}`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                onClick={() => focusTech(id)}
                aria-pressed={selected === id}
                aria-label={`${TECH[id].name}: ${STATUS_WORD[status]}`}
                title={missing ? `Needs ${missing}` : TECH[id].description}
              >
                <span className="node-mark" aria-hidden="true">
                  <Icon name={status === "done" ? "check" : status === "locked" ? "lock" : status === "available" ? "plus" : "wrench"} size={12} />
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
      <Detail game={game} id={selected} />
    </div>
  );
}
