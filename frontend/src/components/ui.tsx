"use client";

import type { ReactNode } from "react";
import { BALANCE, releaseRisk, taskEta, testEffort, type GameState, type Release, type Task } from "@/sim";
import { moneyFull, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";

/** Plain-language explanation shown on hover, keyboard focus or tap. Detail lives here, not on screen. */
export function Tip({ text, children, side = "below" }: { text: string; children: ReactNode; side?: "below" | "above" | "left" }) {
  return (
    <span className={`tip tip-${side}`} tabIndex={0} data-tip={text}>
      {children}
    </span>
  );
}

export type Tone = "accent" | "ok" | "warn" | "critical";

export function Meter({ value, tone = "accent", label }: { value: number; tone?: Tone; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`meter tone-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="meter-fill" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function utilTone(util: number): "ok" | "warn" | "critical" {
  return util >= 1 ? "critical" : util >= 0.85 ? "warn" : "ok";
}

/** A labelled bar: the main way the game shows how something is doing. */
export function Gauge({ label, value, text, tone, tip }: { label: string; value: number; text: string; tone: Tone; tip: string }) {
  return (
    <div className="gauge">
      <div className="gauge-head">
        <Tip text={tip}>{label}</Tip>
        <strong className={`text-${tone}`}>{text}</strong>
      </div>
      <Meter value={value} tone={tone} label={label} />
    </div>
  );
}

export function Chip({ icon, children, tip }: { icon?: IconName; children: ReactNode; tip?: string }) {
  return (
    <span className="stat-chip" title={tip}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** A button that does one thing and says what it costs. */
export function Act({
  icon,
  label,
  price,
  note,
  onClick,
  disabled,
  primary,
  tour,
  title,
}: {
  icon?: IconName;
  label: string;
  price?: number;
  note?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  tour?: string;
  title?: string;
}) {
  return (
    <button type="button" className={`act${primary ? " act-primary" : ""}`} onClick={onClick} disabled={disabled} data-tour={tour} title={title}>
      {icon && <Icon name={icon} />}
      <span className="act-label">{label}</span>
      {price !== undefined && <span className="price">{moneyFull(price)}</span>}
      {note && <span className="price">{note}</span>}
    </button>
  );
}

export function Row({ label, value, tip }: { label: string; value: ReactNode; tip?: string }) {
  return (
    <div className="row">
      <dt>{tip ? <Tip text={tip}>{label}</Tip> : label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** One engineering task. More engineers means an earlier finish. */
export function TaskRow({ game, task }: { game: GameState; task: Task }) {
  const act = useGame((s) => s.act);
  const eta = taskEta(game, task);
  const locked = game.phase !== "management";
  const repair = task.kind === "fix_release" || task.kind === "repair";
  return (
    <div className="task">
      <div className="task-top">
        <strong>{task.title}</strong>
        {!repair && (
          <button
            type="button"
            className="icon-btn icon-btn-small"
            disabled={locked}
            onClick={() => act({ type: "cancel_task", taskId: task.id })}
            aria-label={`Cancel ${task.title}`}
            title={task.costPaid > 0 ? "Cancel (50% refund)" : "Cancel"}
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      <Meter value={task.progress / task.effort} label={`${task.title} progress`} tone={eta === null ? "warn" : "accent"} />
      <div className="task-bottom">
        <span className={eta === null ? "text-warn" : "muted"}>{eta === null ? "No engineers" : `${eta} wk left`}</span>
        <div className="stepper" role="group" aria-label={`Engineers on ${task.title}`} title={`Up to ${BALANCE.engineer.maxPerTask} engineers. More finish sooner.`}>
          <button type="button" disabled={locked || task.assigned <= 0} onClick={() => act({ type: "assign_engineers", taskId: task.id, count: task.assigned - 1 })} aria-label="Remove an engineer">
            −
          </button>
          <span>
            <Icon name="wrench" size={13} />
            {task.assigned}
          </span>
          <button
            type="button"
            disabled={locked || task.assigned >= BALANCE.engineer.maxPerTask}
            onClick={() => act({ type: "assign_engineers", taskId: task.id, count: task.assigned + 1 })}
            aria-label="Add an engineer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

/** A finished release: ship it now and accept the risk, or test it first. */
export function ReleaseRow({ game, release }: { game: GameState; release: Release }) {
  const act = useGame((s) => s.act);
  const locked = game.phase !== "management";
  const testing = game.tasks.some((t) => t.kind === "test_release" && t.releaseId === release.id);
  const risk = releaseRisk(game, release);
  const tone = risk >= 0.2 ? "critical" : risk >= 0.08 ? "warn" : "ok";
  const weeks = testEffort(game, release);

  return (
    <div className="release">
      <div className="task-top">
        <strong>{release.title}</strong>
        {release.tested && !release.needsFix && <span className="tag tag-ok">Tested</span>}
        {release.needsFix && <span className="tag tag-warn">Needs fix</span>}
      </div>
      {release.needsFix ? (
        <p className="muted">Rolled back. Staff its fix task.</p>
      ) : testing ? (
        <p className="muted">Being tested.</p>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="act act-primary"
            data-tour="primary"
            disabled={locked}
            onClick={() => act({ type: "deploy_release", releaseId: release.id })}
            title="Risk is the chance this deploy breaks production. It rises with tech debt. Testing first cuts it by 85%."
          >
            <Icon name="ship" />
            <span className="act-label">Deploy</span>
            <span className={`price risk-${tone}`}>{pct(risk)} risk</span>
          </button>
          {!release.tested && (
            <button type="button" className="act" disabled={locked} onClick={() => act({ type: "test_release", releaseId: release.id })} title="Engineers test it before it ships.">
              <Icon name="check" />
              <span className="act-label">Test first</span>
              <span className="price">{weeks} wk</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  tone,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  tone?: "alert";
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? " modal-wide" : ""}${tone ? ` modal-${tone}` : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
