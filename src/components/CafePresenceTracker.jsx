// src/components/CafePresenceTracker.jsx
//
// Sin UI propia -- vive montado en App.js mientras hay sesión iniciada.
// Si el usuario activó "Amigos en el café" (presence.shareEnabled, ver
// AmigosScreen.jsx), revisa la posición SOLO mientras la app está en
// primer plano (nunca ubicación en segundo plano -- ver app.json,
// isAndroidBackgroundLocationEnabled/isIosBackgroundLocationEnabled en
// false) y manda un simple booleano "¿estoy cerca del café?" al server.
// Nunca se guarda ni se manda la coordenada real -- ver cafePresence.js.
import { useContext, useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { AuthContext } from "../context/AuthContext";
import { apiFetch } from "../api/client";
import { isNearCafe } from "../utils/cafePresence";

const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 min mientras la app está abierta

export default function CafePresenceTracker() {
  const { token, user } = useContext(AuthContext);
  const shareEnabled = !!user?.presence?.shareEnabled;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!token || !shareEnabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let alive = true;

    async function pingOnce() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return; // no insiste -- solo se queda sin poder detectar
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!alive) return;
        const atCafe = isNearCafe(pos.coords.latitude, pos.coords.longitude);
        await apiFetch("/me/presence", { method: "PUT", body: JSON.stringify({ atCafe }) });
      } catch (e) {
        // Silencioso a propósito -- GPS apagado, permiso negado, sin señal,
        // etc. no deben interrumpir el uso normal de la app.
        console.log("⚠️ presence ping:", e?.message);
      }
    }

    pingOnce(); // de una vez, no hasta que pase el primer intervalo
    timerRef.current = setInterval(pingOnce, PING_INTERVAL_MS);

    // Al volver del segundo plano, un chequeo inmediato en vez de esperar
    // hasta el siguiente tick del intervalo.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") pingOnce();
    });

    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [token, shareEnabled]);

  return null;
}
