import { useEffect } from "react";
import { PHONE_SCOPE } from "@/game/scope";
import { useGame } from "@/game/store";
import { BootScreen } from "@/components/Game";
import { useGameRuntime } from "@/components/useGameRuntime";
import { EditionProvider } from "./EditionProvider";
import { PhoneGameLayout } from "./PhoneGameLayout";
import "./phone.css";

/**
 * The phone edition's shell: the same store, simulation, room and lifecycle as the desktop, booted with the phone
 * scope and laid out by PhoneGameLayout. App renders it instead of Game when the page is a phone (see edition.ts).
 */
export default function PhoneApp() {
  const ready = useGame((s) => s.ready);
  useGameRuntime(PHONE_SCOPE);
  // Mark the document too, so phone styles also reach dialogs and tooltips rendered outside the app root.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.edition = "phone";
    return () => { delete root.dataset.edition; };
  }, []);
  return <EditionProvider edition="phone">
    {ready ? <PhoneGameLayout /> : <BootScreen />}
  </EditionProvider>;
}
