import { introductionActive } from "@/sim/introduction";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { campaignAttention, guidanceActionId, incidentNeedsPause, spotlightMachines, type GuidanceTarget } from "@/game/campaignAttention";
import { previewCampaignAction } from "@/game/campaignFinance";
import type { Action, EquipmentId } from "@/sim";
import { campaignClockAvailable, useGame } from "@/game/store";
import { isPhoneEdition } from "@/phone/edition";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { watchIdleAttention } from "./idleAttention";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import { Spotlight } from "./SpotOverlay";
import { cardStyle, type Box, type Place } from "./spotlight";
import "./CampaignAttention.css";
import { CampaignAttentionContext, useCampaignAttention } from "./useCampaignAttention";
import { chapter4Stage } from "@/game/chapter4Guidance";
import { chapter6Stage } from "@/game/chapter6Guidance";
import { Chapter4StagePopup, Chapter6StagePopup } from "./Chapter4StagePopup";
import { chapterCompanyMessage } from "@/game/chapterCompanyMessage";
import { ChapterCompanyMessage } from "./ChapterCompanyMessage";

function visibleControl(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(controlVisible) ?? null;
}

function controlVisible(node: HTMLElement): boolean {
  if (node.matches(":disabled, [aria-disabled=true]") || node.closest("[hidden], [inert]")) return false;
  const box = node.getBoundingClientRect(), style = getComputedStyle(node);
  if (!box.width || !box.height || style.visibility === "hidden" || style.display === "none") return false;
  const x = box.left + box.width / 2, y = box.top + box.height / 2;
  if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) return false;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const clip = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    if (/auto|scroll|hidden|clip/.test(clip.overflowY) && (box.top < bounds.top || box.bottom > bounds.bottom)) return false;
    if (/auto|scroll|hidden|clip/.test(clip.overflowX) && (box.left < bounds.left || box.right > bounds.right)) return false;
  }
  const hit = document.elementFromPoint?.(x, y);
  return !hit || node.contains(hit);
}

/** The hole reaches a little past the framed control, like the tutorial's. */
function padBox(r: DOMRect): Box {
  const pad = 5;
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
  return { x, y, w: Math.min(innerWidth - 4, r.right + pad) - x, h: Math.min(innerHeight - 4, r.bottom + pad) - y };
}

const TARGETS: Record<GuidanceTarget, string> = {
  run: ".campaign-play",
  db: '.campaign-panel [data-tutorial="inspect-db"]',
  app: '.campaign-panel [data-tutorial="inspect-app"]',
  network: '.campaign-panel [data-tutorial="inspect-gateway"]',
  monitoring: '.campaign-panel [data-tutorial="inspect-monitoring"]',
  requirements: ".chapter-actions > button:last-child",
  next: ".chapter-advance",
  reliability: '[data-guidance="arm_reliability"]',
  growth: '[data-guidance="start_growth_wave"]',
  risk: '[aria-label="Scaling growth risk"] > button',
  menu: ".menu-btn",
  finance: '[aria-label="View finances"]',
  endweek: ".dock-rush",
  research: '[aria-label="Launch Week research"]',
};

/** Presentation routing only: the resolver still chooses and validates the action. */
function actionEquipment(action:Action):EquipmentId|null {
  switch(action.type) {
    case "start_db_upgrade": return "db";
    case "deploy_cache": case "tune_cache": return "cache";
    case "add_server": case "scale_up": case "restore_app": case "install_spare":
    case "reserve_spare": case "release_spare": case "unlock_autoscaling": case "deploy_autoscaler": case "set_autoscaling": return "app";
    case "set_traffic_limit": case "deploy_load_balancer": case "set_routing":
    case "deploy_failover": case "set_failover": return "gateway";
    case "deploy_health_checks": return "monitoring";
    default: return null;
  }
}
function inspectionNavigation(action:Action|undefined,game:ReturnType<typeof useGame.getState>["game"],equipment:string|null,inEquipment:boolean,equipmentEntry:string) {
  const kind=action?.type;
  const server=action&&"appId" in action?action.appId:kind==="release_spare"?game.campaign?.reliabilityStage?.spareId:kind==="install_spare"?game.campaign?.apps[0]?.id:null;
  const section=kind&&["unlock_autoscaling","deploy_autoscaler","set_autoscaling"].includes(kind)?"autoscaling"
    :kind==="deploy_load_balancer"?"balancing":kind==="set_routing"?"routing":kind&&["deploy_failover","set_failover"].includes(kind)?"failover":null;
  const selectors=inEquipment?[...(server?[`[data-guidance-app="${server}"]`]:[]),...(section?[`[data-inspection-entry="${section}"]`]:[]),...((equipment==="gateway"&&section||equipment==="app"&&(server||section))?['[data-inspection-entry="management"]']:[]),...(equipment==="monitoring"?['[data-inspection-details]']:[]),'[data-inspection-back]']:equipment?[equipmentEntry]:[];
  return selectors.map(selector=>document.querySelector<HTMLElement>(`.component-inspection ${selector}`)??(!inEquipment?document.querySelector<HTMLElement>(selector):null)).find(node=>node);
}
const blockingModal = () => [...document.querySelectorAll(".modal-backdrop")].some(node =>
  !node.querySelector(":scope > .component-inspection") && !node.closest(".component-inspection"));

