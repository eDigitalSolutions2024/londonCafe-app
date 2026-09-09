import React, { useEffect, useContext, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  RefreshControl,
  Alert,
  Animated,
  Easing,
  Image,
} from "react-native";
import {
  registerForPushNotificationsAsync,
  //sendLocalNotification,
//  scheduleDailyStreakReminder,
} from "../utils/notifications";


import { useFocusEffect } from "@react-navigation/native";

import { colors } from "../theme/colors";
import Screen from "../components/Screen";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import LondonBuddyLogo from "../assets/icons/LondonBuddy.png";
import EmojiBurst from "../components/EmojiBurst";
// Avatar + puntos
import AvatarWidget from "../components/AvatarWidget";
import PointsStepperBar from "../components/PointsStepperBar";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Rect, Circle } from "react-native-svg";

import BoothMask from "../assets/markers/London.png";
import LondonCafeLogo from "../assets/markers/londoncafe1.jpg";
// Promociones desde POS
import PromosSection from "../components/PromoSection";

// ✅ Modal avatar grande
import AvatarPreview from "../components/AvatarPreview";

// ✅ mood por energía (front fallback)
function moodLabelFromEnergy(energy = 0) {
  const e = Number(energy) || 0;
  if (e >= 70) return "Feliz";
  if (e >= 30) return "Más o menos";
  if (e >= 1) return "Triste";
  return "Muerto 💀";
}

function moodEmojiFromEnergy(energy = 0) {
  const e = Number(energy) || 0;
  if (e >= 70) return "😄";     // feliz
  if (e >= 30) return "🙂";     // más o menos
  if (e >= 1)  return "😢";     // triste
  return "💀";                  // muerto
}

// Brillo animado detrás del logo en la pantalla de bienvenida (invitado) --
// tamaño fijo a propósito (no absoluteFill sobre un padre de alto
// intrínseco), para evitar el bug de recorte que ya salió una vez con SVG +
// alto dinámico en esta misma pantalla.
function GuestGlow() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[guestGlowStyles.glow, { opacity, transform: [{ scale }] }]}
    >
      <Svg width={220} height={220}>
        <Defs>
          <RadialGradient id="guestGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.55" />
            <Stop offset="55%" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="90%" stopColor={colors.accent} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Radio menor al lienzo (110 en vez de 220/2 hasta el borde) -- deja
            margen real transparente antes del borde del Svg. Sin esto, el
            filo del círculo se magnifica con el scale animado y se ve como
            un cuadro (bug real que reportó el usuario). */}
        <Circle cx="110" cy="110" r="92" fill="url(#guestGlow)" />
      </Svg>
    </Animated.View>
  );
}

const guestGlowStyles = StyleSheet.create({
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
});

