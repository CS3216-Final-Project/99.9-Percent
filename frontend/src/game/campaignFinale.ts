import type { GameState } from "@/sim";
import type { ColleagueId, DialogueLine } from "./colleagues";

/** The colleagues' celebration after a won campaign, built from the recorded scorecard so every line is true. */
export function campaignFinale(game: GameState) {
  const card = game.campaign?.scorecard;
  if (game.phase !== "ended" || game.outcome !== "won" || !card) return null;
  const users = card.users.toLocaleString("en-US"), incidents = card.incidentCount;
  const cheer = (speaker: ColleagueId, text: string): DialogueLine => ({ speaker, text, mood: "celebrating" });
  const lines = [
    cheer("maya", "We did it! My inbox is full of thank-you notes. I'm crying out of every eye."),
    cheer("jordan", "The database kept up at full demand all the way. I checked the numbers twice. They're beautiful."),
    cheer("sam", "We're trending everywhere, and the site didn't even flinch. Best. Launch. Ever."),
    cheer("taylor", incidents === 0 ? "Not a single incident. I slept through the night. I forgot that was possible." : `${incidents} ${incidents === 1 ? "incident" : "incidents"}, and we came through every one. That's how you run production.`),
    cheer("alex", `${users} users, and we kept them online. Raise a glass, everyone. This company is yours too.`),
  ];
  const stats = [
    { label: "Users", value: users },
    ...card.wholeRunUptime === null ? [] : [{ label: "Uptime", value: `${(card.wholeRunUptime * 100).toFixed(2)}%` }],
    { label: "Incidents", value: incidents.toLocaleString("en-US") },
  ];
  return { lines, stats, key: `99.99.campaign-finale:${card.runId}` };
}
export type CampaignFinale = NonNullable<ReturnType<typeof campaignFinale>>;
