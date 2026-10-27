import { fireEvent, screen, within } from "@testing-library/react";

/** Follow the public equipment shortcut before exercising a relocated action. */
export function inspectionAction(name:RegExp):HTMLElement {
  const existing=screen.queryByRole("button",{name});
  if (existing) return existing;
  const equipment=/database/i.test(name.source)?"Database":/cache/i.test(name.source)?"Read Cache":/health checks/i.test(name.source)?"Monitoring":/limit|routing|balanc|failover/i.test(name.source)?"Network":"App Server";
  const current=document.querySelector('.component-inspection');
  if(current) fireEvent.click(within(current as HTMLElement).getByRole("button",{name:"Close"}));
  fireEvent.click(screen.getByRole("button",{name:equipment}));
  const text=name.source;
  if(equipment==="Monitoring") fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
  if(equipment==="App Server") {
    if(/autoscal|Scale up|Restore|Reserve|Release|Install spare/i.test(text)) fireEvent.click(screen.getByRole("button",{name:"Server management"}));
    if(/autoscal/i.test(text))fireEvent.click(screen.getByRole("button",{name:"Autoscaling"}));
    else if(/Scale up|Restore|Reserve|Release|Install spare/i.test(text)) {
      const id=text.match(/App (\d+)/)?.[1];
      fireEvent.click(document.querySelector<HTMLElement>(id?`[data-guidance-app="app-${id}"]`:'[data-guidance-app]')!);
    }
  }
  if(equipment==="Network"&&/routing|balanc|failover/i.test(text)) {
    const management=screen.queryByRole("button",{name:"Network management"});
    if(management)fireEvent.click(management);
  }
  return screen.getByRole("button",{name});
}
/** Acknowledged advice now visits equipment before reaching the unchanged action. */
export function enterHighlightedInspection() {
  const target=document.querySelector<HTMLElement>('.campaign-gold-attention');
  if(target?.matches('[data-tutorial^="inspect-"]')) fireEvent.click(target);
  for(let step=0;step<5;step++) {
    const entry=document.querySelector<HTMLElement>('.campaign-gold-attention[data-guidance-app], .campaign-gold-attention[data-inspection-entry], .campaign-gold-attention[data-inspection-back], summary.campaign-gold-attention');
    if(!entry)break;fireEvent.click(entry);
  }
}
