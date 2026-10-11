"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { BALANCE, releaseRisk, taskEta, testEffort, type GameState, type Release, type Task } from "@/sim";
import { moneyFull, pct } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { tipProps, type TipSide } from "./tips";

export type ConceptKind = "cash" | "users" | "revenue" | "health" | "tech" | "team" | "growth" | "ok" | "warn" | "critical" | "muted" | "go";

/** An idea's icon on its coloured tile. The same idea always gets the same tile. */
export function Concept({ kind, icon, size = 24 }: { kind: ConceptKind; icon: IconName; size?: number }) {
  return (
    <span className={`concept concept-${kind}`} aria-hidden="true">
      <Icon name={icon} size={size} />
    </span>
  );
}

/**
 * Every message in the game is a Callout: a coloured icon tile, a small category
 * label and the text. The colour always means the same thing, wherever it appears:
 *   info (blue)      advice and neutral facts      success (green)  something worked
 *   warn (orange)    act soon                      critical (red)   failing now
 *   hint (yellow)    a tip you asked for
 */
export type CalloutTone = "info" | "success" | "warn" | "critical" | "hint";

export function Callout({
  tone,
  icon,
  kicker,
  children,
  action,
  onClick,
  compact = false,
  className,
  tip,
  live,
}: {
  tone: CalloutTone;
  icon: IconName;
  kicker?: ReactNode;
  children: ReactNode;
  /** A button shown at the end of the message. Not allowed when the whole callout is clickable. */
  action?: ReactNode;
  /** Makes the whole callout a button, with an arrow to say so. */
  onClick?: () => void;
  compact?: boolean;
  className?: string;
  /** Longer explanation, shown in the tooltip. */
  tip?: string;
  /** Announce the text (not the category label) to screen readers. */
  live?: "alert" | "status";
}) {
  const cls = `callout callout-${tone}${compact ? " callout-compact" : ""}${onClick ? " callout-button" : ""}${className ? ` ${className}` : ""}`;
  const body = (
    <>
      <span className="callout-icon" aria-hidden="true">
        <Icon name={icon} size={compact ? 12 : 24} />
      </span>
      <span className="callout-body">
        {kicker && <span className="callout-kicker">{kicker}</span>}
        <span className="callout-text" role={live}>
          {children}
        </span>
      </span>
      {action}
      {onClick && <Icon name="next" size={12} className="callout-go" />}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} {...tipProps(tip)}>
      {body}
    </button>
  ) : (
    <div className={cls} {...tipProps(tip)}>
      {body}
    </div>
  );
}

/** Plain-language explanation shown on hover, keyboard focus or tap. Detail lives here, not on screen. */
export function Tip({ text, children, side }: { text: string; children: ReactNode; side?: TipSide }) {
  return (
    <span className="tip" tabIndex={0} {...tipProps(text, side)}>
      {children}
    </span>
  );
}

