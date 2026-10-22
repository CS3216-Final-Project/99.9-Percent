import { expect, it } from "vitest";
import { cappedFinancialPredecessor, financiallyTrappedCompany } from "./__fixtures__/chapter6Finance";
import { previewCampaignAction, totalCharges } from "./campaignFinance";
import { operatingCharges } from "@/sim/settlement";
import { advanceSteps } from "@/sim/step";
import { canEnterCombined } from "@/sim/combinedCampaign";
import { act, tick, combinedCompany, protectedCombined } from "@/sim/__tests__/combinedFixture";
import { applyAction, type Action } from "@/sim";
import { chapter6FinancialRisk } from "./chapter6Finance";
import { campaignAttention } from "./campaignAttention";

const trapped = financiallyTrappedCompany();

it("reproduces the legal inherited $560 company with public engine actions", () => {
  const s = trapped, c = s.campaign!;
  expect(c.cashCents).toBe(56000);
  expect(c.apps).toHaveLength(1);
  expect(c.apps[0].capacity).toBe(1000);
  expect(c.dbCapacity).toBe(600);
  expect(c.readCache).toBeNull();
  expect(totalCharges(operatingCharges(c))).toBe(760000);
  expect(c.combinedStage).toBeTruthy();
  expect(c.step).toBe(660);
  const before = JSON.stringify(s);
  expect(chapter6FinancialRisk(s)).toMatchObject({ kind: "blocked", maximumRevenueCents: 720000 });
  expect(campaignAttention(s)).toMatchObject({ attention: "hint", target: "finance", reason: "combined-finance", action: undefined });
  expect(JSON.stringify(s)).toBe(before);
});

it("checks all affordable alternatives without claiming that a promotion or inspection repairs capacity", () => {
  const paid: Action[] = [{ type: "add_server" }, { type: "scale_up", appId: "app-1" }, { type: "start_db_upgrade" }, { type: "deploy_cache" }, { type: "deploy_load_balancer" }, { type: "install_spare" }];
  for (const action of paid) expect(previewCampaignAction(trapped, action).ok).toBe(false);
  expect(applyAction(trapped, { type: "remove_server" }).ok).toBe(false);
  expect(applyAction(trapped, { type: "set_routing", mode: "single", targets: ["app-1"] }).ok).toBe(false);
  const uncapped = act(trapped, { type: "set_traffic_limit", enabled: false });
  const bankrupt = advanceSteps(uncapped, 300).state;
  expect(bankrupt).toMatchObject({ phase: "ended", outcome: "bankrupt" });
  expect(bankrupt.campaign!.step).toBe(780);
  expect(bankrupt.campaign!.combinedStage!.completedRounds).toHaveLength(0);
  expect(bankrupt.campaign!.settlements.filter(s => s.step > 660).every(s => s.revenueCents <= 720000 && s.netCents < 0)).toBe(true);
});

it("preserves bankruptcy after spending scarce cash on optional demand without capacity", () => {
  const promoted = act(trapped, { type: "run_promotion" });
  expect(promoted.campaign!.cashCents).toBe(6000);
  const bankrupt = advanceSteps(promoted, 120).state;
  expect(bankrupt.outcome).toBe("bankrupt");
  expect(bankrupt.campaign!.scorecard!.promotionCents).toBe(50000);
  expect(chapter6FinancialRisk(bankrupt)).toBeNull();
});

it("warns before Chapter 6 entry but leaves entry and its cash unchanged", () => {
  const predecessor = cappedFinancialPredecessor();
  const s = advanceSteps(predecessor, 660-predecessor.campaign!.step).state;
  expect(canEnterCombined(s)).toBe(true);
  expect(chapter6FinancialRisk(s)?.kind).toBe("blocked");
  expect(act(s, { type: "enter_combined" }).campaign!.cashCents).toBe(s.campaign!.cashCents);
});

