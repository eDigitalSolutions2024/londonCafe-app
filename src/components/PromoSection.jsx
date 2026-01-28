import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { posFetch } from "../api/client";

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function computeBadge(promo) {
  // “HOY” si startsAt es hoy, si no “NUEVO” si fue creada hace <= 7 días, si no “PROMO”
  const now = new Date();

  if (promo?.startsAt) {
    const s = new Date(promo.startsAt);
    const sameDay =
      s.getFullYear() === now.getFullYear() &&
      s.getMonth() === now.getMonth() &&
      s.getDate() === now.getDate();
    if (sameDay) return "HOY";
  }

  if (promo?.createdAt) {
    const c = new Date(promo.createdAt);
    const diffDays = (now.getTime() - c.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) return "NUEVO";
  }

  return "PROMO";
}

export default function PromosSection({
  onViewAll,
  limit = 3,
  onPressPromo,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promos, setPromos] = useState([]);

  const fetchPromos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await posFetch("/promos"); // 👈 del POS
      setPromos(Array.isArray(data) ? data : []);
    } catch (e) {
      setPromos([]);
      setError("No se pudieron cargar promociones.");
      console.log("❌ promos:", e?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const preview = useMemo(() => promos.slice(0, limit), [promos, limit]);

  return (
    <View style={styles.promosSection}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Promociones</Text>
          <Text style={styles.sectionHint}>Novedades de LondonCafe</Text>
        </View>

        <TouchableOpacity style={styles.seeAllBtn} onPress={onViewAll} activeOpacity={0.9}>
          <Text style={styles.seeAllText}>Ver todas</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Cargando promociones…</Text>
        </View>
      )}

      {!!error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchPromos} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && preview.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Aún no hay promociones activas.</Text>
        </View>
      )}

      {!loading && !error && preview.map((p) => {
        const badge = computeBadge(p);
        const tag = (p?.tag || "").trim();
        const img = p?.imageUrl || "";

        return (
          <TouchableOpacity
            key={String(p._id || p.id)}
            style={styles.promoCardV}
            onPress={() => (onPressPromo ? onPressPromo(p) : onViewAll?.())}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: img || "https://picsum.photos/1200/600?blur=2",
              }}
              style={styles.promoImageV}
            />

            <View style={styles.promoOverlayV}>
              <View style={styles.promoMetaRow}>
                <Text style={styles.promoBadge}>{badge}</Text>
                <Text style={styles.promoTag}>
                  {tag ? tag : (p?.createdAt ? formatWhen(p.createdAt) : "")}
                </Text>
              </View>

              <Text style={styles.promoTitle} numberOfLines={1}>
                {p?.title || "Promoción"}
              </Text>
              <Text style={styles.promoSubtitle} numberOfLines={3}>
                {p?.description || ""}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  promosSection: { paddingHorizontal: 20, paddingBottom: 24 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },

  sectionHint: { marginTop: 2, fontSize: 12, color: colors.textMuted },

  seeAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },
  seeAllText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  loadingText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },

  errorBox: {
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: colors.text, fontWeight: "800", fontSize: 12, marginBottom: 8 },
  retryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  retryText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },

  emptyBox: {
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  emptyText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  promoCardV: {
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  promoImageV: { width: "100%", height: "100%" },

  promoOverlayV: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,                 // ✅ NUEVO (controla cuánto tapa)
    paddingHorizontal: 14,
    paddingVertical: 10,        // ✅ un poco menos
    backgroundColor: "rgba(0,0,0,0.38)", // ✅ menos opaco
  },


  promoMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  promoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    color: "#111",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  promoTag: { color: "#fff", fontWeight: "900", fontSize: 12 },

  promoTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 2,
  },

  promoSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 12 },
});
