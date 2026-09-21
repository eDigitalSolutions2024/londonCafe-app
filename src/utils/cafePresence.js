// src/utils/cafePresence.js
//
// Coordenadas ya conocidas (mismas que LocationScreen.jsx) -- se reusan
// acá para "Amigos en el café ahora": el cliente calcula la distancia
// ÉL MISMO y solo manda un booleano al servidor (ver PUT /me/presence),
// nunca coordenadas GPS reales. Radio generoso (150m) para cubrir todo
// el local sin depender de la precisión exacta del GPS del teléfono.
export const CAFE_LAT = 31.70075;
export const CAFE_LNG = -106.38848;
export const PRESENCE_RADIUS_M = 150;

// Fórmula haversine -- distancia en metros entre dos puntos lat/lng.
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isNearCafe(lat, lng) {
  return distanceMeters(lat, lng, CAFE_LAT, CAFE_LNG) <= PRESENCE_RADIUS_M;
}
