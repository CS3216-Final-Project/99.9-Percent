import type { Campaign } from "@/sim/campaignTypes";
import { nextIntroductionComponent } from "@/sim/introduction";
export const INTRODUCTION_COPY = {
 gateway:{name:"Network",description:"Customer requests enter your system through the Network."},
 app:{name:"App Servers",description:"App Servers process requests, but each server can handle only a limited amount of work."},
 db:{name:"Database",description:"The Database stores and retrieves information; too much work can make it a bottleneck."},
 monitoring:{name:"Monitoring",description:"Latency is waiting time, errors are failed requests, and backlog is work still waiting."},
};
export function introductionInstruction(c:Campaign) {
 const equipment=nextIntroductionComponent(c);
 return equipment?{equipment,...INTRODUCTION_COPY[equipment],message:`Open ${INTRODUCTION_COPY[equipment].name}, read its inspection, then choose Got it or close the popup.`}:
 {equipment:undefined,name:"Finish",description:"Requests flow from Network to App Servers to Database; Monitoring helps you understand service health.",message:"All four components are explored. Choose Complete Introduction to enter Chapter 1."};
}
