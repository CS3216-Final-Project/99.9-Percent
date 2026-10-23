import type { GameState } from "@/sim";

const COLLEAGUES = {
  maya: { name: "Maya", role: "Customer Support", character: "a purple eyeball creature with a headset and a green visor" },
  alex: { name: "Alex", role: "CEO", character: "a black and gold dragon in a pinstripe suit" },
  jordan: { name: "Jordan", role: "Software Engineer", character: "a stone golem in a navy hoodie and glasses" },
  sam: { name: "Sam", role: "Marketing", character: "a fire imp in a backwards cap, holding a phone" },
  taylor: { name: "Taylor", role: "Operations Engineer", character: "a hooded skeleton holding a coffee cup, with a pager clipped on" },
} as const;
export type ColleagueId = keyof typeof COLLEAGUES;

const CHAPTERS = {
  1: { speaker: "maya", lines: ["Hi! I'm Maya from Customer Support. I keep an eye on every ticket. Well, several eyes.", "Customers want our website to stay fast, and they notice the moment it isn't.", "Can you find what might slow it down before they do?"], mission: "Compare demand and capacity to prevent or recover from a bottleneck." },
  2: { speaker: "alex", lines: ["Alex. I run this company, and I didn't build it to stay small.", "Our company is growing! More users are coming, and we need to make sure our infrastructure can handle them.", "Get us ready. I'll be watching the numbers."], mission: "Prepare capacity and route traffic to the servers that can handle it." },
  3: { speaker: "jordan", lines: ["Jordan, software engineering. I've been reading the database logs.", "Our database needs to keep up as we grow. Every request asks it for something, and it is starting to feel the weight.", "Let's find a smarter way to handle all these requests. Measure first, then build."], mission: "Compare database workloads and use caching where it helps." },
  4: { speaker: "sam", lines: ["Sam from Marketing! Guess who's about to set the internet on fire?", "Our next campaign could bring a sudden rush of visitors. Like, a lot of visitors. All at once.", "Are our systems ready? Because the post goes live soon."], mission: "Observe traffic spikes and weigh capacity, autoscaling and rejected traffic." },
  5: { speaker: "taylor", lines: ["Taylor, Operations. Third coffee. Don't mind me.", "Servers fail. Not if, when. I've been paged at 3 a.m. enough times to know.", "What happens if one of ours goes down? Let's prepare before something goes wrong."], mission: "Prepare for server failures and verify stable recovery." },
  6: { speaker: "alex", lines: ["Alex again. We've come a long way since that first server.", "Our final challenge is to grow toward 50,000 users without sacrificing reliability.", "Pull this off and we'll be the company everyone else studies."], mission: "Serve growth at full demand and complete the Campaign's reliability checks." },
} as const satisfies Record<number, { speaker: ColleagueId; lines: readonly string[]; mission: string }>;

/** Identity comes from the actual entered stage, never a timer or an unlocked Next button. */
export function chapterCompanyMessage(game: GameState) {
  const c = game.campaign;
  if (!c || game.phase === "ended") return null;
  const chapter = c.combinedStage ? 6 : c.reliabilityStage ? 5 : c.spikeStage ? 4 : c.dataStage ? 3 : c.scaling ? 2 : 1;
  const enteredStep = (c.combinedStage ?? c.reliabilityStage ?? c.spikeStage ?? c.dataStage ?? c.scaling)?.enteredStep ?? 0;
  const { speaker, lines, mission } = CHAPTERS[chapter];
  const slow = c.snapshot.latencyMs >= 500 || c.snapshot.app.backlog > 0 || c.snapshot.db.backlog > 0;
  const said: readonly string[] = chapter === 1 && slow ? ["Maya from Customer Support here. My inbox is lighting up!", "Customers are reporting that our website is getting slower. Can you find out what's causing it?"]
    : chapter === 6 ? c.combinedStage!.users >= c.combinedStage!.finalUserTarget
      ? [lines[0], "We've hit our user target. Let's keep our service reliable and finish the final Campaign checks."]
      : lines.map(line => line.replace("50,000", c.combinedStage!.finalUserTarget.toLocaleString("en-US"))) : lines;
  return { ...COLLEAGUES[speaker], speaker, portrait: `/characters/${speaker}.webp`, lines: said, mission, chapter, key: `99.99.company-messages:${c.runId}:${chapter}:${enteredStep}` };
}
export type ChapterCompanyMessage = NonNullable<ReturnType<typeof chapterCompanyMessage>>;
