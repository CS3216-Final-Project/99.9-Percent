"use client";

import { equipmentInfo, inspectable, inspectSeconds, recoveryOptions, symptomaticEquipment } from "@/sim";
import { clock, moneyFull, num, pct } from "@/game/format";
import { inspectOrSelect, useGame } from "@/game/store";
import { Icon } from "./icons";
import { Meter, Tip } from "./ui";

/**
 * The crisis workspace. The alert shows symptoms only; the player investigates
 * equipment to find the cause and then picks a fix. Explanations sit in
 * tooltips so the panel itself stays short enough to read under pressure.
 */
export default function IncidentPanel() {
  const game = useGame((s) => s.game);
  const running = useGame((s) => s.running);
  const setRunning = useGame((s) => s.setRunning);
  const act = useGame((s) => s.act);
  const inc = game.incident;
  if (!inc) return null;

  // List the options as they stand without the "busy" lock, so the list does not jump while a fix runs.
  const options = recoveryOptions({ ...game, incident: { ...inc, pending: null } });
  const usable = options.filter((o) => o.enabled);
  const blocked = options.filter((o) => !o.enabled);
  const places = inspectable(game);
  const symptomatic = symptomaticEquipment(game);
  const lookSeconds = inspectSeconds(game);
  const timeLeft = Math.max(0, inc.maxDuration - inc.elapsed);
  const pending = inc.pending;

  return (
    <section className="panel-section incident" aria-label="Incident">
      <header className="panel-head">
        <span className="panel-icon state-critical">
          <Icon name="alert" size={22} />
        </span>
        <div>
          <h2>{inc.title}</h2>
          <span className="state state-critical">Incident</span>
        </div>
      </header>

      <div className="incident-clock">
        <div className="clock-row">
          <Tip text="One second here is one minute of outage. Customers leave while it runs. After 2:00 it is out of your hands.">
            <strong className="clock-time">{clock(inc.elapsed)}</strong>
          </Tip>
          <span className="muted">/ {clock(inc.maxDuration)}</span>
          <button type="button" className="btn btn-small" onClick={() => setRunning(!running)}>
            <Icon name={running ? "pause" : "play"} size={13} />
            {running ? "Pause" : "Resume"}
          </button>
        </div>
        <Meter value={inc.elapsed / inc.maxDuration} tone={timeLeft < 30 ? "critical" : "warn"} label="Incident time used" />
      </div>

      <div className="incident-symptoms">
        <dl className="impact">
          <div>
            <dt>Failing</dt>
            <dd className="text-critical">{pct(inc.severity)}</dd>
          </div>
          <div>
            <dt>Users lost</dt>
            <dd>{num(inc.damage.usersLost)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{moneyFull(inc.damage.moneySpent)}</dd>
          </div>
        </dl>
        <ul className="symptoms">
          {inc.symptoms.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="incident-investigate">
        <h4>
          <Tip text={`Click equipment in the room or here. Each look takes ${lookSeconds < 2 ? "about a second" : `${Math.round(lookSeconds)} seconds`} of clock time. Monitoring makes it faster.`}>
            Investigate
          </Tip>
        </h4>
        <div className="chips">
          {places.map((id) => {
            const checked = inc.evidence.some((e) => e.equipment === id);
            const busy = inc.inspecting?.equipment === id;
            return (
              <button
                type="button"
                key={id}
                className={`chip${checked ? " is-done" : ""}${busy ? " is-busy" : ""}${symptomatic.includes(id) ? " is-alert" : ""}`}
                disabled={checked || !!inc.inspecting}
                onClick={() => inspectOrSelect(id)}
              >
                {checked && <Icon name="check" size={11} />}
                {equipmentInfo(game, id).name}
              </button>
            );
          })}
        </div>
        {inc.inspecting && <Meter value={1 - inc.inspecting.remaining / inc.inspecting.total} tone="warn" label="Investigation progress" />}
        {inc.evidence.length > 0 && (
          <ul className="evidence">
            {[...inc.evidence].reverse().map((e) => (
              <li key={e.equipment} className={e.anomalous ? "is-anomalous" : ""}>
                <strong>{e.title}</strong> {e.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h4>Fix</h4>
      {pending && (
        <div className="working">
          <span>{options.find((o) => o.id === pending.id)?.label}…</span>
          <Meter value={1 - pending.remaining / pending.total} tone="accent" label="Action progress" />
        </div>
      )}
      <ul className="actions">
        {usable.map((o) => (
          <li key={o.id}>
            <button type="button" className="action" title={o.description} disabled={!!pending} onClick={() => act({ type: "incident_action", recovery: o.id })}>
              <span className="action-title">{o.label}</span>
              <span className="price">{o.costNote ?? (o.cost > 0 ? moneyFull(o.cost) : "Free")}</span>
              <span className="price">{o.secondsNote ?? `${o.seconds}s`}</span>
            </button>
          </li>
        ))}
      </ul>
      {blocked.length > 0 && (
        <details className="more">
          <summary>Not available ({blocked.length})</summary>
          <ul className="plain-list">
            {blocked.map((o) => (
              <li key={o.id}>
                {o.label}: <span className="muted">{o.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {inc.attempts.length > 0 && (
        <ul className="attempts">
          {[...inc.attempts].reverse().map((a, i) => (
            <li key={`${a.id}-${i}`} className={`attempt attempt-${a.outcome}`}>
              <strong>{a.label}</strong> {a.note}
            </li>
          ))}
        </ul>
      )}

      <div className="hint-box">
        {inc.hints.map((h) => (
          <p key={h}>{h}</p>
        ))}
        {inc.hints.length < 2 && (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => act({ type: "incident_hint" })}>
            <Icon name="bulb" size={13} />
            Hint
          </button>
        )}
      </div>
    </section>
  );
}
