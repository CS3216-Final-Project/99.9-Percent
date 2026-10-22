import type { GameState } from "@/sim";

const COLLEAGUES = {
  1: { name: "Maya", role: "Customer Support", message: "Customers want our website to stay fast. Can you find what might slow it down?", mission: "Compare demand and capacity to prevent or recover from a bottleneck." },
  2: { name: "Alex", role: "CEO", message: "Our company is growing! More users are coming, and we need to make sure our infrastructure can handle them.", mission: "Prepare capacity and route traffic to the servers that can handle it." },
  3: { name: "Jordan", role: "Software Engineer", message: "Our database needs to keep up as we grow. Let's find a smarter way to handle all these requests.", mission: "Compare database workloads and use caching where it helps." },
  4: { name: "Sam", role: "Marketing", message: "Our next campaign could bring a sudden rush of visitors. Are our systems ready?", mission: "Observe traffic spikes and weigh capacity, autoscaling and rejected traffic." },
  5: { name: "Taylor", role: "Operations Engineer", message: "What happens if one of our servers fails? Let's prepare before something goes wrong.", mission: "Prepare for server failures and verify stable recovery." },
  6: { name: "Alex", role: "CEO", message: "We've come a long way. Our final challenge is to grow toward 50,000 users without sacrificing reliability.", mission: "Serve growth at full demand and complete the Campaign's reliability checks." },
} as const;

/** Identity comes from the actual entered stage, never a timer or an unlocked Next button. */
export function chapterCompanyMessage(game: GameState) {
  const c = game.campaign;
  if (!c || game.phase === "ended") return null;
  const chapter = c.combinedStage ? 6 : c.reliabilityStage ? 5 : c.spikeStage ? 4 : c.dataStage ? 3 : c.scaling ? 2 : 1;
  const enteredStep = (c.combinedStage ?? c.reliabilityStage ?? c.spikeStage ?? c.dataStage ?? c.scaling)?.enteredStep ?? 0;
  const colleague = COLLEAGUES[chapter];
  const slow = c.snapshot.latencyMs >= 500 || c.snapshot.app.backlog > 0 || c.snapshot.db.backlog > 0;
  const message = chapter === 1 && slow ? "Customers are reporting that our website is getting slower. Can you find out what's causing it?"
    : chapter === 6 ? c.combinedStage!.users >= c.combinedStage!.finalUserTarget
      ? "We've come a long way. Let's keep our service reliable and finish the final Campaign checks."
      : colleague.message.replace("50,000", c.combinedStage!.finalUserTarget.toLocaleString("en-US")) : colleague.message;
  return { ...colleague, message, chapter, key: `99.99.company-messages:${c.runId}:${chapter}:${enteredStep}` };
}
export type ChapterCompanyMessage = NonNullable<ReturnType<typeof chapterCompanyMessage>>;
