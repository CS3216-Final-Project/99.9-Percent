import { createContext, useContext, type RefObject } from "react";
interface GuidanceUI {
  available: boolean;
  runGold: boolean;
  pauseGold: boolean;
  resumeGold: boolean;
  hintGold: boolean;
  confirmationGold: boolean;
  opened: boolean;
  button: RefObject<HTMLButtonElement | null> | null;
  openHint: () => void;
  riskOpen: (open: boolean) => void;
}
export const CampaignAttentionContext = createContext<GuidanceUI>({ available: false, runGold: false, pauseGold: false, resumeGold: false, hintGold: false, confirmationGold: false, opened: false, button: null, openHint: () => {}, riskOpen: () => {} });
export const useCampaignAttention = () => useContext(CampaignAttentionContext);

/** Reuse purchase previews inside the shared component dialog without moving the camera. */
export const InspectionPurchaseContext = createContext(false);