/** What opens the folded equipment and actions: the desktop panel's reopen button, or the phone sheet's handle at peek. */
const PANEL_ENTRY = '.panel-reopen, .phone-sheet-handle[aria-expanded="false"]';

/** One ephemeral owner for the header, dock, idle timer and explicitly accepted control attention. */
/** Scrolls a control fully into its panel with a small margin; a short panel does not always take `scrollIntoView`. */
function reveal(node: HTMLElement) {
  const margin = node.style.scrollMarginBlock;
  node.style.scrollMarginBlock = "8px";
  node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
  node.style.scrollMarginBlock = margin;
  const side = node.closest<HTMLElement>(".side");
  if (!side) return;
  const box = node.getBoundingClientRect(), port = side.getBoundingClientRect();
  if (box.top < port.top + 8) side.scrollTop -= port.top + 8 - box.top;
  else if (box.bottom > port.bottom - 8) side.scrollTop += Math.min(box.bottom - port.bottom + 8, box.top - port.top - 8);
}

export function CampaignAttentionHost({ children }: { children: ReactNode }) {
  const game = useGame(s => s.game), started = useGame(s => s.started), running = useGame(s => s.running);
  const tour = useGame(s => s.tour), practice = useGame(s => s.tutorialCompany), generation = useGame(s => s.generation);
  const view = useGame(s => s.view), selected = useGame(s => s.selected), panel = useGame(s => s.panelOpen), floor = useGame(s => s.floor);
  const inspection=useGame(s=>s.roomInspection);
  const clockAvailable = useGame(campaignClockAvailable);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const [covered, setCovered] = useState(false), [hidden, setHidden] = useState(document.hidden);
  const [risk, setRisk] = useState(false), [locked, setLocked] = useState(false), [idle, setIdle] = useState<string | null>(null);
  const [focused, setFocused] = useState(() => document.hasFocus());
  const [opened, setOpened] = useState<string | null>(null), [accepted, setAccepted] = useState<string | null>(null);
  const [growthChoice, setGrowthChoice] = useState<{ key: string; risk: boolean } | null>(null);
  // Launch Week teaches with spotlighted tutorial steps instead of the Hint button.
  const [launchDone, setLaunchDone] = useState<string | null>(null), [metricsSeen, setMetricsSeen] = useState<string | null>(null);
  const [analyticsSeen, setAnalyticsSeen] = useState<string | null>(null);
  const [spotBox, setSpotBox] = useState<Box | null>(null), [introOpen, setIntroOpen] = useState(false);
  const litTarget = useRef<HTMLElement | null>(null);
  const [pauseOffer, updatePauseOffer] = useState<string | null>(null);
  const pauseToken = useRef<string | null>(null);
  const setPauseOffer = useCallback((offer: string | null) => { pauseToken.current = offer; updatePauseOffer(offer); }, []);
  const manual = useRef({ accepted, opened, key: "", pauseBlocked: false, equipment: null as string|null });
  const button = useRef<HTMLButtonElement>(null), card = useRef<HTMLDivElement>(null);
  const revealedTarget = useRef<HTMLElement | null>(null);
  const markedTarget = useRef<HTMLElement | null>(null);
  const decision = useMemo(() => campaignAttention(game), [game]);
  const spikeStage = chapter4Stage(game);
  const growthStage = chapter6Stage(game);
  const companyMessage = chapterCompanyMessage(game);
  const intro=introductionActive(game.campaign);
  const available = !!game.campaign && started && (!practice||intro);
  // Capturing the room's mouse blocks optional help, not an urgent Pause invitation.
  const pauseBlocked = covered || !!confirming || risk || !!tour || !!practice&&!intro || hidden || !focused;
  const blocked = pauseBlocked || locked;
  const key = `${generation}:${decision.key}`;
  const choices = decision.growthChoices;
  const chooseRisk = choices && (growthChoice?.key === key ? growthChoice.risk : !choices.upgrade);
  const recommendedAction = choices ? chooseRisk ? undefined : choices.upgrade : decision.action;
  const guidanceTarget = choices ? chooseRisk ? "risk" : choices.upgrade ? "db" : "requirements" : decision.target;
  const riskConfirmation = available && risk && !confirming && !covered && !tour && !hidden && !locked && focused && decision.reason === "scaling-choice" && !!choices?.risk && previewCampaignAction(game, { type: "accept_scaling_risk" }).ok;
  const actionSelector = recommendedAction ? `[data-guidance-action="${guidanceActionId(recommendedAction.action)}"]` : "";
  const lw = game.campaign?.launchWeek;
  // The research step outlives the week's end: the score card waits for the pick.
  const launchTutorial = !!lw && !lw.introduction && (lw.completedStep === null || !!lw.researchEarned && !lw.tech);
  // The introduction teaches the equipment; Opening then teaches observation and a real upgrade.
  // Historical companies retain the guidance they already completed instead of replaying this handoff.
  const openingTutorial = decision.chapter === 1 && !!game.campaign?.completedIntroduction && !lw && !game.campaign.openingMilestone?.acknowledged;
  const automaticTutorial = launchTutorial || openingTutorial;
  const analyticsKey = `${generation}:${game.campaign?.runId}:opening-metrics`;
  const analyticsStep = openingTutorial && game.campaign!.step > 0 && analyticsSeen !== analyticsKey && !inspection && !game.campaign!.pending.length;
  const lwIncident = lw && lw.completedStep === null ? game.campaign!.incident : null;
  const metricsKey = lwIncident ? `${lwIncident.id}:${decision.reason}` : openingTutorial ? `${generation}:${game.campaign!.runId}:${game.campaign!.incident?.id ?? "prevention"}:${decision.reason}` : "";
  // After inspecting the overloaded machine, its readings come first, then its fix.
  const metricsStep = (!!lwIncident || openingTutorial && !!inspection) && metricsSeen !== metricsKey &&
    (decision.reason === "application" && selected === "app" || decision.reason === "database" && selected === "db");

  const equipment = recommendedAction ? actionEquipment(recommendedAction.action) :
    guidanceTarget === "network" ? "gateway" : ["app","db","monitoring"].includes(guidanceTarget??"") ? guidanceTarget : null;
  const equipmentEntry = equipment ? `.campaign-panel [data-tutorial="inspect-${equipment}"]` : "";
  const inEquipment = !!equipment && inspection?.equipment === equipment;
  const actionControl = `${actionSelector}.campaign-action-card > button.act, button${actionSelector}`;
  const targetSelector = intro ? equipment ? equipmentEntry : "[data-introduction-complete]" : analyticsStep ? ".campaign-panel .incident-symptoms" : metricsStep ? ".component-inspection .component-inspection-summary" : inEquipment ? recommendedAction ? actionControl : '.component-inspection-controls > button' : equipment ? equipmentEntry : recommendedAction ? actionControl : guidanceTarget ? TARGETS[guidanceTarget] : "";
  const acceptedNow = accepted === key;
  const spotlightSelector = riskConfirmation ? '[data-guidance="accept_scaling_risk"]' : targetSelector;
  const openNow = opened === key && available && !blocked;
  const incidentKey = `${generation}:${game.campaign?.runId}:${game.campaign?.incident?.id}`;
  const pauseDiagnosis = incidentNeedsPause(game, decision);
  const pauseGold = !inspection && available && !pauseBlocked && !view && !openNow && !acceptedNow && running && clockAvailable && pauseDiagnosis && pauseOffer === incidentKey;
  const timerKey = `${key}:${view}:${selected}:${panel}:${floor}:${running}`;
  const launchStep = intro ? available&&!blocked&&!view&&!inspection&&!openNow&&!acceptedNow&&!introOpen : automaticTutorial && available && !blocked && !view && !openNow && !acceptedNow && !pauseGold && !introOpen && (analyticsStep || launchDone !== key) && decision.attention !== null &&
    (analyticsStep || (openingTutorial ? OPENING_FLOW : LAUNCH_FLOW).test(decision.reason)) && (analyticsStep || !(decision.attention === "run" && (running || !clockAvailable)));
  const machines = useMemo(() => launchStep && !analyticsStep ? spotlightMachines(decision, recommendedAction?.action, game.campaign ?? null) : [], [launchStep, analyticsStep, decision, recommendedAction, game.campaign]);
  const candidate = !intro && !inspection && !automaticTutorial && available && !blocked && !view && !openNow && !acceptedNow && !pauseGold && (decision.attention === "progression" || decision.attention === "hint" || decision.attention === "run" && !running && clockAvailable);

  useLayoutEffect(() => { manual.current = { accepted, opened, key, pauseBlocked, equipment }; }, [accepted, opened, key, pauseBlocked, equipment]);
  useEffect(() => {
    if (!pauseGold) return;
    // Any deliberate interaction acknowledges this one-time invitation; ordinary hover does not.
    const dismiss = (event: Event) => {
      // Releasing the captured mouse (Escape) and held movement-key repeats do not
      // acknowledge an incident the player has only just been shown.
      if (event instanceof KeyboardEvent && (event.key === "Escape" || event.repeat)) return;
      setPauseOffer(null);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
    for (const event of events) document.addEventListener(event, dismiss, { capture: true, passive: true });
    return () => { for (const event of events) document.removeEventListener(event, dismiss, true); };
  }, [pauseGold, setPauseOffer]);

  useLayoutEffect(() => {
    const clear = () => { setOpened(null); setAccepted(null); setPauseOffer(null); };
    const update = () => {
      const modal = blockingModal();
      setCovered(modal);
      setHidden(document.hidden);
      setLocked(!!document.pointerLockElement);
      if (modal || document.hidden) clear();
      else if (document.pointerLockElement) { setOpened(null); setAccepted(null); }
    };
    const unsubscribe = useGame.subscribe((s, before) => {
      if (s.tour !== before.tour || s.tutorialCompany !== before.tutorialCompany || s.generation !== before.generation || s.started !== before.started || s.running !== before.running) clear();
      if (s.view !== before.view || pauseToken.current && s.game !== before.game && !incidentNeedsPause(s.game)) setPauseOffer(null);
      if (s.game !== before.game) {
        const next=campaignAttention(s.game), previous=campaignAttention(before.game);
        const previousKey=`${before.generation}:${previous.key}`;
        if (manual.current.accepted===previousKey && previous.target===next.target && previous.reason===next.reason &&
          (previous.action?!!next.action&&guidanceActionId(previous.action.action)===guidanceActionId(next.action.action):!next.action))
          setAccepted(`${s.generation}:${next.key}`);
      }
      const c = s.game.campaign, prior = before.game.campaign;
      if (c?.incident && c.runId === prior?.runId && c.incident.id !== prior.incident?.id && s.generation === before.generation && s.started && s.running && !s.tour && !s.tutorialCompany && !s.view && !manual.current.pauseBlocked && !document.hidden && document.hasFocus()) {
        const next = campaignAttention(s.game), previous = campaignAttention(before.game);
        const previousKey = `${before.generation}:${previous.key}`;
        const sameAdvice = previous.target === next.target && previous.reason === next.reason &&
          (previous.action ? !!next.action && guidanceActionId(previous.action.action) === guidanceActionId(next.action.action) : !next.action);
        const activeManual = manual.current.key === previousKey && (manual.current.accepted === previousKey || manual.current.opened === previousKey);
        if (activeManual && sameAdvice) {
          // Preserve an already-accepted, still-valid investigation instead of stealing its attention.
          if (manual.current.accepted === previousKey) setAccepted(`${s.generation}:${next.key}`);
          if (manual.current.opened === previousKey) setOpened(`${s.generation}:${next.key}`);
        } else if (incidentNeedsPause(s.game, next) && !confirmingAction() && !document.querySelector(".modal-backdrop"))
          setPauseOffer(`${s.generation}:${c.runId}:${c.incident.id}`);
      }
      // Choosing a different component is a deliberate alternative; never force it closed.
      if (s.roomInspection !== before.roomInspection && s.roomInspection && manual.current.equipment && s.roomInspection.equipment !== manual.current.equipment)
        setAccepted(null);
      // An inspector navigation resets its own scroll even when React reuses the
      // same final button. Reveal it again after navigation, never after scrolling.
      if (s.selected !== before.selected || s.selectedAppId !== before.selectedAppId || s.panelOpen !== before.panelOpen || s.view !== before.view) revealedTarget.current = null;
    });
    const unconfirm = subscribeConfirming(() => { if (confirmingAction()) { revealedTarget.current = null; clear(); } });
    const observer = new MutationObserver(records => {
      if (records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n instanceof Element && (n.matches('.modal-backdrop') || n.querySelector('.modal-backdrop'))))) update();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const focus = () => setFocused(true), blur = () => { setFocused(false); clear(); };
    document.addEventListener("visibilitychange", update);
    document.addEventListener("pointerlockchange", update);
    window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    update();
    return () => { unsubscribe(); unconfirm(); observer.disconnect(); document.removeEventListener("visibilitychange", update); document.removeEventListener("pointerlockchange", update); window.removeEventListener("blur", blur); window.removeEventListener("focus", focus); };
  }, [setPauseOffer]);
  useEffect(() => {
    if (!candidate) return;
    return watchIdleAttention(active => setIdle(active && (decision.attention === "progression" || visibleControl(decision.attention === "run" ? ".campaign-play" : ".campaign-hint")) ? timerKey : null));
  }, [candidate, timerKey, decision.attention]);
  // Same idle deadline and gold effect as Run/Hint. Never scroll or open UI automatically.
  // A folded inspector exposes its entry first; an off-screen choice falls back to manual help.
  useLayoutEffect(() => {
    if (!candidate || idle !== timerKey || decision.attention !== "progression" || !decision.target) return;
    let target: HTMLElement | null = null;
    const clear = () => { target?.classList.remove("campaign-gold-attention"); target = null; };
    const update = () => {
      clear();
      target = visibleControl(TARGETS[decision.target!]) ??
        (["risk", "reliability", "growth"].includes(decision.target!) ? visibleControl(PANEL_ENTRY) : null) ?? visibleControl(".campaign-hint");
      target?.classList.add("campaign-gold-attention");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled", "aria-disabled", "hidden", "open"] });
    window.addEventListener("resize", update); document.addEventListener("scroll", update, true);
    return () => { clear(); observer.disconnect(); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true); };
  }, [candidate, idle, timerKey, decision.attention, decision.target]);
  // A Launch Week step frames its control at once; only the step's own button or using that control moves on.
  useLayoutEffect(() => {
    if (!launchStep) return;
    let frame = 0;
    const clear = () => {
      if (litTarget.current) { delete litTarget.current.dataset.spotlight; litTarget.current.classList.remove("campaign-gold-attention"); litTarget.current = null; }
      setSpotBox(null);
    };
    const update = () => {
      clear();
      if (!guidanceTarget && !recommendedAction) return;
      const desired = document.querySelector<HTMLElement>(spotlightSelector) ?? inspectionNavigation(recommendedAction?.action,game,equipment,inEquipment,equipmentEntry);
      const closed = desired?.closest("details:not([open])");
      const node = closed?.querySelector<HTMLElement>("summary") ?? desired;
      if (!view && node && node !== revealedTarget.current && !controlVisible(node) && node.getClientRects().length) {
        // The panel resets its scroll in a passive effect when it mounts; reveal after that, or the reset undoes it.
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { revealedTarget.current = node; reveal(node); });
      }
      const target = (guidanceTarget === "run" && !clockAvailable && !analyticsStep ? null : !closed ? visibleControl(spotlightSelector) : null) ?? (node && controlVisible(node) ? node : null) ??
        (!intro && (analyticsStep || guidanceTarget !== "run" && guidanceTarget !== "endweek" && guidanceTarget !== "research") ? visibleControl(PANEL_ENTRY) : null);
      if (target) {
        setSpotBox(padBox(target.getBoundingClientRect()));
        target.dataset.spotlight = "true";
        target.classList.add("campaign-gold-attention");
        litTarget.current = target;
      } else if (node&&!intro&&!openingTutorial) setSpotBox(padBox(node.getBoundingClientRect()));
    };
    const used = (event: Event) => {
      if (analyticsStep) return;
      const lit = litTarget.current, el = event.target instanceof Element ? event.target : null;
      if (lit && el && lit.contains(el) && lit.matches(spotlightSelector) && !lit.matches(".equipment-readings, .component-inspection-summary, [data-tutorial^=inspect-], [data-inspection-entry], [data-inspection-back], [data-guidance-app]")) setLaunchDone(key);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "disabled", "hidden"] });
    window.addEventListener("resize", update); document.addEventListener("scroll", update, true); document.addEventListener("transitionend", update, true);
    document.addEventListener("click", used, true);
    return () => { clear(); cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true); document.removeEventListener("transitionend", update, true); document.removeEventListener("click", used, true); };
  }, [launchStep, guidanceTarget, recommendedAction, spotlightSelector, key, view, clockAvailable, game, equipment, inEquipment, equipmentEntry, intro, analyticsStep, openingTutorial]);
  // The room's beams and dimmed racks follow the same spotlight.
  useEffect(() => {
    useGame.getState().setSpotlight(machines);
    return () => useGame.getState().setSpotlight([]);
  }, [machines]);
  const riskOpen = useCallback((open: boolean) => { setRisk(open); if (open) { setOpened(null); setAccepted(null); setPauseOffer(null); } }, [setPauseOffer]);

  // Remove accepted gold before a higher-priority Confirm can paint. Reveal itself
  // stays passive so the inspector's existing selection reset runs first.
  useLayoutEffect(() => {
    if (!riskConfirmation && (blocked || !acceptedNow)) {
      markedTarget.current?.classList.remove("campaign-gold-attention");
      markedTarget.current = null;
    }
  }, [blocked, acceptedNow, riskConfirmation]);

  // The inspector resets its scroll in a passive effect on selection. Reveal after
  // that existing child effect, so intermediate instance selection remains visible.
  useEffect(() => {
    if (intro&&inspection)return;
    if (!riskConfirmation && (!acceptedNow || !available || blocked || !guidanceTarget || guidanceTarget === "run" && running)) return;
    let target: HTMLElement | null = null;
    const clear = () => { target?.classList.remove("campaign-gold-attention"); if (markedTarget.current === target) markedTarget.current = null; target = null; };
    const update = () => {
      clear();
      const final = document.querySelector<HTMLElement>(spotlightSelector);
      const step=inspectionNavigation(recommendedAction?.action,game,equipment,inEquipment,equipmentEntry);
      const desired=final??step;
      const closed = desired?.closest("details:not([open])");
      const node = closed?.querySelector<HTMLElement>("summary") ?? desired;
      // Only an explicitly accepted sequence may reveal an existing inspector control.
      // Scroll once per destination, never on ordinary scrolling or passive metrics.
      if (!view && panel && node && node !== revealedTarget.current && node.closest(".side:not([hidden]), .component-inspection") && node.getClientRects().length && getComputedStyle(node).visibility !== "hidden") {
        revealedTarget.current = node;
        reveal(node);
      }
      if (node) node.dataset.guidanceStep = "true";
      target = (inspection && equipment && !inEquipment ? visibleControl('.component-inspection > .modal-head button[aria-label="Close"]') : null) ?? (guidanceTarget === "run" && !clockAvailable ? null : !closed ? visibleControl(spotlightSelector) : null) ?? (node ? visibleControl('[data-guidance-step="true"]') : null) ?? visibleControl('.sheet-head [data-return-to-room]') ??
        (guidanceTarget !== "run" && guidanceTarget !== "next" && guidanceTarget !== "requirements" && guidanceTarget !== "menu" && guidanceTarget !== "finance" ? visibleControl(PANEL_ENTRY) : null);
      if (node) delete node.dataset.guidanceStep;
      target?.classList.add("campaign-gold-attention");
      markedTarget.current = target;
    };
    const interact = (event: Event) => { if (event.target instanceof Node && target?.contains(event.target) && target.matches(spotlightSelector) && (inEquipment || !equipment)) setAccepted(null); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "disabled", "hidden"] });
    window.addEventListener("resize", update); document.addEventListener("scroll", update, true);
    document.addEventListener("click", interact, true);
    return () => { clear(); observer.disconnect(); document.querySelectorAll('[data-guidance-step]').forEach(n => n.removeAttribute('data-guidance-step')); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true); document.removeEventListener("click", interact, true); };
  }, [acceptedNow, available, blocked, guidanceTarget, spotlightSelector, key, panel, view, running, clockAvailable, selected, recommendedAction, riskConfirmation, equipment, inEquipment, equipmentEntry, inspection, game, intro]);

  useLayoutEffect(() => {
    if (!openNow) return;
    const place = () => {
      if (!card.current || !button.current) return;
      const box = button.current.getBoundingClientRect(), header = document.querySelector(".chapter-bar")?.getBoundingClientRect();
      const node = card.current;
      node.style.width = `${Math.min(320, innerWidth - 24)}px`;
      node.style.left = `${Math.max(12, Math.min(innerWidth - node.offsetWidth - 12, box.right - node.offsetWidth))}px`;
      const top = Math.max(box.bottom + 8, header?.bottom ?? 0);
      const dockTop = document.querySelector(".bottombar")?.getBoundingClientRect().top ?? innerHeight;
      node.style.top = `${top}px`; node.style.maxHeight = `${Math.max(44, Math.min(innerHeight - 12, dockTop - 8) - top)}px`;
    };
    place(); card.current?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !card.current?.contains(event.target) && !button.current?.contains(event.target)) setOpened(null); };
    window.addEventListener("resize", place); document.addEventListener("pointerdown", outside, true);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside, true); };
  }, [openNow]);
  const context = { available: available && !launchTutorial, confirmationGold: available && !!confirming && !covered && !tour && !hidden && !locked && focused, pauseGold, runGold: candidate && idle === timerKey && decision.attention === "run", hintGold: candidate && idle === timerKey && decision.attention === "hint", opened: openNow, button, riskOpen,
    openHint: () => { if (!blocked) { setPauseOffer(null); setAccepted(null); setGrowthChoice(null); setIdle(null); setOpened(openNow ? null : key); } } };
  const close = () => { setOpened(null); button.current?.focus(); };
  const compactOpeningPrompt = openingTutorial && isPhoneEdition() ? analyticsStep
    ? "Compare latency, errors and backlog. Pause to inspect."
    : metricsStep ? "Demand exceeds capacity. Next shows the matching upgrade."
    : decision.reason === "opening-growth" ? "Press Run to advance time and watch customer demand."
    : decision.reason.startsWith("activation-") ? "Press Run to finish the install, then check the readings."
    : decision.reason === "database" ? "Inspect Database, then choose an upgrade to handle more work."
    : null : null;
  return <CampaignAttentionContext.Provider value={context}>{children}
    {companyMessage && <ChapterCompanyMessage key={companyMessage.key} model={companyMessage} onOpen={setIntroOpen} enabled={!inspection && (launchTutorial
      // Launch Week's colleague introduction comes once, before the first Run.
      ? available && !blocked && !view && !running && game.phase === "management" && !game.campaign!.incident && game.campaign!.step === 0
      : available && !blocked && !view && !openNow && !acceptedNow && !pauseGold && !game.campaign?.incident && game.phase === "management" && !decision.reason.match(/^(review|next)$/))}>
    {growthStage &&
      <Chapter6StagePopup key={`${growthStage.key}:${growthStage.stage}`} model={growthStage} />}
    {spikeStage &&
      <Chapter4StagePopup key={`${spikeStage.key}:${spikeStage.stage}`} model={spikeStage} />}
    </ChapterCompanyMessage>}
    {launchStep && spotBox && createPortal(<Spotlight box={spotBox} track="guidance" />, document.body)}
    {launchStep && !intro && createPortal(<LaunchTutorialCard box={spotBox} label={openingTutorial ? "Chapter 1 guide" : undefined} place={!analyticsStep && (guidanceTarget === "run" || guidanceTarget === "menu") ? "top" : "left"} title={analyticsStep ? "Watch your service" : metricsStep ? "Read the metrics" : openingTutorial && decision.reason === "opening-growth" ? "Run, then observe" : launchStepTitle(decision.reason, recommendedAction?.action.type)}
      prompt={compactOpeningPrompt ?? (analyticsStep ? "Latency: response time. Errors: failed requests. Backlog: waiting work. Pause to inspect these readings." : metricsStep ? decision.reason === "database" ? "Database demand is above its capacity, so work queues up and requests fail. That is the overload." : "App Server demand is above its capacity, so requests pile up as backlog and fail. That is the overload." : openingTutorial && decision.reason === "opening-growth" ? "Press Run to advance game time. Customers bring requests; compare their demand with your equipment's capacity." : decision.target === "run" && running ? decision.message.replace("Press Run", "Keep running") : decision.message)}
      why={compactOpeningPrompt || analyticsStep ? undefined : metricsStep ? "Press Next to see how to fix it. Review the price and activation delay before confirming." : decision.observation !== decision.message ? decision.observation : undefined}
      doneLabel={analyticsStep || metricsStep ? "Next" : undefined} onDone={() => analyticsStep ? setAnalyticsSeen(analyticsKey) : metricsStep ? setMetricsSeen(metricsKey) : setLaunchDone(key)} />, document.body)}
    {openNow && createPortal(<div ref={card} id="campaign-hint-card" className="campaign-hint-card" role="dialog" aria-modal="false" aria-label="Hint" tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="campaign-hint-heading"><h3><Icon name="bulb" />Hint</h3><button type="button" className="icon-btn" aria-label="Close Hint" onClick={close}><Icon name="close" /></button></div>
      <div className="campaign-hint-copy" role="region" aria-label="Hint explanation" tabIndex={0}><p>{decision.target === "run" && running ? decision.message.replace("Press Run", "Keep running") : decision.message}</p></div>
      <button type="button" className="btn btn-primary" onClick={() => { close(); revealedTarget.current = null; setAccepted(key); }}>{choices?.upgrade ? "Upgrade database" : choices?.risk ? "Accept risk" : "Got it"}</button>
      {choices?.upgrade && choices.risk && <button type="button" className="btn" onClick={() => { close(); revealedTarget.current = null; setGrowthChoice({ key, risk: true }); setAccepted(key); }}>Accept risk</button>}
    </div>, document.body)}
  </CampaignAttentionContext.Provider>;
}

