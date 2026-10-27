import { useEffect, useRef } from "react";
import { watchCues } from "@/game/cues";
import { createAmbience } from "@/game/ambience";
import { createMusic, type Music } from "@/game/music";
import type { AudioSettings } from "@/game/persist";
import type { PlayScope } from "@/game/scope";
import { createSfx } from "@/game/sfx";
import { createSpeech } from "@/game/speech";
import { useGame } from "@/game/store";
import { fromAvatar } from "@/game/viewpoints";
import { incidentActive } from "@/sim/step";
import { daylightNow } from "./scene/dayClock";
import { entryGap, nextGap, viewFocus, ZONE_SOUNDS, zoneLevel, type ZoneSound } from "./scene/zoneSounds";
import { DOORS, FLOOR_Y, RIDE_SECONDS } from "./scene/levels";
import { onRide, ride } from "./scene/ride";
import { avatar } from "./scene/walk";
import { onSceneSound, onSceneSpeech } from "./scene/sceneSounds";
import { SPECIES } from "./scene/cast";
import { timbreOf, VOICE_PEAK, voiceOf } from "./scene/greetings";
import { buildModel } from "./scene/sceneModel";

/** Seconds between automatic weeks in Challenge Mode at normal speed. */
export const AUTO_SECONDS = 6;
const TICK_MS = 200;

/* ------------------------------------------------------------------ */
/* Runtime shared by every edition's shell                             */
/* ------------------------------------------------------------------ */

const musicLevel = (a: AudioSettings) => (a.muted ? 0 : a.music);
const effectsLevel = (a: AudioSettings) => (a.muted ? 0 : a.effects);

/** Background music once a run is on screen: calm while building, tense during an incident. */
function useMusic(): void {
  const level = useGame((s) => musicLevel(s.audio));
  const started = useGame((s) => s.started);
  // The same signal as the incident visuals: a Guided Mode failure can burn while the phase stays "management".
  const incident = useGame((s) => incidentActive(s.game));
  const music = useRef<Music | null>(null);
  useEffect(() => {
    const m = createMusic(() => musicLevel(useGame.getState().audio) > 0);
    music.current = m;
    return () => {
      m.dispose();
      music.current = null;
    };
  }, []);
  useEffect(() => music.current?.setVolume(level), [level]);
  useEffect(() => music.current?.setEnabled(started), [started]);
  useEffect(() => music.current?.setMood(incident ? "tense" : "calm"), [incident]);
}

/** How often the city's sound checks how dark it has got outside. */
const DUSK_CHECK_MS = 2000;
/** How often the zones' sounds check whether they are due, in milliseconds. */
const ZONE_TICK_MS = 200;

/**
 * How loud the server hall's fans and hum are, 0 to 1: silent with the office in view, and on the server floor from
 * a steady hum when the servers idle to the full whir under load.
 */
function hallLevel(s: ReturnType<typeof useGame.getState>): number {
  if (s.floor !== "servers") return 0;
  const load = Math.min(1, Math.max(0, (buildModel(s.game).flow - 0.25) / 0.75));
  return 0.55 + 0.45 * load;
}

/**
 * The city outside, heard under the game while a run is on screen: birds by day, crickets at night, following the
 * same clock as the light (see scene/dayClock.ts). On the server floor the hall's fans take over. It goes with the
 * sound-effects volume and mute.
 */
function useAmbience(): void {
  useEffect(() => {
    const a = createAmbience(() => effectsLevel(useGame.getState().audio) > 0);
    a.setVolume(effectsLevel(useGame.getState().audio));
    a.setDark(daylightNow().dark);
    a.setHall(hallLevel(useGame.getState()), 0);
    const stopFollowing = useGame.subscribe((s, prev) => {
      if (s.audio !== prev.audio) a.setVolume(effectsLevel(s.audio));
      if (s.started !== prev.started) a.setEnabled(s.started);
      // Crossfade over the elevator's ride.
      if (s.floor !== prev.floor) a.setHall(hallLevel(s), RIDE_SECONDS);
    });
    a.setEnabled(useGame.getState().started);
    const id = window.setInterval(() => {
      a.setDark(daylightNow().dark);
      a.setHall(hallLevel(useGame.getState()), 2);
    }, DUSK_CHECK_MS);
    return () => {
      window.clearInterval(id);
      stopFollowing();
      a.dispose();
    };
  }, []);
}

