// src/audio/useGameMusic.js
import { useEffect, useState } from "react";
import { gameMusic } from "./gameMusic";

/** La música suena mientras `active` sea true (ej. el `visible` del modal del minijuego). */
export function useGameMusic(active) {
  useEffect(() => {
    if (!active) return undefined;
    gameMusic.acquire();
    return () => gameMusic.release();
  }, [active]);
}

/** [silenciada, alternar] -- para el botón 🎵/🔇. */
export function useMusicMuted() {
  const [muted, setMuted] = useState(gameMusic.isMuted());
  useEffect(() => {
    setMuted(gameMusic.isMuted());
    return gameMusic.subscribe(setMuted);
  }, []);
  return [muted, gameMusic.toggleMuted];
}
