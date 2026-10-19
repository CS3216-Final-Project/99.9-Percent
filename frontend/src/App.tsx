import { lazy, Suspense } from 'react';
import Game, { BootScreen } from './components/Game';
import { TooltipLayer } from './components/Tooltip';
import { useEdition } from './phone/editionContext';

// The phone edition's shell and styles load only on a phone, so none of it reaches the desktop edition.
const PhoneApp = lazy(() => import('./phone/PhoneApp'));

/** Picks the edition's shell once per page (see phone/edition.ts): the desktop's Game, or the phone's own. */
export default function App() {
  const edition = useEdition();
  return (
    <>
      {edition === 'phone' ? <Suspense fallback={<BootScreen />}><PhoneApp /></Suspense> : <Game />}
      <TooltipLayer />
    </>
  );
}