export function CampaignHintButton() {
  const { available, button, opened, hintGold, openHint } = useCampaignAttention();
  return available ? <button ref={button} type="button" className={`icon-btn campaign-hint${hintGold ? " campaign-gold-attention" : ""}`} aria-label="Hint" aria-haspopup="dialog" aria-expanded={opened} aria-controls={opened ? "campaign-hint-card" : undefined} {...tipProps("Need help? See what to try next.", "below")} data-tip-title="Hint" onClick={openHint}><Icon name="bulb" /></button> : null;
}

/** The Launch Week tutorial's steps: run, walk the incident through its fix, then skip the settled week. */
const LAUNCH_FLOW = /^(launch-open|launch-week|launch-research|launch-first-incident|launch-db-incident|launch-end-week|application|unrouted|database|recovery|draining|investigate|failure|activation-.+)$/;
const OPENING_FLOW = /^(opening-growth|prevention-inspection|prevention-stability|application|unrouted|database|recovery|draining|investigate|failure|activation-.+)$/;
const LAUNCH_STEP_TITLES: Record<string, string> = {
  "launch-open": "Open the doors", "launch-week": "Keep the week running", "launch-first-incident": "Your servers are overloading",
  "launch-db-incident": "Your database is overloading", "launch-end-week": "Skip to the end of the week", "launch-research": "Spend your research point",
  database: "Upgrade the database", recovery: "Recovering", draining: "Recovering", investigate: "Check the readings", failure: "A server failed",
};
function launchStepTitle(reason: string, action?: string): string {
  if (reason === "application") return action === "add_server" ? "Buy a second server" : action === "scale_up" ? "Keep up with traffic" : "Spread the load";
  if (reason === "unrouted") return action === "deploy_load_balancer" ? "Add a load balancer" : action === "set_routing" ? "Route traffic to both servers" : "Connect the new server";
  return LAUNCH_STEP_TITLES[reason] ?? (reason.startsWith("activation-") ? "Installing" : "Launch Week");
}

