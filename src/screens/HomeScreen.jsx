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

import { AppState } from "react-native";
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

import BoothMask from "../assets/markers/London.png";

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

  const BOOTH_H = 160; // debe ser igual a styles.boothBox.height

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


  // ✅ Daily Reward / Streak
const [claimingDaily, setClaimingDaily] = useState(false);
const [streak, setStreak] = useState({ count: 0, best: 0, claimedToday: false });


  const [liveEnergy, setLiveEnergy] = useState(0);

  // ✅ reward animation state
const [rewardVisible, setRewardVisible] = useState(false);
const [rewardDelta, setRewardDelta] = useState(0);
const [rewardMood, setRewardMood] = useState("Feliz");
const [rewardEmoji, setRewardEmoji] = useState("😄");
const [energyFlash, setEnergyFlash] = useState(false); // barra verde temporal

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



  const fetchPoints = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingPoints(true);

      // ✅ GET /api/points/me
      const r = await apiFetch("/points/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPoints(Number(r?.points) || 0);
      setLifetimePoints(Number(r?.lifetimePoints) || 0);
    } catch (e) {
      console.log("❌ points/me:", e?.data || e?.message);
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
      setStreak(r?.streak || { count: 0, best: 0, claimedToday: false });

    } catch (e) {
      console.log("❌ /me:", e?.data || e?.message);

      const u = user ?? null;
      setMe(u);
      setAvatarConfig(u?.avatarConfig ?? null);
      setBuddy(u?.buddy ?? null);
      setStreak({ count: 0, best: 0, claimedToday: false });
    } finally {
      setLoadingMe(false);
    }
  }, [token, user]);

  useEffect(() => {
  if (!token) return;

  const id = setInterval(() => {
    fetchMe();
  }, 30000);

  return () => clearInterval(id);
}, [token, fetchMe]);


useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      fetchMe();      // ✅ sincroniza streak al volver a la app
      fetchPoints();
    }
  });

  return () => sub.remove();
}, [fetchMe, fetchPoints]);


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

    // ✅ si el backend regresó buddy/points, actualiza UI
    if (r?.buddy) setBuddy(r.buddy);
    if (Number.isFinite(Number(r?.points))) setPoints(Number(r.points));

  } catch (e) {
    console.log("❌ daily-reward:", e?.data || e?.message);
    Alert.alert("Error", e?.data?.error || e?.message || "No se pudo reclamar.");
  } finally {
    setClaimingDaily(false);
  }
}, [token, claimingDaily]);


  useEffect(() => {
    apiFetch("/health")
      .then((d) => console.log("✅ HEALTH OK:", d))
      .catch((e) => console.log("❌ HEALTH ERROR:", e?.data || e.message));
  }, []);

  // ✅ cada vez que abres Home, refresca puntos + perfil
  useFocusEffect(
    useCallback(() => {
      fetchPoints();
      fetchMe();
    }, [fetchPoints, fetchMe])
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


  return (
    <Screen>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingPoints || loadingMe}
            onRefresh={async () => {
              await fetchPoints();
              await fetchMe();
            }}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
  <View style={styles.topBar}>
    <View style={styles.brandLeft}>
      {/* ✅ Placeholder del logo (luego lo cambias por <Image source={...} />) */}
      <View style={styles.logoBubble} />

      <Text style={styles.welcomeLine} numberOfLines={1}>
        Bienvenido, <Text style={styles.welcomeName}>{displayName}</Text>
      </Text>
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
            ) : (
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
            )}



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
        <PromosSection limit={5} onViewAll={() => navigation.navigate("Promos")} />
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

    </Screen>
  );
}

const styles = StyleSheet.create({
  /* Screen / layout base */
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingVertical: 0 },
  heroHeader: { marginBottom: 6 },
  heroTextBox: { marginBottom: 6 },

  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    marginTop: 4,
    flex: 1,
  },

  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },
  logoutText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  /* ✅ Streak Card (cabina + botón + texto) */
  duoCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primary,
  },

  streakGrid: {
    flexDirection: "row",
    alignItems: "flex-start", // ✅ cabina arriba
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
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 2, // ✅ texto más pegado
  },

  duoSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 8, // ✅ espacio justo antes del botón
  },

  duoBtnCompact: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  duoBtnDisabled: { opacity: 0.6 },

  duoBtnTextCompact: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.primary,
  },

  boothBox: {
    width: 120,
    height: 160,
    overflow: "hidden",
  },
  boothImg: {
    width: 120,
    height: 160,
  },

  boothHint: {
    marginTop: 8,
    fontSize: 10,
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
  topBar: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 6,
  marginBottom: 8,
},

brandLeft: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  minWidth: 0, // importante para ellipsis
},

logoBubble: {
  width: 30,
  height: 30,
  borderRadius: 10,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.primarySoft,
},

welcomeLine: {
  flex: 1,
  color: colors.textMuted,
  fontSize: 13,
  fontWeight: "800",
},

welcomeName: {
  color: colors.text,
  fontWeight: "900",
},
});

