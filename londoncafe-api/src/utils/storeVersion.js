// src/utils/storeVersion.js
//
// Detecta la versión REALMENTE publicada (ya aprobada/visible) en cada
// tienda, para poder avisarle a quien tenga una versión vieja instalada
// -- "cuando exista en la tienda", no cuando nosotros la subamos (Apple
// puede tardar horas/días en aprobarla).
//
// iOS: API oficial de Apple (iTunes Lookup), estable y documentada.
// Android: Google no tiene una API pública equivalente -- se lee del
// HTML público de la ficha de Play Store (mismo truco que usan librerías
// como react-native-store-version). Es más frágil (Google podría cambiar
// el formato interno sin avisar), así que cualquier fallo aquí se
// resuelve devolviendo null en vez de tronar -- sin versión de Android
// detectada, simplemente no se avisa nada por ese lado hasta la
// siguiente corrida.

const IOS_BUNDLE_ID = "com.londoncafe.app";
const ANDROID_PACKAGE = "com.londoncafe.app";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h -- no tiene sentido pegarle a Apple/Google en cada request
let cache = { at: 0, ios: null, android: null };

async function fetchIOSVersion() {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`);
    const data = await res.json();
    const version = data?.results?.[0]?.version;
    return typeof version === "string" ? version : null;
  } catch (e) {
    console.log("⚠️ storeVersion iOS ERROR:", e?.message);
    return null;
  }
}

async function fetchAndroidVersion() {
  try {
    const res = await fetch(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=es`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const html = await res.text();
    // El HTML de Play Store trae la versión envuelta en un blob de datos
    // interno tipo `"141":[[["1.1.2"]]]` -- la clave numérica ("141") no
    // está documentada y podría cambiar, así que primero se intenta esa
    // forma específica y si no aparece, se cae a un patrón más genérico
    // (cualquier string tipo versión envuelto en [[[ "..." ]]]).
    const specific = html.match(/"141":\[\[\["([\d.]+)"\]\]/);
    if (specific) return specific[1];
    const generic = html.match(/\[\[\["(\d+\.\d+(?:\.\d+)?)"\]\]/);
    return generic ? generic[1] : null;
  } catch (e) {
    console.log("⚠️ storeVersion Android ERROR:", e?.message);
    return null;
  }
}

async function getLiveStoreVersions({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - cache.at < CACHE_TTL_MS) return { ios: cache.ios, android: cache.android };

  const [ios, android] = await Promise.all([fetchIOSVersion(), fetchAndroidVersion()]);
  cache = { at: now, ios: ios || cache.ios, android: android || cache.android };
  return { ios: cache.ios, android: cache.android };
}

// Compara "1.2" vs "1.1.2" etc numéricamente por partes -- una comparación
// de texto simple fallaría (ej. "1.10" < "1.2" como texto, pero 1.10 es
// la versión más nueva).
function compareVersions(a, b) {
  if (!a || !b) return 0;
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

module.exports = { getLiveStoreVersions, compareVersions, IOS_BUNDLE_ID, ANDROID_PACKAGE };
