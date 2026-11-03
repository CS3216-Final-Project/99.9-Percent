import { num } from "@/game/format";
import { useCountUp } from "./useCountUp";

/** Text that may still be counting: screen readers get only the settled figure, never the ones on the way. */
export function Settled({ shown, final }: { shown: string; final: string }) {
  return shown === final ? final : <><span aria-hidden="true">{shown}</span><span className="visually-hidden">{final}</span></>;
}

/** A traffic figure, in requests per second, that counts to each new second's value. */
export function CountedRequests({ value }: { value: number }) {
  const text = (n: number) => `${num(n)} requests/s`;
  return <Settled shown={text(useCountUp(value))} final={text(value)} />;
}
