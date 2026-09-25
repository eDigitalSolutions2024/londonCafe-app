// src/audio/gameMusic.js
//
// Música de fondo de los minijuegos: un loop original de deep house (ver
// tools/generate-game-music.js). Servicio ÚNICO con conteo de referencias:
// cada minijuego pide `acquire()` al abrirse y `release()` al cerrarse; suena
// mientras haya al menos uno abierto. Como PetScreen monta varios juegos a la
// vez (solo uno visible), el conteo evita cortes o dobles reproductores.
//
// Reglas de "buena educación":
//  - Respeta el interruptor de silencio de iOS (playsInSilentMode: false).
//  - Se pausa sola al mandar la app a segundo plano.
//  - El usuario la silencia con el botón 🎵 y se recuerda (AsyncStorage).
//  - Volumen bajo (0.35): es fondo, no protagonista.
//  - Si el binario instalado no trae el módulo nativo expo-audio (ej. un
//    dev-client viejo), NO truena: simplemente no hay música ni botón.
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TRACK = require("../../assets/audio/london-deep-house.wav");
const MUTED_KEY = "@london/gameMusicMuted";
const VOLUME = 0.35;
const IDLE_RELEASE_MS = 60_000; // libera el reproductor si pasa 1 min sin juegos abiertos

let audio = null;
try {
  // eslint-disable-next-line global-require
  audio = require("expo-audio");
} catch (e) {
  audio = null;
  console.log("🎵 expo-audio no está en este binario: música de minijuegos desactivada.");
}

let player = null;
let modeSet = false;
let refs = 0;
let muted = false;
let prefsLoaded = false; // no suena nada hasta saber si el usuario la había silenciado
let appActive = AppState.currentState === "active";
let broken = false; // si algo falla una vez, no se reintenta en bucle
let idleTimer = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(muted));

function ensurePlayer() {
  if (player || !audio || broken) return player;
  try {
    if (!modeSet) {
      audio
        .setAudioModeAsync({
          playsInSilentMode: false,
          interruptionMode: "mixWithOthers",
          shouldPlayInBackground: false,
          allowsRecording: false,
        })
        .catch((e) => console.log("🎵 setAudioModeAsync:", e?.message));
      modeSet = true;
    }
    player = audio.createAudioPlayer(TRACK);
    player.loop = true;
    player.volume = VOLUME;
  } catch (e) {
    broken = true;
    player = null;
    console.log("🎵 no se pudo crear el reproductor:", e?.message);
  }
  return player;
}

/** Reconcilia el estado real del reproductor con lo que debería estar pasando. */
function sync() {
  if (!audio || broken) return;
  try {
    const shouldPlay = prefsLoaded && refs > 0 && !muted && appActive;
    if (shouldPlay) {
      const p = ensurePlayer();
      if (p && !p.playing) p.play();
    } else if (player && player.playing) {
      player.pause();
    }
  } catch (e) {
    broken = true;
    console.log("🎵 error de reproducción:", e?.message);
  }
}

// La preferencia guardada se carga una sola vez.
let prefsPromise = null;
function loadPrefs() {
  if (!prefsPromise) {
    prefsPromise = AsyncStorage.getItem(MUTED_KEY)
      .then((v) => { if (!prefsLoaded) muted = v === "1"; })
      .catch(() => {})
      .then(() => {
        prefsLoaded = true;
        emit();
        sync();
      });
  }
  return prefsPromise;
}

AppState.addEventListener("change", (state) => {
  appActive = state === "active";
  sync();
});

export const gameMusic = {
  /** ¿Hay módulo nativo de audio en este binario? Si no, no se muestra ni el botón. */
  isAvailable: () => !!audio && !broken,
  isMuted: () => muted,

  acquire() {
    refs += 1;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    loadPrefs();
    sync();
  },

  release() {
    refs = Math.max(0, refs - 1);
    sync();
    if (refs === 0 && player && !idleTimer) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (refs === 0 && player) {
          try { player.remove(); } catch (e) { /* ya liberado */ }
          player = null;
        }
      }, IDLE_RELEASE_MS);
    }
  },

  setMuted(value) {
    prefsLoaded = true; // una decisión explícita del usuario manda sobre lo guardado
    muted = !!value;
    AsyncStorage.setItem(MUTED_KEY, muted ? "1" : "0").catch(() => {});
    emit();
    sync();
  },

  toggleMuted() {
    gameMusic.setMuted(!muted);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
