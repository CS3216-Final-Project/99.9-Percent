import type { AppProfileId, GameState, PromoId } from "./types";

/**
 * What kind of app the Challenge Mode company builds. A profile scales the workload and the market around the same
 * equipment: how much traffic each user makes, how hard each request leans on the database, how much of that the
 * read cache can absorb, what a user is worth, how early slowness drives users away and which promotions land.
 *
 * Every factor is a multiplier on BALANCE (1 = unchanged), except the cache share and the latency knee, which replace
 * theirs. "general" is exactly the original balance: runs saved before profiles existed resolve to it.
 */
export interface AppProfileDef {
  id: AppProfileId;
  name: string;
  /** One line on the card: what the app is. */
  pitch: string;
  /** What the infrastructure has to be good at, in the player's terms. */
  needs: string[];
  /** The trade-off that bites, shown before the choice. */
  risk: string;
  /** Peak requests per user, as a multiple of BALANCE.rpsPerUser. */
  traffic: number;
  /** Database queries per served request, as a multiple of BALANCE.db.queriesPerRequest. */
  dbLoad: number;
  /** Share of database work the read cache may absorb; writes never cache. */
  cacheEligibleShare: number;
  /** Weekly revenue per user, as a multiple of BALANCE.arpu. */
  revenue: number;
  /** Peak utilisation at which users start to notice slowness (the original is 0.7). */
  latencyKnee: number;
  /** Users acquired by each promotion, as a multiple of its userGain. */
  promoGain: Record<PromoId, number>;
  /** Extra peak traffic of each promotion, as a multiple of its spike. */
  promoSpike: Record<PromoId, number>;
}

const SAME: Record<PromoId, number> = { social: 1, launch: 1, targeted: 1 };

export const APP_PROFILES: Record<AppProfileId, AppProfileDef> = {
  general: {
    id: "general",
    name: "General app",
    pitch: "A bit of everything.",
    needs: ["Balanced app servers and database"],
    risk: "No particular weakness.",
    traffic: 1,
    dbLoad: 1,
    cacheEligibleShare: 0.6,
    revenue: 1,
    latencyKnee: 0.7,
    promoGain: SAME,
    promoSpike: SAME,
  },
  social: {
    id: "social",
    name: "Social media",
    pitch: "Feeds, likes and endless scrolling.",
    needs: ["A database that keeps up with feeds", "A read cache for hot posts"],
    risk: "Every user is worth little, so you need a lot of them.",
    traffic: 1,
    dbLoad: 1.15,
    cacheEligibleShare: 0.7,
    revenue: 0.9,
    latencyKnee: 0.7,
    promoGain: { social: 1.6, launch: 1.2, targeted: 0.8 },
    promoSpike: { social: 1.2, launch: 1, targeted: 1 },
  },
  gaming: {
    id: "gaming",
    name: "Online game",
    pitch: "Matches, leaderboards and live sessions.",
    needs: ["Fast app servers with headroom", "A read cache for player state"],
    risk: "Players leave the moment it lags, well before anything breaks.",
    traffic: 1.25,
    dbLoad: 0.7,
    cacheEligibleShare: 0.7,
    revenue: 1.05,
    latencyKnee: 0.5,
    promoGain: { social: 1, launch: 1.4, targeted: 0.9 },
    promoSpike: { social: 1, launch: 1.3, targeted: 1 },
  },
  ecommerce: {
    id: "ecommerce",
    name: "Online store",
    pitch: "Browsing, carts and checkouts.",
    needs: ["A bigger database for orders", "Room for sale-day spikes"],
    risk: "Checkouts are writes, so the read cache helps less.",
    traffic: 0.85,
    dbLoad: 1.35,
    cacheEligibleShare: 0.35,
    revenue: 1.25,
    latencyKnee: 0.7,
    promoGain: { social: 0.7, launch: 1.1, targeted: 1.5 },
    promoSpike: { social: 1, launch: 1.4, targeted: 1.3 },
  },
  streaming: {
    id: "streaming",
    name: "Music streaming",
    pitch: "Catalogues, playlists and nonstop listening.",
    needs: ["A read cache for the catalogue", "Database capacity as the library grows"],
    risk: "Listeners stream all day, so traffic per user is high.",
    traffic: 1.15,
    dbLoad: 1,
    cacheEligibleShare: 0.85,
    revenue: 1,
    latencyKnee: 0.8,
    promoGain: { social: 1.25, launch: 1, targeted: 1 },
    promoSpike: SAME,
  },
};

/**
 * The last week a company can still pick: the first-week tutorial plays one week before the choice, and a player
 * who skips it picks in week 1. Until then the company plays the original balance.
 */
export const APP_PROFILE_LAST_TURN = 2;

/** Whether this company still has to say what it builds. */
export function needsAppProfile(s: Pick<GameState, "appProfile" | "turn" | "campaign">): boolean {
  return !s.campaign && s.appProfile === null && s.turn <= APP_PROFILE_LAST_TURN;
}

/** The profiles a new company can pick, in card order. */
export const APP_PROFILE_CHOICES: AppProfileId[] = ["social", "gaming", "ecommerce", "streaming"];

/** The company's profile; runs without one (saved before profiles, or not yet chosen) play the original balance. */
export function appProfile(s: Pick<GameState, "appProfile">): AppProfileDef {
  return APP_PROFILES[s.appProfile ?? "general"] ?? APP_PROFILES.general;
}
