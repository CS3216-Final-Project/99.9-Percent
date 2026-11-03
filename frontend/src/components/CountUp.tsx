import { num } from "@/game/format";
import { useCountUp } from "./useCountUp";

/** Text that may still be counting: screen readers get only the settled figure, never the ones on the way. */
export function Settled({ shown, final }: { shown: string; final: string }) {
  return shown === final ? final : <><span aria-hidden="true">{shown}</span><span className="visually-hidden">{final}</span></>;
}

/** A traffic figure that counts to each new second's value, with an optional unit after it. */
export function Counted({ value, unit }: { value: number; unit?: string }) {
  const text = (n: number) => unit ? `${num(n)} ${unit}` : num(n);
  return <Settled shown={text(useCountUp(value))} final={text(value)} />;
}

/** A traffic figure, in requests per second, that counts to each new second's value. */
export const CountedRequests = ({ value }: { value: number }) => <Counted value={value} unit="requests/s" />;
