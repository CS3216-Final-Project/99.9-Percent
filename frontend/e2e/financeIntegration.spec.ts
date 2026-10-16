import { test } from "./fixtures";
import { financeDuringWalkthrough } from "./financeIntegration";

test("Finance overlays the spotlight walkthrough and restores its step and focus",async({page})=>{
    await financeDuringWalkthrough(page);
});
