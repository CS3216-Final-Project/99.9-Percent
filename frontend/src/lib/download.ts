/** How long a saved file's address stays alive after the download starts, in milliseconds. */
export const RELEASE_AFTER_MS = 60_000;

/**
 * Hand the player a text file to save. Its address is freed a while later rather than at once: Chromium can cancel a
 * download whose address is freed before it has started reading it, as happens on a busy machine.
 */
export function saveTextFile(name: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MS);
}