/** Shared headline tile for both gameplay modes. */
export function Stat({ icon, kind, label, tip, children }: { icon: IconName; kind: ConceptKind; label: string; tip: string; children: ReactNode }) {
  return (
    <div className={`stat stat-${kind}`}>
      <span className="stat-icon">
        <Concept kind={kind} icon={icon} />
      </span>
      <div className="stat-body">
        <Tip text={tip}>
          {label}
        </Tip>
        {children}
      </div>
    </div>
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

/** A labelled bar: the main way the game shows how something is doing. */
export function Gauge({ label, value, text, tone, tip, icon }: { label: string; value: number; text: string; tone: Tone; tip: string; icon?: IconName }) {
  return (
    <div className="gauge">
      <div className="gauge-head">
        {icon && <Icon name={icon} />}
        <Tip text={tip}>{label}</Tip>
        <strong className={`text-${tone}`}>{text}</strong>
      </div>
      <Meter value={value} tone={tone} label={label} />
    </div>
  );
}

export function Chip({ icon, children, tip }: { icon?: IconName; children: ReactNode; tip?: string }) {
  return (
    <span className="stat-chip" {...tipProps(tip)}>
      {icon && <Icon name={icon} size={16} />}
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
  tip,
}: {
  icon?: IconName;
  label: string;
  price?: number;
  note?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  tour?: string;
  /** What it does, and why it may be unavailable. Shown in the tooltip, also while disabled. */
  tip?: string;
}) {
  return (
    <button type="button" className={`act${primary ? " act-primary" : ""}`} onClick={onClick} disabled={disabled} data-tour={tour} {...tipProps(tip)}>
      {icon && <Icon name={icon} />}
      <span className="act-label">{label}</span>
      {(price !== undefined || note) && (
        <span className="act-meta">
          {price !== undefined && (
            <span className="price">
              <Icon name="cash" size={12} />
              {moneyFull(price)}
            </span>
          )}
          {note && (
            <span className="price">
              <Icon name="latency" size={12} />
              {note}
            </span>
          )}
        </span>
      )}
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
        <strong>
          <Icon name={repair ? "refresh" : "wrench"} size={16} />
          {task.title}
        </strong>
        {!repair && (
          <button
            type="button"
            className="icon-btn icon-btn-small"
            disabled={locked}
            onClick={() => act({ type: "cancel_task", taskId: task.id })}
            aria-label={`Cancel ${task.title}`}
            {...tipProps(task.costPaid > 0 ? "Cancel (50% refund)" : "Cancel")}
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      <Meter value={task.progress / task.effort} label={`${task.title} progress`} tone={eta === null ? "warn" : "accent"} />
      <div className="task-bottom">
        <span className={eta === null ? "text-warn" : "muted"}>
          <Icon name={eta === null ? "alert" : "latency"} size={12} />
          {eta === null ? "No engineers" : `${eta} wk left`}
        </span>
        <div className="stepper" role="group" aria-label={`Engineers on ${task.title}`} {...tipProps(`Up to ${BALANCE.engineer.maxPerTask} engineers. More finish sooner.`)}>
          <button type="button" disabled={locked || task.assigned <= 0} onClick={() => act({ type: "assign_engineers", taskId: task.id, count: task.assigned - 1 })} aria-label="Remove an engineer">
            −
          </button>
          <span>
            <Icon name="team" size={16} />
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
        <strong>
          <Icon name="ship" size={16} />
          {release.title}
        </strong>
        {release.tested && !release.needsFix && (
          <span className="tag tag-ok">
            <Icon name="check" size={12} />
            Tested
          </span>
        )}
        {release.needsFix && (
          <span className="tag tag-warn">
            <Icon name="alert" size={12} />
            Needs fix
          </span>
        )}
      </div>
      {release.needsFix ? (
        <Callout compact tone="warn" icon="refresh" kicker="Rolled back">
          Staff its fix task.
        </Callout>
      ) : testing ? (
        <Callout compact tone="info" icon="test" kicker="Testing">
          Engineers are testing it.
        </Callout>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            className="act act-primary"
            data-tour="primary"
            disabled={locked}
            onClick={() => act({ type: "deploy_release", releaseId: release.id })}
            {...tipProps("Risk is the chance this deploy breaks production. It rises with tech debt. Testing first cuts it by 85%.")}
          >
            <Icon name="ship" />
            <span className="act-label">Deploy</span>
            <span className={`price risk-${tone}`}>{pct(risk)} risk</span>
          </button>
          {!release.tested && (
            <button type="button" className="act" disabled={locked} onClick={() => act({ type: "test_release", releaseId: release.id })} {...tipProps("Engineers test it before it ships.")}>
              <Icon name="test" />
              <span className="act-label">Test first</span>
              <span className="price">
                <Icon name="latency" size={12} />
                {weeks} wk
              </span>
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
  icon,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  tone?: "alert";
  /** The idea this dialog is about, shown beside the title. */
  icon?: { kind: ConceptKind; name: IconName };
}) {
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const node=dialog.current;
    node?.querySelector<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")?.focus();
    return ()=>{if(previous?.isConnected)previous.focus();};
  },[title]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? " modal-wide" : ""}${tone ? ` modal-${tone}` : ""}`} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
        if(e.key==="Escape"){e.stopPropagation();onClose?.();}
        if(e.key==="Tab"){
          const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')??[]);
          const first=nodes[0],last=nodes.at(-1);
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
        }
      }}>
        <header className="modal-head">
          <h2>
            {icon && <Concept kind={icon.kind} icon={icon.name} />}
            {title}
          </h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
