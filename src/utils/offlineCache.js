import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api/client";

// Soporte offline para los minijuegos de PetScreen (Café Crush, Salto
// Café, Atrapa, Barista Ninja) -- para que alguien en el avión pueda
// seguir jugando aunque /pet no responda. Sin librería de detección de
// red nueva (NetInfo, que necesitaría un build nativo): se reacciona a
// que el fetch FALLE (TypeError de red, sin `.status`), no se detecta la
// desconexión de antemano.
const PET_CACHE_KEY = "lc_pet_cache_v1";
const PLAY_QUEUE_KEY = "lc_pet_play_queue_v1";

export async function savePetCache(petRes) {
  try {
    await AsyncStorage.setItem(PET_CACHE_KEY, JSON.stringify({ data: petRes, cachedAt: Date.now() }));
  } catch {
    // AsyncStorage puede fallar en algunos dispositivos/contextos -- no es
    // crítico, el modo offline simplemente no tendrá caché esa vez.
  }
}

export async function loadPetCache() {
  try {
    const raw = await AsyncStorage.getItem(PET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch {
    return null;
  }
}

// Un fetch fallido por RED (sin internet) no trae `.status` (nunca llegó
// a haber una respuesta HTTP) -- un error de VALIDACIÓN del server sí
// (PET_TIRED, NO_COFFEE, etc, con status 400/403/...). Solo lo primero
// cuenta como "estamos offline, hay que encolar esto para después".
export function isNetworkFailure(err) {
  return !err?.status;
}

export async function queuePlay(payload) {
  try {
    const raw = await AsyncStorage.getItem(PLAY_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ payload, queuedAt: Date.now() });
    await AsyncStorage.setItem(PLAY_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // si ni esto se puede guardar, el puntaje se pierde -- mejor que
    // tronar la pantalla del juego.
  }
}

// Se llama cuando /pet SÍ responde de nuevo (o sea, ya hay conexión) --
// manda cada jugada pendiente EN ORDEN y las va quitando de la cola
// conforme el server las acepta. Si alguna falla otra vez (offline de
// nuevo a medio flush), para ahí y deja el resto en la cola para el
// siguiente intento.
export async function flushQueuedPlays() {
  let queue;
  try {
    const raw = await AsyncStorage.getItem(PLAY_QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    return;
  }
  if (!queue.length) return;

  // `i` termina en queue.length si se mandaron todas, o en el índice
  // donde se topó con un fallo de RED (esa y las siguientes se quedan
  // encoladas para el próximo intento) -- un error de VALIDACIÓN (no de
  // red) simplemente descarta esa jugada puntual y sigue con la siguiente.
  let i = 0;
  for (; i < queue.length; i++) {
    try {
      await apiFetch("/pet/play", { method: "POST", body: JSON.stringify(queue[i].payload) });
    } catch (e) {
      if (isNetworkFailure(e)) break;
    }
  }
  try {
    await AsyncStorage.setItem(PLAY_QUEUE_KEY, JSON.stringify(queue.slice(i)));
  } catch {
    // no crítico
  }
}

export async function getQueuedPlaysCount() {
  try {
    const raw = await AsyncStorage.getItem(PLAY_QUEUE_KEY);
    return raw ? JSON.parse(raw).length : 0;
  } catch {
    return 0;
  }
}
