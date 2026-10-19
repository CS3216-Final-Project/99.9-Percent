import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELEASE_AFTER_MS, saveTextFile } from "./download";

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no object URLs; stand in for them.
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:save"), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("saving a text file", () => {
  it("starts a download of the text under its name", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("company.json");
      expect(this.href).toBe("blob:save");
    });
    saveTextFile("company.json", '{"a":1}');
    expect(click).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{"a":1}');
  });

  it("keeps the file's address alive while the browser starts saving it, then frees it", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    saveTextFile("company.json", "{}");
    // Freed at once, a busy browser could cancel the download before reading the file.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RELEASE_AFTER_MS - 1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:save");
  });
});