/**
 * Sound effects for what just happened in the game. Driven by a store
 * subscription rather than renders, so the volume is already set when a cue
 * plays and nothing is heard twice under StrictMode.
 */
function useSoundEffects(): void {
  useEffect(() => {
    const sfx = createSfx(() => effectsLevel(useGame.getState().audio) > 0);
    sfx.setVolume(effectsLevel(useGame.getState().audio));
    const speech = createSpeech();
    speech.setVolume(effectsLevel(useGame.getState().audio));
    const stopVolume = useGame.subscribe((s, prev) => {
      if (s.audio !== prev.audio) {
        sfx.setVolume(effectsLevel(s.audio));
        speech.setVolume(effectsLevel(s.audio));
      }
    });
    const stopCues = watchCues(useGame.subscribe, (cue) => sfx.play(cue));
    // The elevator: a click and the car's hum as it sets off, then the chime and the doors as it arrives.
    // Footsteps and doors, while the audio is already playing; a new avatar's pop answers the player's own choice.
    const stopScene = onSceneSound((cue, level) => sfx.playScene(cue, level));
    // What the crew say, in a voice of their species; where the browser cannot speak, the bark in its body plan's
    // register stands in.
    const stopSpeech = onSceneSpeech(({ text, species, near }) => {
      if (!speech.say(text, timbreOf(species), near)) sfx.playScene(voiceOf(SPECIES[species].kind), VOICE_PEAK * near);
    });
    // A line being said stops with the walk that heard it.
    const stopWalk = useGame.subscribe((s, prev) => {
      if ((prev.walking && !s.walking) || (prev.started && !s.started)) speech.hush();
    });
    const stopAvatar = useGame.subscribe((s, prev) => {
      if (s.avatar !== prev.avatar) sfx.playScene("pop", 0.9, true);
    });
    // A ride cut straight to its floor is never shown, so it has only a short bell as it arrives.
    const stopRide = onRide((event) => {
      const up = FLOOR_Y[ride.to] > FLOOR_Y[ride.from];
      if (ride.cut) {
        if (event === "arrive") sfx.liftCut(up);
      } else if (event === "depart") sfx.liftDepart(up, RIDE_SECONDS / 2);
      else sfx.liftArrive(up, { close: DOORS.move + DOORS.hold, shut: 2 * DOORS.move + DOORS.hold });
    });
    // The zones' own sounds, near where the camera looks, while a run is on screen and nothing covers the room.
    const due = new Map<ZoneSound, number>();
    const zones = window.setInterval(() => {
      const s = useGame.getState();
      if (!s.started || s.view || document.hidden || !viewFocus.live || viewFocus.hush) {
        due.clear();
        return;
      }
      const now = performance.now() / 1000;
      for (const zone of ZONE_SOUNDS) {
        const level = zoneLevel(zone, viewFocus);
        if (level < 0.01) {
          due.delete(zone);
          continue;
        }
        // A zone coming into earshot answers promptly, but a short entry gap means a pan never sets off a burst.
        const at = due.get(zone) ?? now + entryGap(Math.random());
        if (now >= at) {
          sfx.playZone(zone.cue, level);
          due.set(zone, now + nextGap(zone, Math.random()));
        } else due.set(zone, at);
      }
    }, ZONE_TICK_MS);
    return () => {
      window.clearInterval(zones);
      stopScene();
      stopSpeech();
      stopWalk();
      speech.dispose();
      stopAvatar();
      stopRide();
      stopCues();
      stopVolume();
      sfx.dispose();
    };
  }, []);
}

/**
 * Everything a running game needs besides its layout: boot, sound, the game clocks, keyboard shortcuts and autosave.
 * Each edition's shell calls it once, so both play by the same lifecycle; `scope` is the edition's reach.
 */
