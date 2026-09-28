import { useEffect, useState } from 'react';
import { getHealth } from './lib/api.ts';
import { World } from './scene/World.tsx';
import { useGameStore } from './store/gameStore.ts';

export default function App() {
  const { language, level } = useGameStore();
  const [api, setApi] = useState('checking…');

  useEffect(() => {
    getHealth()
      .then((h) => setApi(`ok (${h.time})`))
      .catch((e: Error) => setApi(`offline: ${e.message}`));
  }, []);

  return (
    <div className="app">
      <World />
      <div className="hud">
        <strong>LingoQuest</strong>
        <span>
          {language} · {level}
        </span>
        <span>API: {api}</span>
      </div>
    </div>
  );
}
