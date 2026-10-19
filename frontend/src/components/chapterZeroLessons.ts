import type { useGame } from "@/game/store";
import { num } from "@/game/format";
import { financeMoney } from "@/game/campaignFinance";
import { WALKTHROUGH_LESSON_IDS, type LessonId } from "@/game/walkthrough";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";

type Snapshot = ReturnType<typeof useGame.getState>;
type Text = string | ((s: Snapshot) => string);
export interface ChapterZeroLesson {
  id: LessonId;
  title: string;
  /** The part of the walkthrough the lesson belongs to, shown above its title. */
  section: "Look" | "Act" | "Money" | "Controls" | "Go";
  /** One short reason: at most two sentences. */
  why: Text;
  /** A longer explanation, collapsed under Learn more. */
  more?: Text;
  /** Selected control labels and concepts to highlight in the lesson's instruction. */
  emphasis?: readonly string[];
}
const snapshot = (s: Snapshot) => s.game.campaign!.snapshot;

/** The order is WALKTHROUGH_LESSON_IDS: saved progress stores a position in it. */
const LESSONS: Record<LessonId, Omit<ChapterZeroLesson, "id">> = {
  goal: {
    title: "Your job",
    section: "Look",
    why: "You run a small web company. Keep it fast and online as customers grow, without running out of cash.",
    more: "Customers send requests every game second. App Servers handle each request and ask the Database for the data it needs. When either part cannot keep up, work waits in a queue called the backlog and customers wait longer.",
  },
  "inspect-app": {
    title: "Look at the App Server",
    section: "Look",
    emphasis: ["App Server", "demand", "capacity"],
    why: (s) => `Customers send ${num(snapshot(s).incoming)} requests each second. Check that the App Server can handle them.`,
    more: "Demand is the work arriving each second. Capacity is how much the part can handle in that time. When demand is higher, the extra work waits in the backlog. Inspecting is free and keeps the company paused.",
  },
  "inspect-db": {
    title: "Compare with the Database",
    section: "Look",
    emphasis: ["Database", "compare"],
    why: "Every request also needs the Database. The part with the least room to spare slows everything down: that is your bottleneck.",
    more: "Upgrading a part that already has spare capacity does not help. Compare demand with capacity for each part before spending money.",
  },
  warnings: {
    title: "Spot trouble",
    section: "Look",
    why: `Latency is how long customers wait; errors are failed requests. They turn red at ${num(Q.latencyThresholdMs)} ms or ${Q.errorThreshold * 100}% errors.`,
    more: "Backlog is the total work waiting. A growing backlog usually comes before slow responses. When something turns red, inspect each part to find the one that is overloaded.",
  },
  run: {
    title: "Run one second",
    section: "Act",
    emphasis: ["Run", "one game second"],
    why: "The company stays paused while you think. Running lets time pass: requests arrive, queues move and purchases activate.",
    more: "Use +1s or +5s to step exactly that many game seconds. Pausing is free and stops everything at once.",
  },
  quote: {
    title: "Preview a purchase",
    section: "Act",
    emphasis: ["Actions", "quote"],
    why: "A quote shows the price, how long it takes to activate and its weekly running cost. Nothing is bought yet.",
    more: "Compare the quote with your cash and the evidence you inspected. An upgrade can be useful without being the right purchase right now.",
  },
  cancel: {
    title: "Keep your cash",
    section: "Act",
    emphasis: ["Cancel", "Confirm"],
    why: "Nothing is bought until you press Confirm. Your system is healthy, so save your cash until the evidence shows a need.",
  },
  money: {
    title: "Cash and the weekly bill",
    section: "Money",
    why: `Each successful request earns ${financeMoney(Q.revenueCents)}. Earnings wait as pending revenue until the week settles every ${Q.periodSteps} game seconds, when bills are paid too.`,
    more: "Only available cash can pay for purchases. Rejected requests earn nothing, and equipment and salaries cost money every week, even when idle. If cash is zero or below after settlement, the company closes.",
  },
  speed: {
    title: "Speed and floors",
    section: "Controls",
    emphasis: ["speed"],
    why: "A faster speed shows results sooner. Each game second still does the same work at the same prices.",
    more: "Floor, under Navigation, switches between the server floor and the office. Walking is optional: you can always inspect equipment from the panel.",
  },
  ready: {
    title: "Ready for Chapter 1",
    section: "Go",
    why: "In Chapter 1: Opening, demand grows. A short guide walks you through finding the bottleneck and fixing it.",
    more: "Tech, in the bottom bar, unlocks new capabilities with research points; History shows charts, your decisions and incident reports. Each later chapter introduces its own controls when you reach it.",
  },
};

export const CHAPTER_ZERO_LESSONS: ChapterZeroLesson[] = WALKTHROUGH_LESSON_IDS.map(id => ({ id, ...LESSONS[id] }));
