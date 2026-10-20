import type { Action } from "@/sim";
import type { ButtonHTMLAttributes } from "react";
import { useGame } from "@/game/store";
import { previewCampaignAction } from "@/game/campaignFinance";
import { guidanceActionId } from "@/game/campaignAttention";
/** A reachable explanation outside native disabled buttons and fieldsets. */
export function CampaignUnavailable({action,disabled}:{action:Action;disabled:boolean}) {
    const game = useGame(s=>s.game);
    const onboarding = useGame(s=>s.onboarding);
    if (!disabled) return null;
    const p = previewCampaignAction(game,action);
    const reason = onboarding ? "Finish or skip the introduction first." : p.ok ? "This setting is already selected or its current UI prerequisite is not met." : p.reason;
    return <p className="campaign-action-reason" role="note" tabIndex={0}>{reason}</p>;
}
export function CampaignDecisionButton({decision,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{decision:Action}) {
    return <><button {...props} data-guidance-action={guidanceActionId(decision)}/><CampaignUnavailable action={decision} disabled={!!props.disabled}/></>;
}
