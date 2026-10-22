import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { campaignAttention, guidanceActionId, incidentNeedsPause, type GuidanceTarget } from "@/game/campaignAttention";
import { previewCampaignAction } from "@/game/campaignFinance";
import { campaignClockAvailable, useGame } from "@/game/store";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { watchIdleAttention } from "./idleAttention";
import { Icon } from "./icons";
import { tipProps } from "./tips";
import "./CampaignAttention.css";
import { CampaignAttentionContext, useCampaignAttention } from "./useCampaignAttention";
import { chapter4Stage } from "@/game/chapter4Guidance";
import { chapter6Stage } from "@/game/chapter6Guidance";
import { Chapter4StagePopup, Chapter6StagePopup } from "./Chapter4StagePopup";
import { chapterCompanyMessage } from "@/game/chapterCompanyMessage";
import { ChapterCompanyMessage } from "./ChapterCompanyMessage";

function visibleControl(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(node => {
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
  }) ?? null;
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
};

/** What opens the folded equipment and actions: the desktop panel's reopen button, or the phone sheet's handle at peek. */
const PANEL_ENTRY = '.panel-reopen, .phone-sheet-handle[aria-expanded="false"]';

/** One ephemeral owner for the header, dock, idle timer and explicitly accepted control attention. */
export function CampaignAttentionHost({ children }: { children: ReactNode }) {
  const game = useGame(s => s.game), started = useGame(s => s.started), running = useGame(s => s.running);
  const tour = useGame(s => s.tour), practice = useGame(s => s.tutorialCompany), generation = useGame(s => s.generation);
  const view = useGame(s => s.view), selected = useGame(s => s.selected), panel = useGame(s => s.panelOpen), floor = useGame(s => s.floor);
  const clockAvailable = useGame(campaignClockAvailable);
  const confirming = useSyncExternalStore(subscribeConfirming, confirmingAction);
  const [covered, setCovered] = useState(false), [hidden, setHidden] = useState(document.hidden);
  const [risk, setRisk] = useState(false), [locked, setLocked] = useState(false), [idle, setIdle] = useState<string | null>(null);
  const [focused, setFocused] = useState(() => document.hasFocus());
  const [opened, setOpened] = useState<string | null>(null), [accepted, setAccepted] = useState<string | null>(null);
  const [growthChoice, setGrowthChoice] = useState<{ key: string; risk: boolean } | null>(null);
  const [pauseOffer, updatePauseOffer] = useState<string | null>(null);
  const pauseToken = useRef<string | null>(null);
  const setPauseOffer = useCallback((offer: string | null) => { pauseToken.current = offer; updatePauseOffer(offer); }, []);
  const manual = useRef({ accepted, opened, key: "", pauseBlocked: false });
  const button = useRef<HTMLButtonElement>(null), card = useRef<HTMLDivElement>(null);
  const revealedTarget = useRef<HTMLElement | null>(null);
  const markedTarget = useRef<HTMLElement | null>(null);
  const decision = useMemo(() => campaignAttention(game), [game]);
  const spikeStage = chapter4Stage(game);
  const growthStage = chapter6Stage(game);
  const companyMessage = chapterCompanyMessage(game);
  const available = !!game.campaign && started && tour?.track !== "campaign" && !practice;
  // Capturing the room's mouse blocks optional help, not an urgent Pause invitation.
  const pauseBlocked = covered || !!confirming || risk || !!tour || !!practice || hidden || !focused;
  const blocked = pauseBlocked || locked;
  const key = `${generation}:${decision.key}`;
  const choices = decision.growthChoices;
  const chooseRisk = choices && (growthChoice?.key === key ? growthChoice.risk : !choices.upgrade);
  const recommendedAction = choices ? chooseRisk ? undefined : choices.upgrade : decision.action;
  const guidanceTarget = choices ? chooseRisk ? "risk" : choices.upgrade ? "db" : "requirements" : decision.target;
  const riskConfirmation = available && risk && !confirming && !covered && !tour && !hidden && !locked && focused && decision.reason === "scaling-choice" && !!choices?.risk && previewCampaignAction(game, { type: "accept_scaling_risk" }).ok;
  const actionSelector = recommendedAction ? `[data-guidance-action="${guidanceActionId(recommendedAction.action)}"]` : "";
  const selectedInspection = decision.target === "db" && selected === "db" ? "Database" : decision.target === "app" && selected === "app" ? "Servers" : decision.target === "network" && selected === "gateway" ? "Network" : decision.target === "monitoring" && selected === "monitoring" ? "Monitoring" : null;
  const targetSelector = recommendedAction ? `${actionSelector}.campaign-action-card > button.act, button${actionSelector}` : selectedInspection ? ".campaign-panel .equipment-readings > details > summary" : guidanceTarget ? TARGETS[guidanceTarget] : "";
  const acceptedNow = accepted === key;
  const spotlightSelector = riskConfirmation ? '[data-guidance="accept_scaling_risk"]' : targetSelector;
  const openNow = opened === key && available && !blocked;
  const incidentKey = `${generation}:${game.campaign?.runId}:${game.campaign?.incident?.id}`;
  const pauseDiagnosis = incidentNeedsPause(game, decision);
  const pauseGold = available && !pauseBlocked && !view && !openNow && !acceptedNow && running && clockAvailable && pauseDiagnosis && pauseOffer === incidentKey;
  const timerKey = `${key}:${view}:${selected}:${panel}:${floor}:${running}`;
  const candidate = available && !blocked && !view && !openNow && !acceptedNow && !pauseGold && (decision.attention === "progression" || decision.attention === "hint" || decision.attention === "run" && !running && clockAvailable);

  useLayoutEffect(() => { manual.current = { accepted, opened, key, pauseBlocked }; }, [accepted, opened, key, pauseBlocked]);
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
      const modal = !!document.querySelector('.modal-backdrop');
      setCovered(modal);
      setHidden(document.hidden);
      setLocked(!!document.pointerLockElement);
      if (modal || document.hidden) clear();
      else if (document.pointerLockElement) { setOpened(null); setAccepted(null); }
    };
    const unsubscribe = useGame.subscribe((s, before) => {
      if (s.tour !== before.tour || s.tutorialCompany !== before.tutorialCompany || s.generation !== before.generation || s.started !== before.started || s.running !== before.running) clear();
      if (s.view !== before.view || pauseToken.current && s.game !== before.game && !incidentNeedsPause(s.game)) setPauseOffer(null);
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
    if (!riskConfirmation && (!acceptedNow || !available || blocked || !guidanceTarget || guidanceTarget === "run" && running)) return;
    let target: HTMLElement | null = null;
    const clear = () => { target?.classList.remove("campaign-gold-attention"); if (markedTarget.current === target) markedTarget.current = null; target = null; };
    const update = () => {
      clear();
      const final = document.querySelector<HTMLElement>(spotlightSelector);
      const scale = recommendedAction?.action.type === "scale_up" ? recommendedAction.action.appId : null;
      const stepSelector = scale && !final ? selected !== "app" ? TARGETS.app : `[data-guidance-app="${scale}"]` : null;
      const desired = final ?? (stepSelector ? document.querySelector<HTMLElement>(stepSelector) : null);
      const closed = desired?.closest("details:not([open])");
      const node = closed?.querySelector<HTMLElement>("summary") ?? desired;
      // Only an explicitly accepted sequence may reveal an existing inspector control.
      // Scroll once per destination, never on ordinary scrolling or passive metrics.
      if (!view && panel && node && node !== revealedTarget.current && node.closest(".side:not([hidden])") && node.getClientRects().length && getComputedStyle(node).visibility !== "hidden") {
        revealedTarget.current = node;
        const margin = node.style.scrollMarginBlock;
        node.style.scrollMarginBlock = "8px";
        node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
        node.style.scrollMarginBlock = margin;
      }
      if (node) node.dataset.guidanceStep = "true";
      target = (guidanceTarget === "run" && !clockAvailable ? null : !closed ? visibleControl(spotlightSelector) : null) ?? (node ? visibleControl('[data-guidance-step="true"]') : null) ?? visibleControl('.sheet-head button[aria-label="Close"]') ??
        (guidanceTarget !== "run" && guidanceTarget !== "next" && guidanceTarget !== "requirements" && guidanceTarget !== "menu" && guidanceTarget !== "finance" ? visibleControl(PANEL_ENTRY) : null);
      if (node) delete node.dataset.guidanceStep;
      target?.classList.add("campaign-gold-attention");
      markedTarget.current = target;
    };
    const interact = (event: Event) => { if (event.target instanceof Node && target?.contains(event.target) && target.matches(spotlightSelector)) setAccepted(null); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.querySelector(".equipment-shell") ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "disabled", "hidden"] });
    window.addEventListener("resize", update); document.addEventListener("scroll", update, true);
    document.addEventListener("click", interact, true);
    return () => { clear(); observer.disconnect(); document.querySelectorAll('[data-guidance-step]').forEach(n => n.removeAttribute('data-guidance-step')); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true); document.removeEventListener("click", interact, true); };
  }, [acceptedNow, available, blocked, guidanceTarget, spotlightSelector, key, panel, view, running, clockAvailable, selected, recommendedAction, riskConfirmation]);

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
  const context = { available, confirmationGold: available && !!confirming && !covered && !tour && !hidden && !locked && focused, pauseGold, runGold: candidate && idle === timerKey && decision.attention === "run", hintGold: candidate && idle === timerKey && decision.attention === "hint", opened: openNow, button, riskOpen,
    openHint: () => { if (!blocked) { setPauseOffer(null); setAccepted(null); setGrowthChoice(null); setIdle(null); setOpened(openNow ? null : key); } } };
  const close = () => { setOpened(null); button.current?.focus(); };
  return <CampaignAttentionContext.Provider value={context}>{children}
    {companyMessage && <ChapterCompanyMessage key={companyMessage.key} model={companyMessage} enabled={available && !blocked && !view && !openNow && !acceptedNow && !pauseGold && !game.campaign?.incident && game.phase === "management" && !decision.reason.match(/^(review|next)$/)}>
    {growthStage &&
      <Chapter6StagePopup key={`${growthStage.key}:${growthStage.stage}`} model={growthStage} />}
    {spikeStage &&
      <Chapter4StagePopup key={`${spikeStage.key}:${spikeStage.stage}`} model={spikeStage} />}
    </ChapterCompanyMessage>}
    {openNow && createPortal(<div ref={card} id="campaign-hint-card" className="campaign-hint-card" role="dialog" aria-modal="false" aria-label="Hint" tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="campaign-hint-heading"><h3><Icon name="bulb" />Hint</h3><button type="button" className="icon-btn" aria-label="Close Hint" onClick={close}><Icon name="close" /></button></div>
      <div className="campaign-hint-copy" role="region" aria-label="Hint explanation" tabIndex={0}><p>{decision.target === "run" && running ? decision.message.replace("Press Run", "Keep running") : selectedInspection && !recommendedAction ? `Check About ${selectedInspection} to understand the readings before choosing a response.` : decision.message}</p></div>
      <button type="button" className="btn btn-primary" onClick={() => { close(); revealedTarget.current = null; setAccepted(key); }}>{choices?.upgrade ? "Upgrade database" : choices?.risk ? "Accept risk" : "Got it"}</button>
      {choices?.upgrade && choices.risk && <button type="button" className="btn" onClick={() => { close(); revealedTarget.current = null; setGrowthChoice({ key, risk: true }); setAccepted(key); }}>Accept risk</button>}
    </div>, document.body)}
  </CampaignAttentionContext.Provider>;
}

export function CampaignHintButton() {
  const { available, button, opened, hintGold, openHint } = useCampaignAttention();
  return available ? <button ref={button} type="button" className={`icon-btn campaign-hint${hintGold ? " campaign-gold-attention" : ""}`} aria-label="Hint" aria-haspopup="dialog" aria-expanded={opened} aria-controls={opened ? "campaign-hint-card" : undefined} {...tipProps("Need help? See what to try next.", "below")} data-tip-title="Hint" onClick={openHint}><Icon name="bulb" /></button> : null;
}