/** A Launch Week tutorial step, in the step tours' card, beside the control its spotlight frames. */
function LaunchTutorialCard({ box, place, title, prompt, why, label = "Launch Week tutorial", doneLabel = "Got it", onDone }: { box: Box | null; place: Place; title: string; prompt: string; why?: string; label?: string; doneLabel?: string; onDone: () => void }) {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const card = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(240);
  useLayoutEffect(() => {
    const read = () => {
      const measured = card.current?.getBoundingClientRect().height;
      if (measured) setHeight(previous => previous === measured ? previous : measured);
    };
    read();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    if (card.current) observer?.observe(card.current);
    return () => observer?.disconnect();
  }, [title, prompt, why]);
  useEffect(() => {
    const read = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  const topInset = (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) + 8;
  // A phone docks the step in its coach strip above the dock, like every other guide there.
  const style = isPhoneEdition() ? undefined : cardStyle(box, place, vp.w, vp.h, undefined, height, undefined, topInset);
  return <section ref={card} className="tour-card launch-tutorial" aria-label={label} style={style}>
    <h3>{title}</h3>
    <p className="tour-prompt" role="status">{prompt}</p>
    {why && <p className="muted tour-explanation">{why}</p>}
    <div className="tour-foot"><span /><button type="button" className="btn btn-primary btn-small" onClick={onDone}>{doneLabel}</button></div>
  </section>;
}
