import type { useGame } from "@/game/store";
import { num } from "@/game/format";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";

type Snapshot = ReturnType<typeof useGame.getState>;
export interface ChapterZeroLesson {
  title: string;
  /** Selected control labels and concepts to highlight in the action instruction. */
  emphasis?: readonly string[];
  why?: string | ((s: Snapshot) => string);
}
const snapshot = (s: Snapshot) => s.game.campaign!.snapshot;

/** Saved lesson indices remain stable, including profiles from the earlier spotlight walkthrough. */
export const CHAPTER_ZERO_LESSONS: ChapterZeroLesson[] = [
  {
    title: "Meet your system",
    emphasis: ["Inspect equipment", "App Server", "App Servers", "demand", "capacity", "backlog"],
    why: (s) => `Your customers currently send ${num(snapshot(s).incoming)} requests each second. App Servers handle those requests, asking the Database for data when needed. Inspecting a component shows how much work reaches it, how much it can handle and whether any work is waiting. These readings help you decide where an upgrade would actually help.`,
  },
  {
    title: "Follow a request",
    emphasis: ["Inspect equipment", "Database", "App Servers"],
    why: "A request often needs more than one part of your system. The App Server handles the customer's request, while the Database stores and retrieves the data it needs. Even when the App Server has spare capacity, a busy Database can hold up the response. Inspect both components to understand where work is waiting.",
  },
  {
    title: "Read the evidence",
    emphasis: ["App Server", "Database", "Inspect equipment", "demand", "capacity", "Inspection is free"],
    why: "Demand is the work arriving each second; capacity is the work a component can handle in that time. When demand exceeds capacity, unfinished work builds up in the backlog and customers may wait longer. Compare the two readings for each component before spending money. Inspection is free and keeps the company paused.",
  },
  {
    title: "Spot trouble",
    emphasis: ["slow responses", "Errors", "warning threshold"],
    why: `Latency tells you how long customers wait for a response. At ${num(Q.latencyThresholdMs)} ms or more, the game considers responses slow. Errors show the share of requests that fail, with a warning threshold of ${Q.errorThreshold * 100}%. These are signs of trouble; inspecting the equipment helps you understand what is causing them.`,
  },
  {
    title: "Know what earns money",
    emphasis: ["successful request", "running costs", "Rejected requests"],
    why: `Each successful request earns $${(Q.revenueCents / 100).toFixed(2)} for your company. Those earnings accumulate as pending revenue until the operating week settles, every ${Q.periodSteps} game seconds. Rejected requests earn nothing, while equipment and salaries still create running costs. Keeping service healthy helps you earn revenue, but your upgrades also need to fit the company's budget.`,
  },
  {
    title: "You control the clock",
    emphasis: ["Run", "one real game second", "game second", "paused"],
    why: "Your company is paused, so you can inspect the system and think through a decision without time passing. When you press Run, each game second simulates incoming requests, processing and queues, along with progress on any pending actions. This exercise runs your actual company for one game second, then pauses it automatically so you can see what changed.",
  },
  {
    title: "Your actions",
    emphasis: ["Actions", "quote", "Next", "price", "activation delay", "running costs"],
    why: "Opening an action shows a quote before you buy anything. The quote explains the upfront price, how long the action takes to activate and any extra running costs it creates. Take a moment to compare those costs with your available cash and the evidence you inspected. An upgrade can be useful without being the right purchase right now.",
  },
  {
    title: "Compare before buying",
    emphasis: ["Cancel", "Confirm", "cash"],
    why: "A quote gives you a chance to review a decision before committing your cash. Nothing is bought until you press Confirm. For this exercise, cancel the quote so you can practise checking an action without purchasing it. You can reopen an available action later when you have decided what your company needs.",
  },
  {
    title: "Game time and operating weeks",
    emphasis: ["total game seconds", "60 game seconds", "operating week"],
    why: `The clock counts the total game seconds your company has operated. Every ${Q.periodSteps} game seconds completes one operating week, when the company settles its revenue and bills. The total counter keeps going as the next week begins. An operating week is a compressed billing period in the game, so you can watch business results without waiting a real calendar week.`,
  },
  {
    title: "What happens at week end?",
    emphasis: ["pending revenue", "cash", "costs and salaries", "History"],
    why: "During the week, successful requests build up pending revenue. At settlement, that revenue is added to cash and the week's equipment costs and salaries are deducted. History records the result so you can see whether the company earned more than it spent. If Run is still on, the company continues into the next week; settlement does not pause it for you.",
  },
  {
    title: "Cash is your spending budget",
    emphasis: ["Pending revenue", "Setup costs", "running costs", "zero or below"],
    why: "Available cash is the money you can spend now. Pending revenue cannot fund a purchase until the operating week settles. Setup costs are charged immediately, and running costs continue each week even for idle equipment. Leave room for the next bill when planning an upgrade: if cash reaches zero or below after settlement, the company closes.",
  },
  {
    title: "Pause, run and change speed",
    emphasis: ["Pause", "speed", "game seconds"],
    why: "Pausing stops requests, activation delays and recovery progress together, giving you time to inspect the system and plan your next move. The speed selector controls how quickly game seconds pass in real time. A faster setting helps you observe a decision sooner, but each game second still represents the same amount of work and uses the same prices. You can change speed while paused.",
  },
  {
    title: "Find your way around",
    emphasis: ["server floor", "office", "Floor buttons", "Reset view", "Walk mode is optional"],
    why: "Your company has two floors: the server floor contains its infrastructure, and the office contains its crew and work areas. Use the floor buttons to move between them, then zoom or rotate to get a clearer view. Reset view brings the camera back when you lose your bearings. Walking is optional; you can inspect equipment directly through its label or Inspect equipment.",
  },
  {
    title: "Technology and deployment",
    emphasis: ["Tech", "Close", "research points", "Owning", "deploy"],
    why: "Tech shows nine capabilities and the prerequisites you need before unlocking them. Later chapters award research points that you can spend here. Unlocking a capability makes it available, but you still need to deploy and configure it where required. Owning a technology alone does not install equipment, create a server or send traffic to it; check the relevant action and its activation delay too.",
  },
  {
    title: "Check what changed in History",
    emphasis: ["History", "Charts", "Events", "Incidents", "game seconds", "operating weeks"],
    why: "History helps you connect a decision with what happened afterwards. Charts show trends in traffic, responses and finances; Events record decisions and activations; Incidents holds reports from service problems. Traffic and response charts use game seconds, while revenue and cost charts use operating weeks. Check the time scale when comparing an upgrade with the result you observed.",
  },
  {
    title: "Save and come back",
    emphasis: ["Menu", "Save now", "Run", "Save and exit", "cloud saves", "backup"],
    why: "Your company autosaves in this browser when browser storage is available. Menu also provides Save now, backups and Save and exit, so you can choose when to stop and return later. Local saves belong to this browser and device. Before moving to another device or clearing browser data, keep a backup or sign in through Account and explicitly save to the cloud.",
  },
  {
    title: "Capacity, routing and data",
    emphasis: ["capacity", "traffic is routed", "bottleneck", "caching"],
    why: "Installing another server adds potential capacity, but that server only helps once traffic is routed to it. The Database can still limit the whole system even when the App Servers have room to spare. Later, a cache can answer eligible repeated reads and reduce some database work. Cache misses and writes still reach the Database, so keep comparing demand, capacity and backlog across the system.",
  },
  {
    title: "Respond to incidents with evidence",
    emphasis: ["Inspect", "evidence", "Traffic limits", "rejected requests"],
    why: "An incident tells you that service is struggling, but the warning alone does not identify the best response. Pause to inspect equipment for free, compare its readings and choose an action that addresses the pressure you see. Some actions need game seconds to activate, so run the company to observe their effect. Traffic limits can relieve pressure, but the requests they reject earn no revenue.",
  },
  {
    title: "Later challenges build on this",
    emphasis: ["autoscaling", "health checks", "failover", "activation time"],
    why: "Later chapters build on this inspection-and-decision loop with changing demand, autoscaling, health checks, spare servers and failover. Each chapter introduces the new controls when you reach it, so you do not need to memorise them now. Automation still depends on installed capacity, configuration and activation time. Keep checking what is actually running and receiving traffic as your company grows.",
  },
  {
    title: "Chapters advance through goals",
    emphasis: ["Goal", "requirements", "review the outcome", "Next"],
    why: "Chapters progress when you meet their goals, rather than simply reaching the end of a week. Follow the Goal and the visible requirements to see what still needs to happen. When an outcome is ready, review it and choose Next when available. Your existing company carries its investments and finances into the next chapter, so earlier decisions continue to matter across all six gameplay chapters.",
  },
  {
    title: "Ready to run your company",
    emphasis: ["paused", "Chapter 1: Opening", "bottleneck", "evidence"],
    why: "Your company is paused again, ready for you to take control. You have inspected real equipment, observed a game second and reviewed a purchase quote without spending your cash. In Chapter 1: Opening, you will watch demand change and use the evidence to find a bottleneck. Finish this guide when you are ready; if you are replaying it, you will return to your existing chapter and company.",
  },
];
