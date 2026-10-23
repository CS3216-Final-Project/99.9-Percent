import { useState } from "react";
import { BALANCE } from "@/sim";
import { money, num } from "@/game/format";
import { challengeAvailable, guidedScopeComplete, useGame } from "@/game/store";
import { GraphicsSettings } from "@/components/GraphicsSettings";
import { Icon } from "@/components/icons";
import { MenuActions, MenuRun, MenuTile } from "@/components/MenuRun";
import { MenuTabs, type MenuTab } from "@/components/MenuTabs";
import { useMenuExit } from "@/components/MenuExit";
import { ModeSwitch } from "@/components/ModeSwitch";
import { SoundSettings } from "@/components/SoundSettings";
import { Callout, Modal } from "@/components/ui";

/** The phone menu keeps the run and the two settings a phone player needs; accounts, saves and playtest tools stay on the desktop. */
export const PHONE_MENU_TABS = ["run", "sound", "graphics"] as const satisfies readonly MenuTab[];
export type PhoneMenuTab = (typeof PHONE_MENU_TABS)[number];

const PHONE_ABOUT = {
  campaign: "Guided Mode teaches the basics through the walkthrough and two guided chapters of continuous play.",
  classic: `Challenge Mode is the ${BALANCE.maxTurns}-week weekly challenge: apply what you learned on your own.`,
} as const;

/**
 * The phone edition's menu, in both modes: the run at a glance, Resume and the few controls a run needs, the mode
 * switch, and Sound and Graphics. Autosave keeps the run without a Save button.
 */
export function PhoneMenu({ initialTab = "run" }: { initialTab?: MenuTab }) {
  const openView = useGame((s) => s.openView);
  const campaign = useGame((s) => !!s.game.campaign);
  const [tab, setTab] = useState<PhoneMenuTab>(PHONE_MENU_TABS.includes(initialTab as PhoneMenuTab) ? initialTab as PhoneMenuTab : "run");
  const exit = useMenuExit();
  const close = () => openView(null);
  // Leaving without a save asks first, in place of the menu, as on the desktop.
  if (exit.dialog) return exit.dialog;
  return <Modal title="Menu" icon={{ kind: "go", name: "menu" }} onClose={close} className="modal-menu phone-menu">
    {campaign ? <GuidedRun /> : <ChallengeRun />}
    <MenuTabs value={tab} onChange={(next) => setTab(next as PhoneMenuTab)} only={PHONE_MENU_TABS}>
      {tab === "run" && (campaign ? <GuidedActions onResume={close} exit={exit} /> : <ChallengeActions onResume={close} />)}
      {tab === "sound" && <SoundSettings />}
      {tab === "graphics" && <GraphicsSettings />}
    </MenuTabs>
  </Modal>;
}

function GuidedRun() {
  const game = useGame((s) => s.game);
  const saved = useGame((s) => s.saveStatus === "saved");
  const practice = useGame((s) => !!s.tutorialCompany);
  const c = game.campaign!;
  return <MenuRun title={practice ? "Walkthrough practice" : "At a glance"} saved={saved} stats={[
    { icon: "week", kind: "go", label: "Week", value: game.turn },
    { icon: "users", kind: "users", label: "Users", value: num(game.users) },
    { icon: "cash", kind: "cash", label: "Cash", value: money(c.cashCents / 100) },
  ]} />;
}

function ChallengeRun() {
  const game = useGame((s) => s.game);
  const saved = useGame((s) => s.saveStatus === "saved");
  const week = Math.min(game.turn, BALANCE.maxTurns);
  return <MenuRun title="At a glance" saved={saved} stats={[
    { icon: "week", kind: "go", label: "Week", value: `${week} / ${BALANCE.maxTurns}` },
    { icon: "users", kind: "users", label: "Users", value: num(game.users) },
    { icon: "cash", kind: "cash", label: "Cash", value: money(game.cash) },
  ]} />;
}

/** Guided Mode: Resume, the walkthrough and Exit to the home screen; a closed company can be replaced. */
function GuidedActions({ onResume, exit }: { onResume: () => void; exit: ReturnType<typeof useMenuExit> }) {
  const practice = useGame((s) => !!s.tutorialCompany);
  const ended = useGame((s) => s.game.phase === "ended");
  const saveBlocked = useGame((s) => s.saveBlocked);
  const complete = useGame(guidedScopeComplete);
  const scope = useGame((s) => s.scope);
  const [confirmNew, setConfirmNew] = useState(false);
  return <>
    {practice && <button className="btn btn-primary" onClick={() => useGame.getState().endTour(false)}><Icon name="next" size={18} />Return to game</button>}
    {saveBlocked && <Callout tone="warn" icon="save" kicker="Save preserved" live="alert">Your stored save is unreadable or unsupported and has been preserved. This run stays in memory until you start a new company.</Callout>}
    {complete && <Callout compact tone="success" icon="goal" kicker="Phone campaign complete">{scope.endOfGuided} Challenge Mode is unlocked.</Callout>}
    <MenuActions onResume={onResume}>
      <MenuTile icon="info" kind="users" title="How to play" text="Replay the walkthrough: controls, game time and finances." onClick={() => useGame.getState().startTour("campaign")} />
      {ended && <MenuTile icon="refresh" title={confirmNew ? "Lose this company? Press again" : "New company"} text="Start a new Guided Mode company." danger={confirmNew}
        onClick={() => { if (!confirmNew) { setConfirmNew(true); return; } useGame.getState().newRun(); setConfirmNew(false); }} />}
      <MenuTile icon="logout" title="Exit" text="Return to the title screen." onClick={exit.exit} buttonRef={exit.exitButton} />
    </MenuActions>
    <PhoneModeSwitch to="classic" />
  </>;
}

/** Challenge Mode: Resume, the guided first week and a new game, each replacing the run only on a second press. */
function ChallengeActions({ onResume }: { onResume: () => void }) {
  const inProgress = useGame((s) => !s.game.outcome && s.game.totals.weeks > 0);
  const [confirm, setConfirm] = useState<"new" | "tutorial" | null>(null);
  const start = (kind: "new" | "tutorial") => {
    if (inProgress && confirm !== kind) { setConfirm(kind); return; }
    setConfirm(null);
    if (kind === "tutorial") useGame.getState().startTutorialRun();
    else useGame.getState().newRun({});
  };
  const label = (kind: "new" | "tutorial", text: string) => (confirm === kind ? "Lose this run? Press again" : text);
  return <>
    <MenuActions onResume={onResume}>
      <MenuTile icon="robot" kind="go" title={label("tutorial", "Tutorial")} text="Replay the guided first week." danger={confirm === "tutorial"} onClick={() => start("tutorial")} />
      <MenuTile icon="play" title={label("new", "New game")} text="Start a new 26-week run." danger={confirm === "new"} onClick={() => start("new")} />
    </MenuActions>
    {confirm && <Callout compact tone="warn" icon="alert" kicker="Are you sure?">This replaces your current run. Press the button again to confirm.</Callout>}
    <PhoneModeSwitch to="campaign" />
  </>;
}

/** The mode switch with the phone edition's lock and wording. */
function PhoneModeSwitch({ to }: { to: "campaign" | "classic" }) {
  const available = useGame(challengeAvailable);
  const scope = useGame((s) => s.scope);
  return <ModeSwitch to={to} locked={to === "classic" && !available} lockedText={scope.challengeLocked} lockedLabel="Finish both guided chapters to unlock" about={PHONE_ABOUT[to]} />;
}
