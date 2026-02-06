import React, { useEffect, useContext, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { colors } from "../theme/colors";
import Screen from "../components/Screen";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import LondonBuddyLogo from "../assets/icons/LondonBuddy.png";

// Avatar + puntos
import AvatarWidget from "../components/AvatarWidget";
import PointsStepperBar from "../components/PointsStepperBar";

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

  const [liveEnergy, setLiveEnergy] = useState(0);

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

  setLiveEnergy(baseEnergy);

  let lastBucket = Math.floor(baseEnergy / 5) * 5;

  const id = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - baseTime) / 1000);
    if (elapsedSec <= 0) return;

    const decayed = clamp(baseEnergy - elapsedSec * LOSS_PER_SEC, 0, 100);

    const bucket = Math.floor(decayed / 5) * 5;
    if (bucket !== lastBucket) {
      lastBucket = bucket;
      setLiveEnergy(bucket);
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
    } catch (e) {
      console.log("❌ /me:", e?.data || e?.message);

      const u = user ?? null;
      setMe(u);
      setAvatarConfig(u?.avatarConfig ?? null);
      setBuddy(u?.buddy ?? null);
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
          setBuddy(r.buddy);
          setMe((prev) => (prev ? { ...prev, buddy: r.buddy } : prev));
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
    [token, feeding, buddy, fetchMe]
  );

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
            <View style={styles.heroTextBox}>
              <Text style={styles.subtitle}>Bienvenido a</Text>

              <View style={styles.titleRow}>
                <Text style={styles.title}>LondonCafe</Text>

                <TouchableOpacity onPress={signOut} activeOpacity={0.85} style={styles.logoutBtn}>
                  <Text style={styles.logoutText}>Salir</Text>
                </TouchableOpacity>
              </View>
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

            <PointsStepperBar
              points={points}
              progressPoints={Math.min(points, 200)}
              totalAccumulated={lifetimePoints}
              maxPoints={200}
              steps={[50, 100, 150, 200]}
              title="Buddy Coins"
              subtitle="Buddy Coins"
              iconSource={LondonBuddyLogo}
              iconSize={30}
              onPress={() => navigation.navigate("Rewards")}
            />

            <Text style={styles.pointsMeta}>Acumulados: {lifetimePoints}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingVertical: 0 },
  heroHeader: { marginBottom: 16 },
  heroTextBox: { marginBottom: 16 },

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

  avatarSection: { marginTop: 14 },

  pointsMeta: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
  },

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
});
