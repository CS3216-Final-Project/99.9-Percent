// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** The project never uses the em dash, in player-visible copy or in code. */
it("no source file contains an em dash", () => {
  // Built from parts so this file does not match itself.
  const dash = new RegExp(String.fromCharCode(0x2014) + "|\\\\u" + "2014");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|css)$/.test(entry.name) && dash.test(readFileSync(path, "utf8"))) offenders.push(path);
    }
  };
  walk(import.meta.dirname);
  expect(offenders).toEqual([]);
});
