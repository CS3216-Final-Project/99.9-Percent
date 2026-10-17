import type { ReactNode } from "react";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { financeMoney, totalCharges } from "@/game/campaignFinance";
import { operatingCharges } from "@/sim/settlement";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { num } from "@/game/format";
import { Icon, type IconName } from "./icons";
import "./ChapterZero.css";

const PRACTICE = newGame(1, "chapter-zero-practice");
const WEEKLY_COST = totalCharges(operatingCharges(PRACTICE.campaign!));
function Arrow({ label }: { label?: string }) {
  return <span className="lesson-arrow" aria-hidden="true"><Icon name="next" size={24} />{label && <small>{label}</small>}</span>;
}
function Machine({ icon, name, children, muted = false }: { icon: IconName; name: string; children?: ReactNode; muted?: boolean }) {
  return <div className={`lesson-machine${muted ? " is-muted" : ""}`}><Icon name={icon} size={40} /><strong>{name}</strong>{children}</div>;
}
function WeekExample() {
  const second = Q.periodSteps;
  return <figure className="lesson-week-example">
    <figcaption>Example · one operating week is {Q.periodSteps} game seconds</figcaption>
    <div className="lesson-timeline">{[Q.periodSteps - 1, Q.periodSteps, Q.periodSteps + 1].map(n => <div key={n} className={second === n ? "is-current" : ""}><strong>{n}s</strong><span>Week {n < Q.periodSteps ? 1 : 2}</span>{n === Q.periodSteps && <small>Week 1 settles</small>}</div>)}</div>
    <p role="status">{second < Q.periodSteps ? "Week 1 is still accumulating revenue and costs." : "Week 1 has settled. Week 2 is running; total game seconds keep counting."}</p>
  </figure>;
}
function RoutingExample() {
  const both = true;
  return <figure className={`lesson-routing${both ? " is-balanced" : ""}`}>
    <figcaption>Routing example · two installed servers</figcaption>
    <div className="lesson-routing-map"><Machine icon="network" name="Traffic" /><Arrow /><div className="lesson-routing-apps"><Machine icon="server" name="App 1"><small>Receiving traffic</small></Machine><Machine icon="server" name="App 2" muted={!both}><small>{both ? "Receiving traffic" : "Installed, but idle"}</small></Machine></div><Arrow /><Machine icon="database" name="Database"><small>Shared by both apps</small></Machine></div>
    <p role="status">{both ? "Both servers receive requests. They still share one Database." : "App 2 adds capacity, but it cannot help until requests reach it."}</p>
  </figure>;
}
function RecoveryExample() {
  const streak = Q.stableSteps;
  return <section className="lesson-recovery" aria-label="Recovery example">
    <p className="lesson-demo-label">Example · five healthy seconds in a row</p>
    <div className="lesson-recovery-track" role="img" aria-label={`${streak} of ${Q.stableSteps} consecutive healthy seconds`}>{Array.from({ length: Q.stableSteps }, (_, i) => <span key={i} className={i < streak ? "is-healthy" : ""}>{i < streak ? <Icon name="check" /> : i + 1}</span>)}</div>

    <p role="status">{streak === Q.stableSteps ? "Five healthy seconds in a row: recovered." : `${streak} of ${Q.stableSteps} healthy seconds. A failing second resets the streak.`}</p>
  </section>;
}