// Orbes de luz a la deriva de fondo -- pura decoración (pointerEvents=none),
// tamaño y posición fijos para no repetir el bug de SVG + alto dinámico.
function DriftingOrb({ size, top, left, right, color, duration, delay = 0 }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        left,
        right,
        width: size,
        height: size,
        opacity,
        transform: [{ translateY }, { translateX }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`orb-${color}-${size}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <Stop offset="85%" stopColor={color} stopOpacity="0" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={`url(#orb-${color}-${size})`} />
      </Svg>
    </Animated.View>
  );
}

function GuestBackgroundOrbs() {
  return (
    <>
      <DriftingOrb size={260} top={-60} left={-70} color={colors.primary} duration={5200} />
      <DriftingOrb size={220} top={120} right={-80} color={colors.accent} duration={6400} delay={400} />
      <DriftingOrb size={200} top={420} left={-60} color="#8E2545" duration={5800} delay={800} />
    </>
  );
}

// Logo "vivo": flota y se inclina levemente en 3D (perspective + rotateX/Y),
// looping suave, en vez de quedarse estático -- lo que el usuario pidió como
// "efecto 3D / experiencia digital".
function FloatingLogo3D({ children }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotateY = t.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });
  const rotateX = t.interpolate({ inputRange: [0, 1], outputRange: ["4deg", "-4deg"] });

  return (
    <Animated.View
      style={{
        transform: [
          { perspective: 800 },
          { translateY },
          { rotateY },
          { rotateX },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Botón con retroceso táctil (escala al presionar) -- da sensación de
// profundidad/3D en la interacción, no solo en lo visual estático.
// ✅ El scale va DIRECTO en el TouchableOpacity animado (no en un
// Animated.View que lo envuelve) -- envolver el touchable en un padre con
// su propio transform rompe el hit-testing en iOS (el área tocable se
// reduce al contenido visual, no al tamaño real del botón; en Android no
// se notaba). Reportado por el usuario probando el build de iOS.
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressableScale({ style, onPress, children, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  return (
    <AnimatedTouchable
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
}

// Entrada escalonada (fade + slide-up) para las tarjetas de beneficios --
// se disparan una tras otra al montar la pantalla, en vez de aparecer todas
// de golpe.
function StaggeredIn({ index, children, style }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay: 250 + index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [t, index]);

  const opacity = t;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function BoothStreakBar({
  streakCount = 0,
  claimedToday = false,
  onClaim,
  loading = false,
  totalDays = 28,
}) {

  // ✅ convierte count (racha total) a día dentro del ciclo 28
  const day = Math.max(1, Math.min(totalDays, ((Number(streakCount) || 0) - 1) % totalDays + 1));

  // ✅ si NO ha reclamado hoy, el llenado va “hasta ayer”
  const shown = claimedToday ? day : Math.max(0, day - 1);
  const pct = shown / totalDays; // 0..1

  const BOOTH_H = 112; // debe ser igual a styles.boothBox.height

  // ✅ animación del llenado
 const fillAnim = useRef(new Animated.Value(pct * BOOTH_H)).current;


  useEffect(() => {
  Animated.timing(fillAnim, {
    toValue: pct * BOOTH_H,
    duration: 550,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false,
  }).start();
}, [pct]);


  

  return (
  <View style={styles.duoCard}>
    <View style={styles.streakGrid}>
      {/* ✅ IZQUIERDA: texto + botón + hint */}
      <View style={styles.streakLeft}>
        <Text style={styles.duoTitle}>🔥 Día {day}/{totalDays}</Text>
        <Text style={styles.duoSubtitle}>
          {claimedToday ? "¡Ya reclamaste hoy!" : "¡Reclama tu recompensa!"}
        </Text>

        <TouchableOpacity
          style={[styles.duoBtnCompact, (claimedToday || loading) && styles.duoBtnDisabled]}
          onPress={onClaim}
          disabled={claimedToday || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.duoBtnTextCompact}>
            {claimedToday ? "✅" : loading ? "..." : "Reclamar"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.boothHint}>
          Completa la cabina en 28 días 💥 (Día 28 = Bonus)
        </Text>
      </View>

      {/* ✅ DERECHA: cabina pegada arriba */}
      <View style={styles.streakRight}>
  <View style={styles.boothWrap}>
    <MaskedView
      style={styles.boothBox}
      maskElement={<Image source={BoothMask} style={styles.boothImg} resizeMode="contain" />}
    >
      {/* Base tenue dentro de la torre */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.06)"}]} />

      {/* ✅ Fill desde abajo (pegado al bottom) */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: fillAnim,
            backgroundColor: "rgb(255, 255, 255)",
            minHeight: shown > 0 ? 2 : 0,
          }}
        />
      </View>
    </MaskedView>

    {/* Contorno visible siempre */}
    <Image
      source={BoothMask}
      resizeMode="contain"
      style={[
        styles.boothImg,
        { position: "absolute", top: 0, left: 0, opacity: 0.30 },
      ]}
    />
  </View>
</View>
    </View>
  </View>
);

}





export default function HomeScreen({ navigation }) {
  const { signOut, user, token } = useContext(AuthContext);

  const [showAvatarPeek, setShowAvatarPeek] = useState(false);

  // ✅ puntos reales
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // ✅ perfil/avatar/buddy
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [buddy, setBuddy] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [me, setMe] = useState(null);

  // ✅ streak/recover-streak sigue en el ledger legado (User.points en
  // londoncafe-api), no en Wallet V2 -- se toca en una fase futura. Se lee
  // de /me (ya lo trae) para no mezclarlo con el balance de Wallet V2 que
  // ahora usa PointsStepperBar.
  const legacyPoints = Number(me?.points ?? 0);

  // ✅ Daily Reward / Streak
const [claimingDaily, setClaimingDaily] = useState(false);
const [streak, setStreak] = useState({
  count: 0,
  best: 0,
  claimedToday: false,
  canRecover: false,
  recoveryCost: 25,
});


  const [liveEnergy, setLiveEnergy] = useState(0);

  // ✅ reward animation state
const [rewardVisible, setRewardVisible] = useState(false);
const [rewardDelta, setRewardDelta] = useState(0);
const [rewardMood, setRewardMood] = useState("Feliz");
const [rewardEmoji, setRewardEmoji] = useState("😄");
const [energyFlash, setEnergyFlash] = useState(false); // barra verde temporal


// ✅ Recover streak modal
const [recoverVisible, setRecoverVisible] = useState(false);
const [recovering, setRecovering] = useState(false);

const recoveryCost = Number(streak?.recoveryCost || 25);

const onRecoverStreak = useCallback(async () => {
  if (!token) return;
  if (recovering) return;

  // ✅ check coins local (UX) -- contra el ledger legado, que es el que
  // /me/streak/recover realmente descuenta (User.points, no Wallet V2)
  if (legacyPoints < recoveryCost) {
    Alert.alert("Buddy Coins insuficientes", `Necesitas ${recoveryCost} BuddyCoins para recuperar la racha.`);
    return;
  }

  try {
    setRecovering(true);

    const r = await apiFetch("/me/streak/recover", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r?.ok) {
      Alert.alert("No se pudo recuperar", r?.error || "Intenta de nuevo.");
      return;
    }

    // ✅ actualiza UI con respuesta del backend -- r.points es el ledger
    // legado, se guarda en `me` (no en el `points` de Wallet V2 que usa
    // PointsStepperBar, para no mezclar los dos números)
    if (r?.streak) setStreak(r.streak);
    if (Number.isFinite(Number(r?.points))) {
      setMe((prev) => (prev ? { ...prev, points: Number(r.points) } : prev));
    }
    if (r?.buddy) setBuddy(r.buddy);

    setRecoverVisible(false);

    Alert.alert("🔥 Racha recuperada", `Se descontaron ${recoveryCost} BuddyCoins.`);
  } catch (e) {
    console.log("❌ recover streak:", e?.data || e?.message);
    const msg = e?.data?.error === "INSUFFICIENT_COINS"
      ? `Necesitas ${recoveryCost} BuddyCoins.`
      : (e?.data?.error || e?.message || "No se pudo recuperar.");
    Alert.alert("Error", msg);
  } finally {
    setRecovering(false);
  }
}, [token, recovering, legacyPoints, recoveryCost]);


// Animated values
const rewardScale = useRef(new Animated.Value(0.92)).current;
const rewardOpacity = useRef(new Animated.Value(0)).current;
const deltaY = useRef(new Animated.Value(10)).current;
const deltaOpacity = useRef(new Animated.Value(0)).current;

const emojiScale = useRef(new Animated.Value(0.6)).current;
const emojiY = useRef(new Animated.Value(8)).current;
const emojiOpacity = useRef(new Animated.Value(0)).current;



const ENERGY_LOSS_PER_DAY = 50; // igual que backend
const LOSS_PER_SEC = (ENERGY_LOSS_PER_DAY / 1440) / 60; // 50 pts por día
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * ✅ UI “en vivo”:
 * Calcula desgaste desde buddy.energy y buddy.lastEnergyAt
 * y solo actualiza cuando cambia cada 5%.
 */
useEffect(() => {
  if (!buddy?.lastEnergyAt) return;

  const baseEnergy = Number.isFinite(Number(buddy?.energy)) ? Number(buddy.energy) : 0;
  const baseTime = new Date(buddy.lastEnergyAt).getTime();

  // inicia igual que backend
  setLiveEnergy(Math.round(baseEnergy));

  let lastShown = Math.round(baseEnergy);

  const id = setInterval(() => {
    const elapsedSec = (Date.now() - baseTime) / 1000; // ✅ NO floor
    if (elapsedSec <= 0) return;

    const decayed = clamp(baseEnergy - elapsedSec * LOSS_PER_SEC, 0, 100);

    // ✅ 1% real (sin saltos de 5)
    const shown = Math.round(decayed);

    if (shown !== lastShown) {
      lastShown = shown;
      setLiveEnergy(shown);
    }
  }, 1000);

  return () => clearInterval(id);
}, [buddy?.energy, buddy?.lastEnergyAt]);


/**
 * ✅ Sync real con backend:
 * cada 30s vuelve a traer /me para que no se desfasen.
 */
// ✅ abre el modal cuando backend diga canRecover
useEffect(() => {
  if (streak?.canRecover) setRecoverVisible(true);
  else setRecoverVisible(false);
}, [streak?.canRecover]);


  const fetchPoints = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingPoints(true);

      // ✅ Buddy Coins desde Wallet V2 (mismo proxy y mapeo que
      // RewardsScreen.jsx -- sin wallet todavía es saldo $0, no un error).
      const w = await apiFetch("/points/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPoints(Number(w?.wallet?.balance) || 0);
      setLifetimePoints(Number(w?.wallet?.totalEarned) || 0);
    } catch (e) {
      console.log("❌ points/wallet:", e?.data || e?.message);
    } finally {
      setLoadingPoints(false);
    }
  }, [token]);

  // ✅ Traer /me para obtener avatarConfig y buddy real
  const fetchMe = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingMe(true);

      const r = await apiFetch("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const u = r?.user ?? user ?? null;
      setMe(u);

      setAvatarConfig(u?.avatarConfig ?? null);
      setBuddy(u?.buddy ?? null);
      setStreak(
  r?.streak || {
    count: 0,
    best: 0,
    claimedToday: false,
    canRecover: false,
    recoveryCost: 25,
  }
);

    } catch (e) {
      console.log("❌ /me:", e?.data || e?.message);

      const u = user ?? null;
      setMe(u);
      setAvatarConfig(u?.avatarConfig ?? null);
      setBuddy(u?.buddy ?? null);
      setStreak({
  count: 0,
  best: 0,
  claimedToday: false,
  canRecover: false,
  recoveryCost: 25,
});
    } finally {
      setLoadingMe(false);
    }
  }, [token, user]);

    const refreshingHomeRef = useRef(false);

const lowEnergyNotifiedRef = useRef(false);


  const refreshHome = useCallback(async () => {
    if (!token || refreshingHomeRef.current) return;

    try {
      refreshingHomeRef.current = true;
      await Promise.all([fetchPoints(), fetchMe()]);
    } finally {
      refreshingHomeRef.current = false;
    }
  }, [token, fetchPoints, fetchMe]);


  useEffect(() => {
  if (!token) return;

  (async () => {
    try {
      const expoPushToken = await registerForPushNotificationsAsync();
      if (!expoPushToken) return;

      await apiFetch("/me/push-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expoPushToken }),
      });
    } catch {
      // silent — push registration is best-effort
    }
  })();
}, [token]);


/*useEffect(() => {
  if (!token) return;

  scheduleDailyStreakReminder().catch((e) => {
    console.log("❌ streak-reminder:", e?.message);
  });
}, [token]);
*/

 /*useEffect(() => {
  if (!token) return;

  const id = setInterval(() => {
    refreshHome(); // 👈 importante
  }, 30000);

  return () => clearInterval(id);
}, [token, refreshHome]);*/


/*useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      refreshHome();
    }
  });

  return () => sub.remove();
}, [refreshHome]);*/


const playRewardAnimation = useCallback(({ prevEnergy, nextEnergy }) => {
  const delta = Math.max(0, Math.round(nextEnergy - prevEnergy));
  const nextMood = moodLabelFromEnergy(nextEnergy);
  const nextEmoji = moodEmojiFromEnergy(nextEnergy);

  setRewardDelta(delta);
  setRewardMood(nextMood);
  setRewardEmoji(nextEmoji);

  setRewardVisible(true);
  setEnergyFlash(true);

  // ✅ espera a que el Modal se pinte y luego animas
  requestAnimationFrame(() => {
    // reset anim values
    rewardScale.setValue(0.92);
    rewardOpacity.setValue(0);
    deltaY.setValue(10);
    deltaOpacity.setValue(0);

    emojiScale.setValue(0.6);
    emojiY.setValue(8);
    emojiOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(rewardOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(rewardScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),

      Animated.sequence([
        Animated.timing(deltaOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(deltaY, {
          toValue: -18,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(deltaOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),

      // ✅ emoji
      Animated.sequence([
        Animated.timing(emojiOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.spring(emojiScale, { toValue: 1.25, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.spring(emojiScale, { toValue: 1.0, friction: 6, tension: 80, useNativeDriver: true }),
      ]),
      Animated.timing(emojiY, {
        toValue: -10,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => setRewardVisible(false), 350);
      setTimeout(() => setEnergyFlash(false), 650);
    });
  });
}, [
  rewardScale, rewardOpacity, deltaY, deltaOpacity,
  emojiScale, emojiY, emojiOpacity
]);






  // ✅ alimentar (coffee/bread)
  const handleFeed = useCallback(
    async (type) => {
      if (!token) return;

      // bloqueo simple para no spamear
      if (feeding) return;

      // validación local (si buddy ya existe)
      if (buddy && type === "coffee" && Number(buddy?.coffee || 0) <= 0) {
        Alert.alert("Sin café", "Hoy ya no te queda café. Inicia sesión mañana para recargar.");
        return;
      }
      if (buddy && type === "bread" && Number(buddy?.bread || 0) <= 0) {
        Alert.alert("Sin pan", "Hoy ya no te queda pan. Inicia sesión mañana para recargar.");
        return;
      }
const prevEnergy = Number.isFinite(Number(buddy?.energy)) ? Number(buddy.energy) : energy;

      try {
        setFeeding(true);

        const r = await apiFetch("/buddy/feed", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type }), // "coffee" | "bread"
        });

        if (!r?.ok) {
          Alert.alert("Error", r?.message || r?.error || "No se pudo alimentar.");
          return;
        }

        if (r?.buddy) {

          const nextEnergy = Number.isFinite(Number(r.buddy?.energy))
    ? Number(r.buddy.energy)
    : prevEnergy;

          setBuddy(r.buddy);
          setMe((prev) => (prev ? { ...prev, buddy: r.buddy } : prev));
          // ✅ dispara reward anim (solo si subió energía)
  if (nextEnergy > prevEnergy) {
    playRewardAnimation({ prevEnergy, nextEnergy });
  }
        } else {
          // si el backend no mandó buddy, al menos recargamos /me
          await fetchMe();
        }
      } catch (e) {
        console.log("❌ feed:", e?.status, e?.data || e?.message);
        Alert.alert("Error", e?.data?.error || e?.message || "No se pudo alimentar.");
      } finally {
        setFeeding(false);
      }
    },
    [token, feeding, buddy, fetchMe, energy, playRewardAnimation]

  );

  const onClaimDaily = useCallback(async () => {
  if (!token) return;
  if (claimingDaily) return;

  try {
    setClaimingDaily(true);

    const r = await apiFetch("/me/daily-reward", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const claim = r?.claim;

    if (claim?.ok === false && claim?.reason === "ALREADY_CLAIMED") {
      Alert.alert("Recompensa diaria", "Ya reclamaste tu recompensa de hoy ✅");
    } else if (claim?.ok) {
      Alert.alert(
        "🎁 Recompensa diaria",
        `+${claim.reward?.coins || 0} BuddyCoins\nRacha: ${claim.streak} días 🔥`
      );
    } else {
      Alert.alert("Recompensa diaria", "No se pudo reclamar.");
    }

    // ✅ actualiza estado local
    setStreak(r?.streak || { count: 0, best: 0, claimedToday: true });

    // ✅ si el backend regresó buddy/points, actualiza UI -- r.points es el
    // ledger legado (daily-reward todavía no acredita Wallet V2), se guarda
    // en `me` para no pisar el balance de Wallet V2 que muestra Home
    if (r?.buddy) setBuddy(r.buddy);
    if (Number.isFinite(Number(r?.points))) {
      setMe((prev) => (prev ? { ...prev, points: Number(r.points) } : prev));
    }

  } catch (e) {
    console.log("❌ daily-reward:", e?.data || e?.message);
    Alert.alert("Error", e?.data?.error || e?.message || "No se pudo reclamar.");
  } finally {
    setClaimingDaily(false);
  }
}, [token, claimingDaily]);



  // ✅ cada vez que abres Home, refresca puntos + perfil
   

useFocusEffect(
  useCallback(() => {
    refreshHome();
  }, [refreshHome])
);

  const displayName = useMemo(() => {
    const n = (me?.name || user?.name || "London Buddy").trim();
    const un = (me?.username || user?.username || "").trim();
    return un ? `${n} (@${un})` : n;
  }, [me, user]);

  // ✅ valores “reales” con fallback
 // ✅ valores reales (sin NaN)
const energy =
  Number.isFinite(Number(liveEnergy)) && buddy?.lastEnergyAt
    ? liveEnergy
    : Number.isFinite(Number(buddy?.energy))
    ? Number(buddy.energy)
    : 0;


const coffee = Number.isFinite(Number(buddy?.coffee)) ? Number(buddy.coffee) : 0;
const bread  = Number.isFinite(Number(buddy?.bread)) ? Number(buddy.bread) : 0;

const mood = moodLabelFromEnergy(energy);
const moodEmoji = moodEmojiFromEnergy(energy);


/*useEffect(() => {
  if (!Number.isFinite(Number(energy))) return;

  if (energy < 50 && !lowEnergyNotifiedRef.current) {
    lowEnergyNotifiedRef.current = true;

    sendLocalNotification({
      title: "Tu buddy necesita energía ☕",
      body: "Tu energía bajó de 50%. Entra a darle café o pan.",
      data: { type: "low-energy" },
    });
  }

  if (energy >= 55) {
    lowEnergyNotifiedRef.current = false;
  }
}, [energy]);*/


/*useEffect(() => {
  sendLocalNotification({
    title: "Prueba local ✅",
    body: "Si ves esto, las notificaciones locales sí funcionan.",
    data: { type: "test-local" },
  });
}, []);*/



  if (!token) {
    return (
      <Screen edges={["top"]} withPadding={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Welcome section -- oscuro/glass a propósito, mismo lenguaje que
              BootScreen (App.js), para que la primera impresión de la app se
              sienta como un producto digital premium, no un catálogo plano. */}
          <View style={styles.guestDark}>
            <GuestBackgroundOrbs />

            <View style={styles.guestGlowStage}>
              <GuestGlow />
              <FloatingLogo3D>
                <View style={styles.guestLogoRing}>
                  <Svg width={116} height={116} style={StyleSheet.absoluteFill}>
                    <Defs>
                      <SvgLinearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
                        <Stop offset="100%" stopColor="#fff" stopOpacity="0.35" />
                      </SvgLinearGradient>
                    </Defs>
                    <Circle cx="58" cy="58" r="57" stroke="url(#ring)" strokeWidth="1.5" fill="none" />
                  </Svg>
                  <View style={styles.guestLogoWrap}>
                    <Image source={LondonCafeLogo} style={styles.guestLogo} resizeMode="cover" />
                  </View>
                </View>
              </FloatingLogo3D>
            </View>

            <Text style={styles.guestEyebrow}>BIENVENIDO A</Text>
            <Text style={styles.guestTitle}>London Café</Text>
            <Text style={styles.guestMessage}>
              Inicia sesión para acumular puntos, mantener tu racha diaria y canjear recompensas.
            </Text>

            <View style={styles.guestActions}>
              <PressableScale
                onPress={() => navigation.navigate("AuthModal")}
                accessibilityRole="button"
                style={styles.guestPrimaryBtn}
              >
                <Text style={styles.guestPrimaryBtnText}>Iniciar sesión</Text>
              </PressableScale>

              <PressableScale
                style={styles.guestSecondaryBtn}
                onPress={() => navigation.navigate("AuthModal", { screen: "Register" })}
                accessibilityRole="button"
              >
                <Text style={styles.guestSecondaryBtnText}>Crear cuenta gratuita</Text>
              </PressableScale>

              <TouchableOpacity
                onPress={() => navigation.navigate("Ordena")}
                activeOpacity={0.8}
                style={styles.guestContinueBtn}
                accessibilityRole="button"
              >
                <Text style={styles.guestContinueBtnText}>Continuar como invitado</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.guestBenefitsGrid}>
              {[
                { icon: "☕", text: "Puntos por cada compra" },
                { icon: "🎁", text: "Recompensas exclusivas" },
                { icon: "🔥", text: "Racha diaria" },
                { icon: "📍", text: "Tus sucursales" },
              ].map((b, i) => (
                <StaggeredIn key={i} index={i} style={styles.guestBenefitTile}>
                  <Text style={styles.guestBenefitIcon}>{b.icon}</Text>
                  <Text style={styles.guestBenefitText}>{b.text}</Text>
                </StaggeredIn>
              ))}
            </View>

            {/* Promociones ahora vive DENTRO de la misma tarjeta oscura --
                antes era una tarjeta clara aparte "colgando" del héroe, se
                sentía como una sección olvidada en vez de parte del mismo
                bloque. */}
            <View style={styles.guestPromosHeaderRow}>
              <Text style={styles.guestPromosIcon}>🔥</Text>
              <Text style={styles.guestPromosTitle}>Promociones</Text>
            </View>
            {/* width:100% explícito -- guestDark usa alignItems:"center", así
                que sin esto PromosSection se encoge a su contenido en vez de
                estirarse (antes vivía en un contenedor con stretch por
                default y nunca lo necesitó). */}
            <View style={{ width: "100%" }}>
              <PromosSection limit={5} />
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]} withPadding={false} safeStyle={styles.safeDark}>
            <ScrollView
  style={styles.container}
  showsVerticalScrollIndicator={false}
  contentInsetAdjustmentBehavior="never"
  automaticallyAdjustContentInsets={false}
  automaticallyAdjustKeyboardInsets={false}
  contentContainerStyle={{
    paddingTop: 0,
    paddingBottom: 80, // espacio para que no lo tape la tab bar
  }}
  refreshControl={
    <RefreshControl
      refreshing={loadingPoints || loadingMe}
      onRefresh={refreshHome}
      tintColor={colors.accent}
    />
  }
>
        {/* Hero -- mismo lenguaje oscuro/glow que Boot/Bienvenido/Login (ver
            BootScreen.jsx y la rama !token de este mismo archivo), llevado
            al home autenticado. Los widgets hijos (AvatarWidget,
            BoothStreakBar, PointsStepperBar) no se tocan -- ya son tarjetas
            de fondo sólido (blanco/vino), así que "flotan" bien sobre el
            fondo oscuro sin necesitar ningún cambio interno. */}
        <View style={styles.heroDark}>
          <DriftingOrb size={200} top={-50} right={-60} color={colors.accent} duration={5400} />
          <DriftingOrb size={180} top={90} left={-70} color={colors.primary} duration={6000} delay={500} />

          <View style={styles.heroHeader}>
  <View style={styles.topBar}>
    <View style={styles.brandLeft}>
      <View style={styles.logoRingSmall}>
        <Svg width={54} height={54} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="homeRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
              <Stop offset="100%" stopColor="#fff" stopOpacity="0.35" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="27" cy="27" r="26" stroke="url(#homeRing)" strokeWidth="1.5" fill="none" />
        </Svg>
        <Image source={LondonCafeLogo} style={styles.logoBubble} resizeMode="cover" />
      </View>

      <View style={styles.welcomeBlock}>
  <Text style={styles.welcomeLabel}>BIENVENIDO</Text>
  <Text style={styles.welcomeNameLine} numberOfLines={1}>
    {displayName}
  </Text>
</View>
    </View>

    <TouchableOpacity onPress={signOut} activeOpacity={0.85} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Salir</Text>
    </TouchableOpacity>
  </View>
</View>

          {/* Avatar + Puntos */}
          <View style={styles.avatarSection}>
            {avatarConfig ? (
              <AvatarWidget
                name={displayName}
                mood={mood}
                moodEmoji={moodEmoji}
                energy={energy}
                coffee={coffee}
                bread={bread}
                feeding={feeding}
                avatarConfig={avatarConfig}
                onFeedCoffee={() => handleFeed("coffee")}
                onFeedBread={() => handleFeed("bread")}
                onAvatarPress={() => navigation.navigate("AccountSettings")}
                onAvatarLongPress={() => setShowAvatarPeek(true)}
                onAvatarPressOut={() => setShowAvatarPeek(false)}
                energyFlash={energyFlash}
              />
            ) : loadingMe ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.primarySoft,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "800" }}>
                  Cargando avatar...
                </Text>
              </View>
            ) : null}



                        {/* ✅ Recompensa diaria (streak) */}
<BoothStreakBar
  streakCount={streak.count}
  claimedToday={streak.claimedToday}
  onClaim={onClaimDaily}
  loading={claimingDaily}
  totalDays={28}
  
/>





            <PointsStepperBar
              points={points}
              progressPoints={Math.min(points, 200)}
              totalAccumulated={lifetimePoints}
              maxPoints={200}
              steps={[50, 100, 150, 200]}
              title="Buddy Coins"
              subtitle="Buddy Coins"
              iconSource={LondonBuddyLogo}
        
              onPress={() => navigation.navigate("Rewards")}
            />

  



            
          </View>
        </View>

        {/* Promociones */}
        <View style={styles.homePromosHeaderRow}>
          <Text style={styles.homePromosIcon}>🔥</Text>
          <Text style={styles.homePromosTitle}>Promociones</Text>
        </View>
        <PromosSection limit={5}  />
      </ScrollView>

      {/* ✅ MODAL PEEK */}
      <Modal visible={showAvatarPeek} transparent animationType="fade">
        <View style={styles.peekBackdrop}>
          <View style={styles.peekCircle}>
            {avatarConfig ? <AvatarPreview config={avatarConfig} size={260} /> : null}
          </View>
        </View>
      </Modal>

      {/* ✅ REWARD MODAL */}
<Modal visible={rewardVisible} transparent animationType="fade">
  <View style={styles.rewardBackdrop}>

  <EmojiBurst visible={rewardVisible} emoji={rewardEmoji} count={18} />


    <Animated.View
      style={[
        styles.rewardCard,
        { opacity: rewardOpacity, transform: [{ scale: rewardScale }] },
      ]}
    >
    



      <View style={styles.rewardCircle}>
        {avatarConfig ? <AvatarPreview config={avatarConfig} size={260} /> : null}
      </View>

      <Animated.Text
        style={[
          styles.rewardDelta,
          { opacity: deltaOpacity, transform: [{ translateY: deltaY }] },
        ]}
      >
        +{rewardDelta}%
      </Animated.Text>

      <View style={styles.moodRow}>
  <Text style={styles.rewardMood}>{rewardMood}</Text>

  
</View>

<Text style={styles.rewardSmall}>¡Tu buddy se siente mejor!</Text>

    </Animated.View>
  </View>
</Modal>

{/* ✅ RECOVER STREAK MODAL */}
<Modal visible={recoverVisible} transparent animationType="fade">
  <View style={styles.recoverBackdrop}>
    <View style={styles.recoverCard}>
      <Text style={styles.recoverTitle}>🔥 ¡Se rompió tu racha!</Text>

      <Text style={styles.recoverText}>
        ¿Quieres recuperarla por{" "}
        <Text style={{ fontWeight: "900" }}>{recoveryCost} BuddyCoins</Text>?
      </Text>

      <View style={styles.recoverRow}>
        <Text style={styles.recoverSmall}>Tienes:</Text>
        <Text style={styles.recoverCoins}>{legacyPoints} 🪙</Text>
      </View>

      <View style={styles.recoverBtns}>
        <TouchableOpacity
          style={[styles.recoverBtn, styles.recoverCancel]}
          onPress={() => setRecoverVisible(false)}
          disabled={recovering}
          activeOpacity={0.85}
        >
          <Text style={styles.recoverCancelText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.recoverBtn,
            styles.recoverConfirm,
            (recovering || legacyPoints < recoveryCost) && { opacity: 0.6 },
          ]}
          onPress={onRecoverStreak}
          disabled={recovering || legacyPoints < recoveryCost}
          activeOpacity={0.85}
        >
          <Text style={styles.recoverConfirmText}>
            {recovering ? "..." : `Recuperar (-${recoveryCost})`}
          </Text>
        </TouchableOpacity>
      </View>

      {legacyPoints < recoveryCost ? (
        <Text style={styles.recoverWarn}>No tienes suficientes BuddyCoins.</Text>
      ) : null}
    </View>
  </View>
</Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  /* Guest welcome section -- oscuro/glass, ver comentario en el JSX */
  guestDark: {
    alignItems: "center",
    // El contenedor de Screen (withPadding=false) igual mete 16px de
    // padding horizontal -- este margen negativo lo cancela para que la
    // tarjeta llegue de verdad a los bordes de la pantalla, no se quede
    // "flotando" con aire a los lados.
    marginHorizontal: -16,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    backgroundColor: "#0b0709",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  guestGlowStage: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  guestLogoRing: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  guestLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  guestLogo: { width: "100%", height: "100%" },
  guestEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: 4,
  },
  guestTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  guestMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 30,
  },
  guestActions: {
    width: "100%",
    alignItems: "center",
  },
  guestPrimaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  guestPrimaryBtnText: { color: "#2A0E18", fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  guestSecondaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  guestSecondaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  guestContinueBtn: { paddingVertical: 12, alignItems: "center", marginBottom: 30 },
  guestContinueBtnText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  guestBenefitsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  guestBenefitTile: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  guestBenefitIcon: { fontSize: 22 },
  guestBenefitText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 16,
  },
  guestPromosHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    marginBottom: 12,
  },
  guestPromosIcon: { fontSize: 18 },
  guestPromosTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.2,
  },

  /* Screen / layout base */
  safeDark: { backgroundColor: "#0b0709" },
  container: { flex: 1, backgroundColor: "#0b0709" },

  hero: { paddingHorizontal: 20, paddingVertical: 0 },
  heroDark: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#0b0709",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  heroHeader: { marginBottom: 2 },

  /* ✅ Top header: logo + welcome + logout */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
    marginBottom: 6,
  },

  brandLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0, // importante para ellipsis
  },

  logoRingSmall: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden", // ✅ para que el borderRadius recorte la imagen
  },

  welcomeBlock: {
    flex: 1,
    minWidth: 0,
  },

  welcomeLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    lineHeight: 14,
  },

  welcomeNameLine: {
    color: "#fff",
    fontSize: 18, // ✅ más grande
    fontWeight: "900",
    lineHeight: 21, // ✅ NO inflar a 28
    marginTop: 2,
  },

  logoutBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  logoutText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "900" },

  homePromosHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  homePromosIcon: { fontSize: 18 },
  homePromosTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.2,
  },

  /* ✅ Streak Card (cabina + botón + texto) */
  duoCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primary,
  },

  streakGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  streakLeft: {
    flex: 1,
    paddingRight: 6,
  },

  streakRight: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },

  duoTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 2,
  },

  duoSubtitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 6,
  },

  duoBtnCompact: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  duoBtnDisabled: { opacity: 0.6 },

  duoBtnTextCompact: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  boothWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
  },

  boothBox: {
    width: 84,
    height: 112,
    overflow: "hidden",
  },
  boothImg: {
    width: 84,
    height: 112,
  },

  boothHint: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
  },

  /* ✅ Modal peek (avatar grande) */
  peekBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  peekCircle: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },

  /* ✅ Reward modal */
  rewardBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardCard: {
    width: "86%",
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  rewardCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 1,
  },
  rewardDelta: {
    position: "absolute",
    top: 26,
    right: 22,
    fontSize: 28,
    fontWeight: "900",
    color: "#22c55e",
  },
  rewardMood: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },
  rewardSmall: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
  },

  /* ✅ Recover streak modal */
