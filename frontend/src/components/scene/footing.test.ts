import { describe, expect, it } from "vitest";
import { footingAt, STRIDE } from "./footing";
import { POS } from "./layout";

describe("what is underfoot", () => {
  it("is carpet where the crew work and rest, stone and tile at reception and in the kitchen, concrete in the corridors", () => {
    expect(footingAt("office", -3, 7.4)).toBe("soft");
    expect(footingAt("office", 18.5, 6.5)).toBe("soft");
    expect(footingAt("office", 3.2, 13.3)).toBe("hard");
    expect(footingAt("office", 18.4, -7.4)).toBe("hard");
    expect(footingAt("office", 13.2, 0)).toBe("hard");
  });

  it("is the raised floor in the server hall, carpet in the monitoring room and concrete in the stores", () => {
    expect(footingAt("servers", POS.cache.x, POS.cache.z + 1)).toBe("hollow");
    expect(footingAt("servers", 8.2, -6)).toBe("soft");
    expect(footingAt("servers", 17.5, 0)).toBe("hard");
    // The same place upstairs is open desks, on carpet.
    expect(footingAt("office", POS.cache.x, POS.cache.z + 1)).toBe("soft");
  });

  it("takes longer strides running than walking", () => {
    expect(STRIDE.run).toBeGreaterThan(STRIDE.walk);
  });
});