export default function LessonVisual({ index }: { index: number }) {
  const s = useGame(), c = s.game.campaign!;
  if (index < 2) return <div className="lesson-flow" aria-label="Customers send requests through Servers to the Database"><Machine icon="users" name="Customers" /><Arrow /><Machine icon="server" name="Servers" /><Arrow /><Machine icon="database" name="Database" /></div>;
  if (index === 2) {
    if (s.selected !== "app" && s.selected !== "db") return null;
    const app = s.selected === "app", metrics = app ? c.snapshot.app : c.snapshot.db;
    const unit = app ? "requests/s" : "operations/s";
    return <figure className="lesson-evidence"><figcaption>{app ? "App Server" : "Database"} · live readings</figcaption><dl aria-label="Live demand and capacity">
      <div><dt>Demand<small>Incoming work</small></dt><dd>{num(metrics.demand)} <span>{unit}</span></dd></div>
      <div><dt>Capacity<small>Work it can handle</small></dt><dd>{num(metrics.capacity)} <span>{unit}</span></dd></div>
    </dl></figure>;
  }
  if (index === 3) return <div className="lesson-warning-pair"><article><Icon name="latency" size={36} /><h4>Slow responses</h4><strong>{Q.latencyThresholdMs}+ ms</strong><p>Requests are taking too long.</p></article><article><Icon name="alert" size={36} /><h4>Failed requests</h4><strong>{Q.errorThreshold * 100}%+ errors</strong><p>Some requests are not succeeding.</p></article></div>;
  if (index === 4) return <div className="lesson-earnings"><div><Icon name="check" size={28} /><span>Successful request</span><Arrow /><strong>+{financeMoney(Q.revenueCents)}</strong></div><div><Icon name="close" size={28} /><span>Rejected request</span><Arrow /><strong>{financeMoney(0)}</strong></div><p>Revenue waits for the weekly settlement.</p></div>;
  if (index === 5) return <p className="lesson-caption">Watch the real Game second counter. Your company advances one game second, then pauses automatically for this lesson.</p>;
  if (index === 6 || index === 7) return <p className="lesson-caption">This quote belongs to your company. Opening it costs nothing. Cancel to keep your cash and equipment.</p>;
  if (index === 8) return <WeekExample />;
  if (index === 9) return <figure className="lesson-receipt"><figcaption><Icon name="week" />Example · Week 1 settlement</figcaption><dl className="lesson-quote-lines"><div><dt>10,000 successful requests</dt><dd>+{financeMoney(10000 * Q.revenueCents)}</dd></div><div><dt>Base equipment + salaries</dt><dd>−{financeMoney(WEEKLY_COST)}</dd></div><div className="lesson-receipt-total"><dt>Change in cash</dt><dd>{financeMoney(10000 * Q.revenueCents - WEEKLY_COST)}</dd></div></dl><p className="lesson-caption">An illustrative week, not a forecast of your company.</p></figure>;
  if (index === 10) return <div className="lesson-budget"><Icon name="cash" size={48} /><div><span>Available to spend now</span><strong>{financeMoney(c.cashCents)}</strong></div><div><span>Pending this week</span><strong>{financeMoney(c.ledger.successes * Q.revenueCents)}</strong><small>Not spendable yet</small></div></div>;
  if (index === 11) return <p className="lesson-caption">Your real speed selector is in the bottom bar. The selected pace is {s.speed}×.</p>;
  if (index === 12) return <p className="lesson-caption">Use the elevator buttons in the room. You are on the {s.floor === "office" ? "office" : "server"} floor.</p>;
  if (index === 13) return <div className="lesson-flow lesson-tech-flow"><Machine icon="tree" name="Research"><small>Spend research points</small></Machine><Arrow /><Machine icon="check" name="Own it"><small>Capability unlocked</small></Machine><Arrow /><Machine icon="ship" name="Deploy it"><small>Pay & wait for activation</small></Machine></div>;
  if (index === 14) return <figure className="lesson-history-example"><figcaption><Icon name="history" />Example · look for changes over time</figcaption><svg viewBox="0 0 560 150" role="img" aria-label="Example traffic chart: demand rises over game seconds while capacity stays flat"><path d="M35 15V120H540" className="lesson-chart-axis" /><path d="M35 65H540" className="lesson-chart-capacity" /><path d="M35 105H200L260 38H540" className="lesson-chart-demand" /></svg><div className="lesson-chart-key"><span><i />Capacity stays flat</span><span><i />Demand rises</span><span>Game seconds →</span></div><div className="lesson-history-tabs"><span><Icon name="history" size={20} />Charts · trends</span><span><Icon name="flag" size={20} />Events · decisions</span><span><Icon name="incident" size={20} />Incidents · reports</span></div></figure>;
  if (index === 15) return <div className="lesson-save-options"><div><Icon name="save" size={36} /><h4>This browser</h4><p>Autosave, local backups and Save now.</p><span className="lesson-caption">Menu → Run → Save now</span></div><div><Icon name="cloud" size={36} /><h4>Your account</h4><p>Optional sign-in and explicit cloud saves.</p><span className="lesson-caption">Menu → Account</span></div></div>;
  if (index === 16) return <RoutingExample />;
  if (index === 17) return <RecoveryExample />;
  if (index === 18) return <ol className="lesson-roadmap">{([['scale', 'Scaling & Routing'], ['database', 'Data Strategy'], ['robot', 'Traffic Spikes & Autoscaling'], ['health', 'Stay Online'], ['users', 'Grow the Company']] as const).map(([icon, name], i) => <li key={name}><span>{i + 2}</span><Icon name={icon} size={28} /><strong>{name}</strong></li>)}</ol>;
  if (index === 19) return <ol className="lesson-goal-steps"><li><Icon name="search" /><span><strong>Read the goal</strong>Inspect the evidence and requirements.</span></li><li><Icon name="wrench" /><span><strong>Make a decision</strong>Check costs, act, then run to observe.</span></li><li><Icon name="flag" /><span><strong>Review the outcome</strong>Continue with Next when the chapter is ready.</span></li></ol>;
  return <div className="lesson-ready"><Icon name="flag" size={48} /><h4>Your first challenge: Opening</h4><p>Observe changing demand. Use the evidence to decide where to invest.</p><ul><li><Icon name="check" />Inspect for free</li><li><Icon name="check" />Preview before buying</li><li><Icon name="check" />Run, observe and pause</li><li><Icon name="check" />Leave cash for the weekly bill</li></ul></div>;
}
