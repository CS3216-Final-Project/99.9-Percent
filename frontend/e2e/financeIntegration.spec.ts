import { test } from "./fixtures";
import { financeDuringWalkthrough } from "./financeIntegration";

test("Chapter 0 explains weekly finances in-card and preserves the real Finance dialog",async({page,withoutRoom})=>{
    await withoutRoom();
    await financeDuringWalkthrough(page);
});
