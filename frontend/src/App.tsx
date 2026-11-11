import { lazy, Suspense, useState } from 'react';
import Game, { BootScreen } from './components/Game';
import { TooltipLayer } from './components/Tooltip';
import { currentBoothPage } from './game/booth';
import { useEdition } from './phone/editionContext';

// The phone edition's shell and styles load only on a phone, so none of it reaches the desktop edition.
const PhoneApp = lazy(() => import('./phone/PhoneApp'));
// Booth play and the big-screen leaderboard load only on /steps and /steps/board.
const BoothLayer = lazy(() => import('./components/booth/BoothLayer'));
const BoothBoard = lazy(() => import('./components/booth/BoothBoard'));

/** Picks the edition's shell once per page (see phone/edition.ts): the desktop's Game, or the phone's own. */
export default function App() {
  const edition = useEdition();
  const [booth] = useState(currentBoothPage);
  if (booth === 'board') return <Suspense fallback={null}><BoothBoard /></Suspense>;
  return (
    <>
      {edition === 'phone' ? <Suspense fallback={<BootScreen />}><PhoneApp /></Suspense> : <Game />}
      {booth === 'play' && <Suspense fallback={null}><BoothLayer /></Suspense>}
      <TooltipLayer />
    </>
  );
}
