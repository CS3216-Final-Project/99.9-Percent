import { useEffect, useId, useRef, useState } from "react";
import { BALANCE, metrics } from "@/sim";
import { incidentActive } from "@/sim/step";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { compact, money, num, signedMoney, uptimePct } from "@/game/format";
import { useGame } from "@/game/store";
import { AppHealthEntry } from "@/components/CampaignAppHealth";
import { FinanceEntry } from "@/components/CampaignFinance";
import { healthOf } from "@/components/health";
import { Icon } from "@/components/icons";
import { SoundButton } from "@/components/SoundButton";
import { tipProps } from "@/components/tips";
import { Meter, Stat } from "@/components/ui";
import { PhoneChapterRow } from "../layout/PhoneChapterRow";
import "../layout/phone-layout.css";

/**
 * Region: top strip. One row the room never loses: the logo, Cash, the health or incident status, the company's
 * other numbers behind one tap, sound and Menu. Guided Mode adds a one-line chapter row underneath.
 * During an incident the whole strip takes the red striped treatment.
 */
export function PhoneTopStrip() {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  const incident = useGame((s) => incidentActive(s.game));
  const openView = useGame((s) => s.openView);
  const [statsOpen, setStatsOpen] = useState(false);
  const statsId = useId();
  const header = useRef<HTMLElement>(null);

  // The extra numbers fold away on a tap outside them or on Escape, like the dock's menus.
  useEffect(() => {
    if (!statsOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && header.current?.querySelector(".phone-stats-area")?.contains(event.target)) return;
      setStatsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setStatsOpen(false);
      header.current?.querySelector<HTMLElement>(".phone-stats-toggle")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [statsOpen]);

  return <header ref={header} className={`topbar phone-top${incident ? " is-incident" : ""}`}>
    <div className="phone-top-row">
      <span className="brand-mark phone-logo" aria-hidden="true">99.99%</span>
      <div className="stats-strip phone-headline">
        {campaign ? <><FinanceEntry /><AppHealthEntry /></> : <ClassicHeadline />}
      </div>
      <div className="phone-stats-area">
        <button type="button" className="icon-btn phone-stats-toggle" aria-expanded={statsOpen} aria-controls={statsId}
          aria-label="Users and revenue" {...tipProps("Users and revenue")} onClick={() => setStatsOpen(!statsOpen)}>
          <Icon name="users" size={20} /><Icon name="down" size={12} />
        </button>
        <div id={statsId} className="phone-stats" role="region" aria-label="Company numbers" hidden={!statsOpen}>
          {statsOpen && (campaign ? <GuidedNumbers /> : <ClassicNumbers />)}
        </div>
      </div>
      <SoundButton />
      <button type="button" className="icon-btn menu-btn" aria-label="Menu" {...tipProps("Menu")} onClick={() => openView("menu")}><Icon name="menu" /></button>
    </div>
    {campaign && started && <PhoneChapterRow />}
  </header>;
}

/** Guided Mode: registered users, and revenue earned this week that is not cash yet. */
function GuidedNumbers() {
  const users = useGame((s) => s.game.users);
  const successes = useGame((s) => s.game.campaign!.ledger.successes);
  const pending = successes * Q.revenueCents / 100;
  return <>
    <Stat icon="users" kind="users" label="Users" tip="Registered users and incoming requests are different. Inspect incoming req/s to see current demand.">
      <strong>{num(users)}</strong>
    </Stat>
    <Stat icon="revenue" kind="revenue" label="Pending revenue" tip={`${money(pending)} earned this operating week, not yet added to cash. Only successful requests earn revenue.`}>
      <strong>{money(pending)}</strong>
      <span className="phone-stat-note">Not cash yet: added when the week settles</span>
    </Stat>
  </>;
}

/** Challenge Mode's headline pair: Cash and Health, as on the desktop's top bar. */
function ClassicHeadline() {
  const game = useGame((s) => s.game);
  const m = metrics(game);
  const health = healthOf(game);
  return <>
    <Stat icon="cash" kind="cash" label="Cash" tip={`Revenue comes in and ${money(m.costs.total)} of costs go out each week. Below zero, you are bankrupt.`}>
      <strong className={game.cash < 10_000 ? "text-critical" : ""}>{money(game.cash)}</strong>
    </Stat>
    <Stat icon={health.icon} kind={health.tone === "ok" ? "health" : health.tone} label="Health"
      tip="Uptime is the share of requests served across the whole run. 99.99% allows about 26 minutes of downtime in this company.">
      <strong>{health.word}</strong>
    </Stat>
  </>;
}

/** Challenge Mode: users against the goal, weekly revenue and profit, and uptime. */
function ClassicNumbers() {
  const game = useGame((s) => s.game);
  const m = metrics(game);
  return <>
    <Stat icon="users" kind="users" label="Users" tip={`Your goal: ${num(BALANCE.targetUsers)} by week ${BALANCE.maxTurns}. Every user adds traffic.`}>
      <strong>{num(game.users)}</strong>
      <span className="stat-goal">
        <Meter value={game.users / BALANCE.targetUsers} label="Progress to the user goal" />
        <span className="muted">Goal {compact(BALANCE.targetUsers)}</span>
      </span>
    </Stat>
    <Stat icon="revenue" kind="revenue" label="Revenue" tip="Earned from customers each week. It drops when the service is failing.">
      <strong>{money(m.revenue)}/wk</strong>
      <span className={m.net >= 0 ? "text-ok" : "text-warn"}>{signedMoney(m.net)}/wk after costs</span>
    </Stat>
    <Stat icon="health" kind="health" label="Uptime" tip="The share of requests served across the whole run.">
      <strong>{uptimePct(m.uptime)}</strong>
    </Stat>
  </>;
}
