import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_PROFILE_CHOICES, APP_PROFILES, PROMOS, PROMO_ORDER, type AppProfileDef, type AppProfileId } from "@/sim";
import { choosingAppProfile, useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { tipProps } from "./tips";
import "./AppProfile.css";

const PROFILE_ICON: Record<AppProfileId, IconName> = {
  general: "appProfile",
  social: "social",
  gaming: "gaming",
  ecommerce: "ecommerce",
  streaming: "streaming",
};

/** A multiplier against the original balance, in words: "+25%", "-15%" or "Normal". */
function change(factor: number): string {
  const pct = Math.round((factor - 1) * 100);
  return pct === 0 ? "Normal" : `${pct > 0 ? "+" : ""}${pct}%`;
}

/** How early users notice slowness, from the load at which it starts to cost satisfaction. */
function lagTolerance(knee: number): string {
  return knee < 0.6 ? "Low: notices lag at half load" : knee > 0.75 ? "High: shrugs off busy servers" : "Normal";
}

/** The promotion this kind of app gets the most users from. */
function bestPromotion(p: AppProfileDef): string {
  const best = [...PROMO_ORDER].sort((a, b) => p.promoGain[b] - p.promoGain[a])[0];
  return p.promoGain[best] > 1 ? PROMOS[best].name : "No favourite";
}

/** What the profile changes, row by row, for the card back and the top bar's profile card. */
function effects(p: AppProfileDef): { label: string; value: string }[] {
  return [
    { label: "Traffic per user", value: change(p.traffic) },
    { label: "Database work per request", value: change(p.dbLoad) },
    { label: "Cacheable reads", value: `${Math.round(p.cacheEligibleShare * 100)}%` },
    { label: "Revenue per user", value: change(p.revenue) },
    { label: "Lag tolerance", value: lagTolerance(p.latencyKnee) },
    { label: "Best promotion", value: bestPromotion(p) },
  ];
}

function ProfileArt({ id }: { id: AppProfileId }) {
  return <span className="app-profile-art" aria-hidden="true"><Icon name={PROFILE_ICON[id]} size={56} /></span>;
}

function ProfileDetails({ p, headingLevel = 3 }: { p: AppProfileDef; headingLevel?: 3 | 4 }) {
  const Heading = `h${headingLevel}` as const;
  return <>
    <Heading className="app-profile-subhead">Needs</Heading>
    <ul className="app-profile-needs">{p.needs.map((n) => <li key={n}><Icon name="check" size={14} />{n}</li>)}</ul>
    <p className="app-profile-risk"><Icon name="alert" size={14} />{p.risk}</p>
  </>;
}

/**
 * The choice of what the company builds, shown over the room right after the first-week tutorial, or at once for a
 * player who has done it. The four cards read like a hand of options: pick one, read what it asks of the
 * infrastructure, then commit with Start building. Weeks do not move on until the choice is made.
 */
export function AppProfilePicker() {
  const choosing = useGame(choosingAppProfile);
  const view = useGame((s) => s.view);
  if (!choosing || view === "menu") return null;
  return <Picker />;
}

function Picker() {
  const act = useGame((s) => s.act);
  const [picked, setPicked] = useState<AppProfileId | null>(null);
  const group = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLInputElement>("input[type=radio]")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(
    <div className="app-profile-backdrop" role="presentation">
      <div ref={root} className="app-profile-picker" role="dialog" aria-modal="true" aria-labelledby={`${group}-title`} aria-describedby={`${group}-lede`}>
        <header className="app-profile-head">
          <h2 id={`${group}-title`}>What are you building?</h2>
          <p id={`${group}-lede`}>Each kind of app brings different users and leans on different machines. You choose once for this company.</p>
        </header>
        <div className="app-profile-cards" role="radiogroup" aria-label="Kind of app">
          {APP_PROFILE_CHOICES.map((id) => {
            const p = APP_PROFILES[id];
            return <label key={id} className={`app-profile-card${picked === id ? " is-on" : ""}`} data-profile={id}>
              <input type="radio" name={group} value={id} checked={picked === id}
                aria-labelledby={`${group}-${id}-name`} aria-describedby={`${group}-${id}-pitch`}
                onChange={() => setPicked(id)} />
              <span className="app-profile-card-head"><strong id={`${group}-${id}-name`}>{p.name}</strong></span>
              <ProfileArt id={id} />
              <span className="app-profile-card-body">
                <span id={`${group}-${id}-pitch`} className="app-profile-pitch">{p.pitch}</span>
                <ProfileDetails p={p} />
              </span>
            </label>;
          })}
        </div>
        <footer className="app-profile-foot">
          <span className="app-profile-note">{picked ? `${APP_PROFILES[picked].name}: ${APP_PROFILES[picked].pitch}` : "Pick a card. Its button in the top bar keeps these notes."}</span>
          <button type="button" className="btn btn-primary app-profile-start" disabled={!picked}
            onClick={() => { if (picked) act({ type: "choose_app_profile", profile: picked }); }}>
            <Icon name="play" />Start building
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The top bar's reminder of what the company builds, in the place Guided Mode keeps its Hint: a button that opens a
 * small card with the profile's needs, its risk and what it changes against a general app.
 */
export function AppProfileButton() {
  const id = useGame((s) => (s.game.campaign ? null : s.game.appProfile ?? null));
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const cardId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!card.current || !button.current) return;
      const box = button.current.getBoundingClientRect(), node = card.current;
      node.style.width = `${Math.min(340, innerWidth - 24)}px`;
      node.style.left = `${Math.max(12, Math.min(innerWidth - node.offsetWidth - 12, box.right - node.offsetWidth))}px`;
      node.style.top = `${box.bottom + 8}px`;
      node.style.maxHeight = `${innerHeight - box.bottom - 20}px`;
    };
    place();
    card.current?.focus();
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !card.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", outside, true);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside, true); };
  }, [open]);
  if (!id) return null;
  const p = APP_PROFILES[id];
  const close = () => { setOpen(false); button.current?.focus(); };
  return <>
    <button ref={button} type="button" className={`icon-btn app-profile-btn${open ? " is-open" : ""}`} data-profile={id} aria-label={`Your app: ${p.name}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? cardId : undefined}
      {...tipProps("What you are building", "below")} onClick={() => setOpen(!open)}>
      <Icon name={PROFILE_ICON[id]} />
    </button>
    {open && createPortal(
      <div ref={card} id={cardId} className="app-profile-popover" data-profile={id} role="dialog" aria-modal="false" aria-label="Your app" tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
        <div className="app-profile-popover-head">
          <span className="app-profile-popover-icon" aria-hidden="true"><Icon name={PROFILE_ICON[id]} /></span>
          <div><h3>{p.name}</h3><p>{p.pitch}</p></div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button>
        </div>
        <ProfileDetails p={p} headingLevel={4} />
        <h4 className="app-profile-subhead">Against a general app</h4>
        <dl className="app-profile-effects">
          {effects(p).map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}
        </dl>
      </div>,
      document.body,
    )}
  </>;
}
