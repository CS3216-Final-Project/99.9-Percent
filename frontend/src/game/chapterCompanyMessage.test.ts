import { expect, it } from "vitest";
import { newGame } from "@/sim";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { chapterAt, reportSpeaker } from "./chapterCompanyMessage";

it("names the colleague who introduced the chapter the company was playing at a game second", () => {
  const companies = [[newGame(), 1, "maya"], [dataCompany("read-heavy", false), 2, "alex"], [dataCompany(), 3, "jordan"], [spikeCompany(), 4, "sam"], [reliabilityCompany(), 5, "taylor"]] as const;
  for (const [game, chapter, speaker] of companies) {
    const c = game.campaign!;
    expect(chapterAt(c, c.step)).toBe(chapter);
    expect(reportSpeaker(c, c.step)).toBe(speaker);
  }
});

it("keeps an earlier chapter's colleague for a game second before the next chapter was entered", () => {
  const c = reliabilityCompany().campaign!;
  expect(reportSpeaker(c, c.reliabilityStage!.enteredStep - 1)).toBe("sam");
  expect(reportSpeaker(c, c.spikeStage!.enteredStep - 1)).toBe("jordan");
  expect(reportSpeaker(c, c.dataStage!.enteredStep - 1)).toBe("alex");
  expect(reportSpeaker(c, c.scaling!.enteredStep - 1)).toBe("maya");
});
