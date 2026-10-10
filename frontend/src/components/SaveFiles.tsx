import { useRef, useState } from "react";
import { exportGame, rawLegacySave, rawSave } from "@/game/persist";
import { useGame } from "@/game/store";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/** Shared file controls; importing validates first and asks before replacing a run. */
export function SaveFiles() {
  const { game, mode, remainderMs, importSave, resumeLegacySave, notify } = useGame();
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [confirmLegacy, setConfirmLegacy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const legacy = rawLegacySave();
  const pickImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending({ name: file.name, text: await file.text() });
      setConfirmLegacy(false);
    } catch { notify("Could not read that save file.", "error"); }
    if (fileInput.current) fileInput.current.value = "";
  };
  return <section className="menu-section" aria-label="Save files">
    <h4>Save files</h4>
    <p>Export a file to keep a backup or continue on another browser. Campaign and Classic files open in their matching mode.</p>
    <div className="btn-row">
      <button className="btn" onClick={() => download(`${mode}.json`, exportGame(game, remainderMs))}>
        {mode === "campaign" ? "Export current company" : "Export current run"}</button>
      <button className="btn" disabled={rawSave(mode) === null} onClick={() => download(`stored-${mode}.json`, rawSave(mode) ?? "null")}>Export original stored save</button>
      <button className="btn" onClick={() => fileInput.current?.click()}>Import save</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Save file to import"
      onChange={e => void pickImport(e.target.files?.[0])} />
    {pending && <><p>Replace the current company with {pending.name}? The file replaces the saved run in its matching mode. Export that run first if you want to keep it.</p>
      <div className="btn-row"><button className="btn" onClick={() => { importSave(pending.text); setPending(null); }}>Confirm import</button>
        <button className="btn" onClick={() => setPending(null)}>Cancel import</button></div></>}
    {legacy !== null && <>
      <h4>Pre-update save</h4>
      <p>Your original save is preserved. Resume a copy in Classic or export the original file.</p>
      <div className="btn-row"><button className="btn" onClick={() => download("pre-update-save.json", legacy)}>Export pre-update save</button>
        <button className="btn" onClick={() => { setConfirmLegacy(true); setPending(null); }}>Resume pre-update save</button></div>
      {confirmLegacy && <><p>This replaces the saved Classic run with a copy of your pre-update save. Export your Classic run first if you want to keep it. Your original pre-update save remains unchanged.</p>
        <div className="btn-row"><button className="btn" onClick={() => { resumeLegacySave(); setConfirmLegacy(false); }}>Confirm resume</button>
          <button className="btn" onClick={() => setConfirmLegacy(false)}>Cancel resume</button></div></>}
    </>}
  </section>;
}
