// src/audio/holidayMusic.js
//
// Música navideña de fondo en toda la app (temporada decembrina).
// Pistas ORIGINALES sintetizadas de villancicos de dominio público
// (ver tools/generate-christmas-music.js). Al abrir la app suena una al azar;
// al terminar, sigue otra al azar (sin repetir la misma seguida).
//
// Reglas de "buena educación" (mismas que la música de los minijuegos):
//  - Solo en temporada (HOLIDAY_START..HOLIDAY_END): fuera de fechas no suena
//    nada y el botón ni aparece -> no hace falta otro release para quitarla.
//  - Respeta el interruptor de silencio de iOS (playsInSilentMode: false).
//  - Se pausa al mandar la app a segundo plano.
//  - Se calla mientras haya un minijuego abierto (ellos traen su propia música).
//  - El usuario la silencia con el botón 🔔/🔕 y se recuerda (AsyncStorage).
//  - Volumen bajo: es ambiente, no protagonista.
//  - Si el binario no trae expo-audio, NO truena: simplemente no hay música.
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { gameMusic } from "./gameMusic";

const TRACKS = [
  require("../../assets/audio/navidad-1.m4a"),
  require("../../assets/audio/navidad-2.m4a"),
  require("../../assets/audio/navidad-3.m4a"),
];
const MUTED_KEY = "@london/holidayMusicMuted";
const VOLUME = 0.28;
// Temporada (hora local del teléfono). Mes 0-based: 11 = diciembre.
const HOLIDAY_START = new Date(2026, 10, 26); // 26-nov-2026
const HOLIDAY_END = new Date(2027, 0, 7); // hasta el 6-ene-2027 (Día de Reyes) inclusive

let audio = null;
try {
  // eslint-disable-next-line global-require
  audio = require("expo-audio");
} catch (e) {
  audio = null;
}

let player = null;
let statusSub = null;
let modeSet = false;
let started = false;
let muted = false;
let prefsLoaded = false;
let appActive = AppState.currentState === "active";
let gameOpen = false;
let broken = false;
let current = -1;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(muted));

export const isHolidaySeason = (now = new Date()) => now >= HOLIDAY_START && now < HOLIDAY_END;

function pickNext() {
  if (TRACKS.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * TRACKS.length); } while (i === current);
  return i;
}

function loadTrack(i) {
  current = i;
  try {
    if (!modeSet) {
      audio
        .setAudioModeAsync({
          playsInSilentMode: false,
          interruptionMode: "mixWithOthers",
          shouldPlayInBackground: false,
          allowsRecording: false,
        })
        .catch(() => {});
      modeSet = true;
    }
    if (!player) {
      player = audio.createAudioPlayer(TRACKS[i]);
      player.volume = VOLUME;
      player.loop = false;
      statusSub = player.addListener("playbackStatusUpdate", (st) => {
        if (st?.didJustFinish) {
          // siguiente canción al azar
          loadTrack(pickNext());
          sync();
        }
      });
    } else {
      player.replace(TRACKS[i]);
      player.volume = VOLUME;
    }
  } catch (e) {
    broken = true;
    console.log("🎄 no se pudo cargar la música navideña:", e?.message);
  }
}

function sync() {
  if (!audio || broken || !started) return;
  try {
    const shouldPlay = prefsLoaded && !muted && appActive && !gameOpen && isHolidaySeason();
    if (shouldPlay) {
      if (!player) loadTrack(pickNext());
      if (player && !player.playing) player.play();
    } else if (player && player.playing) {
      player.pause();
    }
  } catch (e) {
    broken = true;
    console.log("🎄 error de reproducción:", e?.message);
  }
}

AppState.addEventListener("change", (state) => {
  appActive = state === "active";
  sync();
});
gameMusic.subscribeActive((open) => {
  gameOpen = open;
  sync();
});

export const holidayMusic = {
  /** ¿Se debe mostrar el botón? (hay audio nativo y estamos en temporada) */
  isAvailable: () => !!audio && !broken && isHolidaySeason(),
  isMuted: () => muted,

  /** Se llama una vez al montar la app. */
  start() {
    if (started || !audio || !isHolidaySeason()) return;
    started = true;
    AsyncStorage.getItem(MUTED_KEY)
      .then((v) => { if (!prefsLoaded) muted = v === "1"; })
      .catch(() => {})
      .then(() => {
        prefsLoaded = true;
        emit();
        sync();
      });
  },

  setMuted(value) {
    prefsLoaded = true;
    muted = !!value;
    AsyncStorage.setItem(MUTED_KEY, muted ? "1" : "0").catch(() => {});
    emit();
    sync();
  },

  toggleMuted() {
    holidayMusic.setMuted(!muted);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Solo para pruebas: libera el reproductor. */
  _dispose() {
    try { statusSub?.remove(); player?.remove(); } catch (e) { /* noop */ }
    player = null; statusSub = null; started = false;
  },
};
