import { useState } from "react";
import type { Campaign } from "@/sim/campaignTypes";
import { campaignUptime } from "@/game/campaignUptime";
import { ninesOf, uptimePct } from "@/game/format";
import { num } from "@/game/format";
import type { ChapterEnd } from "@/game/chapterCompletion";
import { ChapterEndFoot } from "./ChapterEndFoot";
import { Modal } from "./ui";

/**
 * The Launch Week score card: how close to 100% the service stayed, in nines, with the result copyable
 * for sharing. Either choice acknowledges the opening milestone; Continue also enters Scaling & Routing.
 */
export default function LaunchScore({ campaign, end }: { campaign: Campaign; end: ChapterEnd }) {
  const [copied, setCopied] = useState(false);
  const c = campaign;
  const uptime = campaignUptime(c) ?? 0;
  const nines = ninesOf(uptime);
  const text = nines >= 5 ? "a perfect five nines" : nines === 0 ? "under one nine" : nines === 1 ? "one nine" : nines === 2 ? "two nines" : "three nines";
  const lost = c.cumulative.failed + c.cumulative.rejected;
  const result = `Launch Week: ${uptimePct(uptime)} uptime (${text}), ${num(lost)} requests lost - 99.99%`;
  const copy = () => {
    void navigator.clipboard?.writeText(result).then(() => setCopied(true), () => {});
  };
  return <Modal title="Launch Week complete" icon={{ kind: "go", name: "goal" }}>
    <p>One week of launch traffic and its first database overload. Your architecture, cash and research pick carry into the campaign.</p>
    <dl className="purchase-tiles">
      <div><dt>Uptime</dt><dd><strong>{uptimePct(uptime)}</strong></dd></div>
      <div><dt>Score</dt><dd><strong>{text}</strong></dd></div>
      <div><dt>Requests lost</dt><dd><strong>{num(lost)}</strong></dd></div>
    </dl>
    <ChapterEndFoot end={end} extra={<button className="btn btn-quiet" onClick={copy}>{copied ? "Copied" : "Copy result"}</button>} />
  </Modal>;
}
