"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/game/store";
import { roleOf, SPECIES, type Role } from "./cast";
import { SpeechBubble } from "./bubble";
import { memberRotation, turnAt, type Group, type Turn } from "./conversations";
import { Creature } from "./creatures";
import { asideLine, captionLine, earshot, fresh, glance, GREET_SECONDS, greetingLine, nearness, notices } from "./greetings";
import { overhear } from "./overheard";
import { now, riding } from "./ride";
import { heading, wrapAngle } from "./routes";
import { avatar } from "./walk";
import { sceneSpeech } from "./sceneSounds";

/*
 * Groups of crew chatting (see conversations.ts), with a speech bubble over
 * whoever is speaking. Seen from the avatar the bubbles are only legible
 * within earshot (see greetings.ts): what the group says is captioned on the
 * page and spoken in the speaker's own voice, and right up close a member
 * turns to the avatar with a word of its own.
 */

/** A group chatting: the speaker talks while the rest listen, or panic during an incident. */
export function Conversation({ group, incident }: { group: Group; incident: boolean }) {
  const [turn, setTurn] = useState<Turn>(() => turnAt(group, 0, incident));
  const shown = useRef(turn);
  // An aside to the avatar, while its bubble shows and the member's turn lasts.
  const [aside, setAside] = useState<{ member: number; line: string; at: number } | null>(null);
  const asided = useRef<{ member: number; line: string; at: number; turn: number } | null>(null);
  const asides = useRef(0);
  const notice = useRef(fresh());
  // How far the avatar is from the group's middle now, read every frame by the bubbles.
  const heard = useRef(Infinity);
  const lastOverheard = useRef<string | null>(null);
  // The last line actually said, and who said it, so the caption holds through the pause between speakers.
  const lastLine = useRef<{ line: string; speaker: Role } | null>(null);
  const members = useRef<(THREE.Group | null)[]>([]);

  useEffect(() => () => overhear(group.name, null), [group.name]);

  useFrame(({ clock }) => {
    const t = now();
    const walking = useGame.getState().walking && avatar.floor === "office" && !riding();
    const d = walking ? Math.hypot(avatar.x - group.centre[0], avatar.z - group.centre[1]) : Infinity;
    heard.current = d;

    const next = turnAt(group, clock.elapsedTime, incident);
    if (walking && next.line && (next.speaker !== shown.current.speaker || next.line !== shown.current.line)) {
      // Each new line is spoken in the speaker's voice.
      const near = nearness(d);
      if (near > 0.02) sceneSpeech({ text: next.line, species: group.members[next.speaker].species, near });
    }
    // Only a new speaker or line needs React.
    if (next.speaker !== shown.current.speaker || next.line !== shown.current.line) {
      shown.current = next;
      setTurn(next);
    }
    // The caption on the page repeats what can be followed from here, holding the last line through the pause
    // between speakers; publish it only when it changes. Out of earshot the stale line is forgotten, so the next
    // approach does not start on it.
    const audible = walking && earshot(d) >= 0.5;
    if (next.line) lastLine.current = { line: next.line, speaker: roleOf(group.members[next.speaker].species) };
    if (!audible) lastLine.current = null;
    const line = captionLine(next.line, lastLine.current?.line ?? null, audible);
    const caption = audible && line && lastLine.current ? { speaker: lastLine.current.speaker, line, alarmed: incident } : null;
    const key = caption ? `${caption.speaker}${caption.line}${caption.alarmed}` : null;
    if (key !== lastOverheard.current) {
      lastOverheard.current = key;
      overhear(group.name, caption);
    }

    // An aside: right up close, the member nearest the avatar turns and says a word to it.
    if (asided.current && t - asided.current.at >= GREET_SECONDS) {
      asided.current = null;
      setAside(null);
    }
    if (walking) {
      let nearest = -1;
      let nd = Infinity;
      group.members.forEach((m, i) => {
        const dm = Math.hypot(avatar.x - m.x, avatar.z - m.z);
        if (dm < nd) {
          nearest = i;
          nd = dm;
        }
      });
      if (nearest >= 0 && notices(notice.current, nd, t)) {
        asides.current++;
        const m = group.members[nearest];
        const turnTo = wrapAngle(heading(avatar.x - m.x, avatar.z - m.z) - memberRotation(group, nearest));
        const n = asides.current + Math.round(group.offset * 10);
        const a = { member: nearest, line: incident ? greetingLine(m.species, "panic", n) : asideLine(n), at: t, turn: turnTo };
        sceneSpeech({ text: a.line, species: m.species, near: nearness(nd) });
        asided.current = a;
        setAside({ member: a.member, line: a.line, at: a.at });
      }
    }
    // Turn each member to the group, the one giving an aside towards the avatar while it lasts.
    group.members.forEach((_, i) => {
      const g = members.current[i];
      if (!g) return;
      const extra = asided.current?.member === i ? asided.current.turn * glance(t - asided.current.at) : 0;
      g.rotation.y = memberRotation(group, i) + extra;
    });
  });

  return (
    <group>
      {group.members.map((m, i) => {
        const speaking = i === turn.speaker;
        const asideHere = aside && aside.member === i ? aside : null;
        return (
          <group
            key={i}
            ref={(g) => {
              members.current[i] = g;
            }}
            position={[m.x, 0, m.z]}
          >
            <Creature species={m.species} activity={asideHere ? (incident ? "panic" : "greet") : speaking ? "chat" : incident ? "panic" : "idle"} position={[0, 0, 0]} rotation={0} phase={i * 2.3 + group.offset} greets={false} />
            {asideHere ? (
              <SpeechBubble text={asideHere.line} alarmed={incident} height={SPECIES[m.species].height} />
            ) : (
              speaking && turn.line && <SpeechBubble text={turn.line} alarmed={incident} height={SPECIES[m.species].height} opacity={() => earshot(heard.current)} />
            )}
          </group>
        );
      })}
    </group>
  );
}
