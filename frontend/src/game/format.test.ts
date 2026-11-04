import { expect, it } from "vitest";
import { compact, money } from "./format";

it("keeps compact counts as they were below a million", () => {
  expect(compact(9_999)).toBe("9,999");
  expect(compact(50_000)).toBe("50.0k");
  expect(compact(123_456)).toBe("123k");
});

it("writes compact counts of a million and more in M and B, never as thousands of k", () => {
  expect(compact(999_999)).toBe("1.0M");
  expect(compact(1_000_000)).toBe("1.0M");
  expect(compact(2_715_585)).toBe("2.7M");
  expect(compact(27_155_850)).toBe("27.2M");
  expect(compact(100_000_000)).toBe("100M");
  expect(compact(2_633_441_344)).toBe("2.6B");
});

it("keeps money as it was below a billion", () => {
  expect(money(4_099)).toBe("$4,099");
  expect(money(65_513)).toBe("$65.5k");
  expect(money(-1_768_920)).toBe("-$1.77M");
  expect(money(83_377_334)).toBe("$83.38M");
});

it("writes money of a billion and more in B, never as thousands of M", () => {
  expect(money(999_999_999)).toBe("$1.00B");
  expect(money(82_177_907_364)).toBe("$82.18B");
  expect(money(-1_500_000_000)).toBe("-$1.50B");
  expect(money(999_999)).toBe("$1.00M");
});

it("only carries into the next unit when rounding reaches it", () => {
  expect(compact(950_000)).toBe("950k");
  expect(compact(999_400)).toBe("999k");
  expect(compact(99_960)).toBe("100k");
  expect(money(99_960)).toBe("$100k");
  expect(money(999_400)).toBe("$999k");
});
