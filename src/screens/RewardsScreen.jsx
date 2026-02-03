import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import { apiFetch, posFetch } from "../api/client"; // ✅ apiFetch:3001 | posFetch:4000
import AvatarPreview from "../components/AvatarPreview";
import LondonBuddyLogo from "../assets/icons/LondonBuddy.png";

export default function RewardsScreen({ navigation }) {
  const { token, user } = useContext(AuthContext);

  const VIP_THRESHOLD = 200;

  const [loading, setLoading] = useState(false);

  // puntos
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);

  // usuario/avatar
  const [me, setMe] = useState(null);
  const [avatarConfig, setAvatarConfig] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);

      // ✅ puntos desde APP backend (3001)
      const p = await apiFetch("/points/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPoints(Number(p?.points) || 0);
      setLifetimePoints(Number(p?.lifetimePoints) || 0);

      // ✅ perfil desde APP backend (3001)
      const r = await apiFetch("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const u = r?.user ?? user ?? null;
      setMe(u);
      setAvatarConfig(u?.avatarConfig ?? null);
    } catch (e) {
      console.log("❌ Rewards fetchAll:", e?.status, e?.data || e?.message);
      const u = user ?? null;
      setMe(u);
      setAvatarConfig(u?.avatarConfig ?? null);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ✅ cuando vuelvas a esta pantalla (ej: después del QR), refresca puntos
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      fetchAll();
    });
    return unsub;
  }, [navigation, fetchAll]);

  // ✅ DEBUG: comprobar si POS trae rewards.routes (4000)
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/rewards/ping");
        console.log("✅ rewards ping:", r);
      } catch (e) {
        console.log("❌ rewards ping status:", e?.status);
        console.log("❌ rewards ping data:", e?.data);
        console.log("❌ rewards ping msg:", e?.message);
      }
    })();
  }, []);

  const displayName = useMemo(() => {
    const n = (me?.name || user?.name || "London Buddy").trim();
    const un = (me?.username || user?.username || "").trim();
    return un ? `${n} (@${un})` : n;
  }, [me, user]);

  const rawPoints = Number(points) || 0;
  const clamped = Math.max(0, Math.min(VIP_THRESHOLD, rawPoints));
  const progressPct = VIP_THRESHOLD > 0 ? (clamped / VIP_THRESHOLD) * 100 : 0;
  const remaining = Math.max(0, VIP_THRESHOLD - rawPoints);
  const isVIP = rawPoints >= VIP_THRESHOLD;

  const displayPoints = useMemo(() => {
    try {
      return rawPoints.toLocaleString();
    } catch {
      return String(rawPoints);
    }
  }, [rawPoints]);

  const displayLifetime = useMemo(() => {
    try {
      return (Number(lifetimePoints) || 0).toLocaleString();
    } catch {
      return String(Number(lifetimePoints) || 0);
    }
  }, [lifetimePoints]);

  // ✅ generar QR (en POS backend:4000)
  const handleRedeem = useCallback(
    async (rewardType) => {
      if (!token) return;

      if (rawPoints < VIP_THRESHOLD) {
        Alert.alert("Puntos insuficientes", "Necesitas 200 puntos para generar este canje.");
        return;
      }

      try {
        setLoading(true);

        const r = await apiFetch("/rewards/redeem", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rewardType }),
        });

        if (!r?.ok || !r?.token) {
          Alert.alert("No se pudo generar el QR", r?.message || "Intenta de nuevo.");
          return;
        }

        navigation.navigate("RedeemQR", {
          token: r.token,
          rewardType,
          expiresAt: r.expiresAt,
        });
      } catch (e) {
        console.log("❌ redeem status:", e?.status);
        console.log("❌ redeem data:", e?.data);
        console.log("❌ redeem msg:", e?.message);

        Alert.alert(
          "Error",
          e?.data?.message || e?.data?.error || e?.message || "No se pudo generar el QR."
        );
      } finally {
        setLoading(false);
      }
    },
    [token, rawPoints, navigation]
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} />}
      >
        {/* Header top */}
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Recompensas</Text>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
        </View>

        {/* Card 1: Puntos */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            {/* Avatar + nombre */}
            <View style={styles.userRow}>
              <View style={styles.avatarWrap}>
                {avatarConfig ? (
                  <AvatarPreview config={avatarConfig} size={42} />
                ) : (
                  <Image source={LondonBuddyLogo} style={styles.avatarFallback} resizeMode="contain" />
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.cardLabel}>Tus Buddy Coins</Text>
              </View>
            </View>

            {/* points/200 */}
            <View style={styles.diagonalBox}>
              <Text style={styles.diagonalText}>{displayPoints}</Text>
              <Text style={styles.diagonalSlash}>/</Text>
              <Text style={styles.diagonalMax}>{VIP_THRESHOLD}</Text>
            </View>
          </View>

          {/* Barra */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <Text style={styles.helper}>
            {isVIP ? "Eres miembro VIP ⚡" : `Te faltan ${remaining} puntos para subir a VIP`}
          </Text>

          <Text style={styles.lifetimeText}>Acumulados: {displayLifetime}</Text>
        </View>

        {/* Card 2: Nivel */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Nivel actual</Text>

          <View style={styles.levelRow}>
            <View style={[styles.levelPill, isVIP ? styles.levelVip : styles.levelBase]}>
              <Text style={[styles.levelPillText, isVIP ? styles.levelVipText : styles.levelBaseText]}>
                {isVIP ? "VIP" : "BASE"}
              </Text>
            </View>

            <Text style={styles.levelDesc}>
              {isVIP
                ? "Disfruta recompensas exclusivas y beneficios especiales este mes."
                : "Acumula 200 puntos en un mes para desbloquear el nivel VIP."}
            </Text>
          </View>
        </View>

        {/* Card 3: Beneficios */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Beneficios</Text>

          <Text style={styles.bullet}>• Canje de productos gratis</Text>
          <Text style={styles.bullet}>• Accesorios para avatar</Text>

          {isVIP ? (
            <>
              <Text style={styles.bullet}>• Mascota especial 🐾</Text>
              <Text style={styles.bullet}>• Accesorios premium (raros)</Text>
              <Text style={styles.bullet}>• 1 recompensa VIP mensual</Text>
              <Text style={styles.bullet}>• Acceso anticipado a promociones</Text>
            </>
          ) : (
            <Text style={styles.locked}>🔒 Desbloquea beneficios VIP al llegar a 200 puntos</Text>
          )}
        </View>

        {/* Card 4: Canjear */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Canjear</Text>

          <View style={styles.redeemRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.redeemBtn, rawPoints < VIP_THRESHOLD && styles.redeemBtnDisabled]}
              onPress={() => handleRedeem("coffee_free")}
              disabled={rawPoints < VIP_THRESHOLD || loading}
            >
              <Text style={styles.redeemBtnTitle}>Café gratis</Text>
              <Text style={styles.redeemBtnSub}>200 puntos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.redeemBtn, rawPoints < VIP_THRESHOLD && styles.redeemBtnDisabled]}
              onPress={() => handleRedeem("bread_free")}
              disabled={rawPoints < VIP_THRESHOLD || loading}
            >
              <Text style={styles.redeemBtnTitle}>Pan gratis</Text>
              <Text style={styles.redeemBtnSub}>200 puntos</Text>
            </TouchableOpacity>
          </View>

          {rawPoints < VIP_THRESHOLD ? (
            <Text style={styles.locked}>🔒 Te faltan {VIP_THRESHOLD - rawPoints} puntos para poder generar un QR</Text>
          ) : (
            <Text style={styles.helper}>Genera el QR y muéstralo en caja para canjear.</Text>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  pageTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },

  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },

  backText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallback: { width: 26, height: 26 },

  userName: { color: colors.text, fontWeight: "900", fontSize: 16 },

  diagonalBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },

  diagonalText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  diagonalSlash: { color: colors.textMuted, fontSize: 16, fontWeight: "900", marginBottom: 1 },
  diagonalMax: { color: colors.textMuted, fontSize: 15, fontWeight: "800", marginBottom: 1 },

  progressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
    marginBottom: 10,
  },

  progressFill: { height: "100%", backgroundColor: colors.primary },

  helper: { color: colors.textMuted, fontSize: 13, fontWeight: "700", lineHeight: 18 },

  lifetimeText: { marginTop: 8, fontSize: 13, color: colors.textMuted, fontWeight: "700" },

  levelRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },

  levelPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },

  levelBase: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  levelVip: { backgroundColor: "#FDE68A", borderColor: "#FDE68A" },

  levelPillText: { fontSize: 13, fontWeight: "900" },
  levelBaseText: { color: colors.primary },
  levelVipText: { color: "#111" },

  levelDesc: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: "700", lineHeight: 20 },

  bullet: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 8 },

  locked: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: "700",
  },

  redeemRow: { flexDirection: "row", gap: 12 },

  redeemBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  redeemBtnDisabled: { opacity: 0.45 },

  redeemBtnTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  redeemBtnSub: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontWeight: "800" },
});