recoverBackdrop: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.30)",
  alignItems: "center",
  justifyContent: "center",
},
recoverCard: {
  width: "86%",
  borderRadius: 18,
  backgroundColor: "#fff",
  paddingVertical: 16,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: colors.primarySoft,
},
recoverTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: colors.text,
  marginBottom: 8,
},
recoverText: {
  fontSize: 12,
  color: colors.textMuted,
  lineHeight: 18,
},
recoverRow: {
  marginTop: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.primarySoft,
  backgroundColor: colors.card,
},
recoverSmall: {
  fontSize: 12,
  fontWeight: "800",
  color: colors.textMuted,
},
recoverCoins: {
  fontSize: 14,
  fontWeight: "900",
  color: colors.text,
},
recoverBtns: {
  marginTop: 12,
  flexDirection: "row",
  gap: 10,
},
recoverBtn: {
  flex: 1,
  height: 40,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
},
recoverCancel: {
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: colors.primarySoft,
},
recoverConfirm: {
  backgroundColor: colors.primary,
},
recoverCancelText: {
  fontSize: 12,
  fontWeight: "900",
  color: colors.textMuted,
},
recoverConfirmText: {
  fontSize: 12,
  fontWeight: "900",
  color: "#fff",
},
recoverWarn: {
  marginTop: 10,
  fontSize: 11,
  fontWeight: "800",
  color: "#ef4444",
  textAlign: "center",
},
});

