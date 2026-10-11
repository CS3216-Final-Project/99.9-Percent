import { useId, useRef, useState } from "react";
import { exportGame, rawLegacySave, rawSave } from "@/game/persist";
import { useGame } from "@/game/store";
import { Icon } from "./icons";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/** Shared file controls; importing validates first and asks before replacing a run. */
export function SaveFiles() {
  const { game, mode, remainderMs, measurement, importSave, resumeLegacySave, notify } = useGame();
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const [confirmLegacy, setConfirmLegacy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const legacyTitle = useId();
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
    <h4><Icon name="save" size={20} />Save files</h4>
    <p className="menu-note">Export a file to keep a backup or continue on another browser. Campaign and Classic files open in their matching mode.</p>
    <div className="menu-actions">
      <button type="button" className="btn" onClick={() => download(`${mode}.json`, exportGame(game, remainderMs, measurement))}>
        <Icon name="download" size={20} />{mode === "campaign" ? "Export current company" : "Export current run"}</button>
      <button type="button" className="btn" disabled={rawSave(mode) === null} onClick={() => download(`stored-${mode}.json`, rawSave(mode) ?? "null")}>
        <Icon name="copy" size={20} />Export original stored save</button>
      <button type="button" className="btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={20} />Import save</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Save file to import"
      onChange={e => void pickImport(e.target.files?.[0])} />
    {pending && <div className="menu-confirm">
      <p>Replace the current company with {pending.name}? The file replaces the saved run in its matching mode. Export that run first if you want to keep it.</p>
      <div className="btn-row"><button type="button" className="btn btn-danger" onClick={() => { importSave(pending.text); setPending(null); }}>Confirm import</button>
        <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>Cancel import</button></div></div>}
    {legacy !== null && <div className="menu-sub" role="group" aria-labelledby={legacyTitle}>
      <h5 id={legacyTitle}>Pre-update save</h5>
      <p className="menu-note">Your original save is preserved. Resume a copy in Classic or export the original file.</p>
      <div className="menu-actions">
        <button type="button" className="btn" onClick={() => download("pre-update-save.json", legacy)}><Icon name="download" size={20} />Export pre-update save</button>
        <button type="button" className="btn" onClick={() => { setConfirmLegacy(true); setPending(null); }}><Icon name="play" size={20} />Resume pre-update save</button>
      </div>
      {confirmLegacy && <div className="menu-confirm">
        <p>This replaces the saved Classic run with a copy of your pre-update save. Export your Classic run first if you want to keep it. Your original pre-update save remains unchanged.</p>
        <div className="btn-row"><button type="button" className="btn btn-danger" onClick={() => { resumeLegacySave(); setConfirmLegacy(false); }}>Confirm resume</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmLegacy(false)}>Cancel resume</button></div></div>}
    </div>}
  </section>;
}