it("distinguishes a low-cash company with free routing recovery from the closed trap", () => {
  let s = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  s = tick(act(s, { type: "set_routing", mode: "single", targets: ["app-1"] }));
  // Cash-only boundary: keep the public fixture's usable equipment and existing earnings.
  s.campaign!.cashCents = 56000;
  expect(chapter6FinancialRisk(s)?.kind).not.toBe("blocked");
  expect(campaignAttention(s).action?.action).toEqual({ type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
  s = tick(act(s, campaignAttention(s).action!.action));
  expect(campaignAttention(s).action?.action).toEqual({ type: "set_traffic_limit", enabled: false });
  s = tick(act(s, campaignAttention(s).action!.action), 5);
  expect(s.campaign!.combinedStage!.readinessSteps).toBe(5);
});

it("does not label accepted deployment or a warmed cache as an impossible recovery", () => {
  const before = cappedFinancialPredecessor();
  const pending = act(act(before, { type: "enter_combined" }), { type: "start_db_upgrade" });
  pending.campaign!.cashCents = 1; // Funds were already paid: do not prescribe another purchase.
  expect(chapter6FinancialRisk(pending)?.kind).not.toBe("blocked");
  expect(campaignAttention(pending).attention).toBe("run");
  const cached = combinedCompany(); cached.campaign!.cashCents = 56000;
  expect(cached.campaign!.readCache).toBeTruthy();
  expect(chapter6FinancialRisk(cached)?.kind).not.toBe("blocked");
});

it("keeps a usable spare and pending earnings outside the narrow no-path proof", () => {
  const spare = protectedCombined(); spare.campaign!.cashCents = 56000;
  expect(chapter6FinancialRisk(spare)?.kind).not.toBe("blocked");
  const receipt = structuredClone(trapped);
  // Historical/mixed-period boundary: earned revenue is real cash at settlement,
  // even when the present configuration alone cannot earn enough in future periods.
  receipt.campaign!.ledger.successes = 100000;
  expect(chapter6FinancialRisk(receipt)?.kind).not.toBe("blocked");
});

it("describes a loss as a risk estimate while affordable preparation remains available", () => {
  const s = act(cappedFinancialPredecessor(), { type: "enter_combined" });
  expect(chapter6FinancialRisk(s)).toMatchObject({ kind: "risk" });
  expect(chapter6FinancialRisk(s)!.message).toContain("does not mean recovery is impossible");
  expect(previewCampaignAction(s, campaignAttention(s).action!.action).ok).toBe(true);
  expect(chapter6FinancialRisk(combinedCompany())).toBeNull();
});

it("respects the strict purchase boundary rather than promising a purchase that exhausts cash", () => {
  const s = structuredClone(trapped);
  s.campaign!.cashCents = 100000;
  expect(previewCampaignAction(s, { type: "add_server" }).ok).toBe(false);
  expect(chapter6FinancialRisk(s)?.kind).toBe("blocked");
  s.campaign!.cashCents++;
  expect(previewCampaignAction(s, { type: "add_server" }).ok).toBe(true);
  expect(chapter6FinancialRisk(s)?.kind).not.toBe("blocked");
});

it("warns about a new low-cash traffic cap even if the preceding period was profitable", () => {
  const s = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  s.campaign!.cashCents = 56000; // A buffer boundary, with the real prepared assets unchanged.
  expect(s.campaign!.settlements.at(-1)!.netCents).toBeGreaterThan(0);
  expect(chapter6FinancialRisk(s)?.kind).toBe("risk");
  expect(chapter6FinancialRisk(s)!.message).toContain("At the current traffic limit");
  expect(campaignAttention(s).action?.action).toEqual({ type: "set_traffic_limit", enabled: false });
  const fullDemand = tick(act(s, { type: "set_traffic_limit", enabled: false }), 5);
  expect(chapter6FinancialRisk(fullDemand)).toBeNull();
  expect(fullDemand.campaign!.combinedStage!.readinessSteps).toBe(5);
});