export function useGameRuntime(scope?: PlayScope): void {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  const phase = useGame((s) => s.game.phase);
  const turn = useGame((s) => s.game.turn);
  const running = useGame((s) => s.running);
  const speed = useGame((s) => s.speed);
  const view = useGame((s) => s.view);
  const onboarding = useGame((s) => s.onboarding);
  const touring = useGame((s) => s.tour?.track ?? null);
  useMusic();
  useSoundEffects();
  useAmbience();

  useEffect(() => {
    useGame.getState().boot(scope);
    // The scope is fixed for the page: it is read once, like the rest of boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crisis clock.
  useEffect(() => {
    if ((!campaign && phase !== "incident") || !running || !started) return;
    const id = window.setInterval(() => useGame.getState().tick(TICK_MS / 1000), TICK_MS);
    return () => window.clearInterval(id);
  }, [campaign, phase, running, started]);

  // Auto-advance during management.
  useEffect(() => {
    if (campaign || phase !== "management" || !running || onboarding || view || touring || !started) return;
    const id = window.setTimeout(() => useGame.getState().advance(), (AUTO_SECONDS * 1000) / speed);
    return () => window.clearTimeout(id);
  }, [campaign, phase, running, speed, turn, onboarding, view, touring, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const s = useGame.getState();
      // The guide's card is labelled a dialog for assistive technology, but it is not modal: shortcuts still apply.
      if (!s.started || target?.closest('[role="dialog"]:not([aria-modal="false"]):not(.tour-card)')) return;
      if (e.key === "Escape") {
        // In a fixed order: a view sheet, then walk mode seen from above, then the selection. Dialogs close themselves
        // first. A view from the avatar is left by its Exit button: there Escape only ever gives the cursor back.
        if (s.view) s.openView(null);
        else if (s.walking && !fromAvatar(s.viewpoint)) {
          // Only the arcade claims Escape to leave its game (WalkControls preventDefaults it there); every other
          // busy or quiet moment keeps Escape as the way out of walk mode.
          if (avatar.busy?.prop === "arcade" || e.defaultPrevented) return;
          s.setWalking(false);
        }
        else if (s.walking) return;
        else if (s.selected && s.game.phase !== "incident") s.select(null);
      } else if (e.key === "p" || e.key === "P") {
        if (s.game.phase === "incident" || s.game.phase === "management") s.setRunning(!s.running);
      } else if ((e.key === "n" || e.key === "N") && s.game.campaign && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Guided Mode steps one game second; the store refuses wherever Run would.
        s.stepSeconds(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const hidden=()=>{if(document.hidden)useGame.getState().setRunning(false);};
    document.addEventListener("visibilitychange",hidden);
    return ()=>document.removeEventListener("visibilitychange",hidden);
  }, []);
  useEffect(() => {
    if(!campaign || !started)return;
    const record=()=>useGame.getState().measureTime();
    const id=window.setInterval(record,1000);
    const saveId=window.setInterval(()=>{const s=useGame.getState();if(s.started&&!document.hidden)s.saveNow(true);},10000);
    const boundary=()=>{record();useGame.getState().saveNow(true);};
    document.addEventListener("visibilitychange",boundary);
    window.addEventListener("pagehide",boundary);
    return ()=>{window.clearInterval(id);window.clearInterval(saveId);document.removeEventListener("visibilitychange",boundary);window.removeEventListener("pagehide",boundary);record();};
  },[campaign,started]);
}

/** The app root's classes: the phase, the chapter bar, a guide in progress, the title screen and Classic's rail. */
export function useAppClassName(): string {
  const campaign = useGame((s) => !!s.game.campaign);
  const started = useGame((s) => s.started);
  const phase = useGame((s) => s.game.phase);
  const incident = useGame((s) => incidentActive(s.game));
  const touring = useGame((s) => s.tour?.track ?? null);
  // A Guided Mode failure can burn while the phase stays "management"; the panel still takes the alert border.
  return `app phase-${phase}${incident && phase !== "incident" ? " phase-incident" : ""}${campaign && started ? " has-chapters" : ""}${touring ? ` is-touring tour-${touring}` : ""}${started ? "" : " is-title"}${started && !campaign ? " has-operations-rail" : ""}`;
}
