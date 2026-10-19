import type { ReactNode } from "react";
import { useGame } from "@/game/store";
import { financeMoney } from "@/game/campaignFinance";
import type { LessonId } from "@/game/walkthrough";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { num } from "@/game/format";
import { Icon, type IconName } from "./icons";
import "./ChapterZero.css";

function Arrow() {
  return <span className="lesson-arrow" aria-hidden="true"><Icon name="next" size={18} /></span>;
}
function Machine({ icon, name, children }: { icon: IconName; name: string; children?: ReactNode }) {
  return <div className="lesson-machine"><Icon name={icon} size={28} /><strong>{name}</strong>{children}</div>;
}

/** Live demand against capacity for a component: the comparison every lesson builds on. */
function Load({ name, demand, capacity, unit }: { name: string; demand: number; capacity: number; unit: string }) {
  const share = capacity > 0 ? Math.min(1, demand / capacity) : 1;
  const tone = share >= 1 ? "critical" : share >= 0.85 ? "warn" : "ok";
  return <div className="lesson-load">
    <dt>{name}</dt>
    <dd><span className="lesson-load-bar" data-tone={tone}><i style={{ width: `${share * 100}%` }} /></span>
      <span>{num(demand)} / {num(capacity)} <small>{unit}</small></span></dd>
  </div>;
}

/** Each lesson's small labelled example or live reading. None of them is a pretend game control. */
export default function LessonVisual({ id }: { id: LessonId }) {
  const s = useGame(), c = s.game.campaign!;
  if (id === "goal") return <figure className="lesson-figure">
    <div className="lesson-flow" aria-label="Customers send requests to App Servers, which ask the Database for data">
      <Machine icon="users" name="Customers"><small>send requests</small></Machine><Arrow />
      <Machine icon="server" name="App Server"><small>the waiters</small></Machine><Arrow />
      <Machine icon="database" name="Database"><small>the kitchen</small></Machine>
    </div>
    <figcaption>Like a restaurant: when waiters or the kitchen fall behind, orders queue up. That queue is the <strong>backlog</strong>.</figcaption>
  </figure>;
  if (id === "inspect-app" && s.selected === "app") return <dl className="lesson-loads" aria-label="Live App Server reading">
    <Load name="App Server" demand={c.snapshot.app.demand} capacity={c.snapshot.app.capacity} unit="requests/s" />
  </dl>;
  if (id === "inspect-db" && s.selected === "db") return <figure className="lesson-figure">
    <dl className="lesson-loads" aria-label="Live demand and capacity">
      <Load name="App Server" demand={c.snapshot.app.demand} capacity={c.snapshot.app.capacity} unit="requests/s" />
      <Load name="Database" demand={c.snapshot.db.demand} capacity={c.snapshot.db.capacity} unit="operations/s" />
    </dl>
    <figcaption>Demand / capacity, live. The fuller bar is closer to becoming the bottleneck.</figcaption>
  </figure>;
  if (id === "warnings") return <div className="lesson-warning-pair">
    <div><Icon name="latency" size={24} /><span>Slow</span><strong>{num(Q.latencyThresholdMs)}+ ms</strong></div>
    <div><Icon name="alert" size={24} /><span>Failing</span><strong>{Q.errorThreshold * 100}%+ errors</strong></div>
  </div>;
  if (id === "money") return <div className="lesson-budget">
    <div><span>Cash · spend now</span><strong>{financeMoney(c.cashCents)}</strong></div>
    <div><span>Pending · this week</span><strong>{financeMoney(c.ledger.successes * Q.revenueCents)}</strong></div>
  </div>;
  if (id === "ready") return <ol className="lesson-goal-steps">
    <li><Icon name="search" size={20} /><span><strong>Inspect</strong> the evidence for free</span></li>
    <li><Icon name="wrench" size={20} /><span><strong>Decide</strong>: check the quote, then buy</span></li>
    <li><Icon name="play" size={20} /><span><strong>Run</strong> and watch what changes</span></li>
    <li><Icon name="save" size={20} /><span>Your company autosaves. <strong>Menu → Save now</strong> saves at any time.</span></li>
  </ol>;
  return null;
}
