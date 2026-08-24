import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import { apiFetch } from "../api/client";

const TYPE_LABELS = {
  Earn: "Ganaste",
  Redeem: "Canjeaste",
  Refund: "Reembolso",
  Adjustment: "Ajuste",
  Bonus: "Bono",
  Expired: "Expiraron",
  Migration: "Saldo inicial",
};

const POSITIVE_TYPES = new Set(["Earn", "Refund", "Adjustment", "Bonus", "Migration"]);

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " +
      d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function TransactionRow({ tx }) {
  const isPositive = POSITIVE_TYPES.has(tx.type) ? tx.coins >= 0 : false;
  const sign = tx.coins >= 0 ? "+" : "";
  const label = TYPE_LABELS[tx.type] || tx.type;

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDate}>{formatDate(tx.createdAt)}</Text>
        {tx.note ? <Text style={styles.rowNote} numberOfLines={2}>{tx.note}</Text> : null}
      </View>
      <Text style={[styles.rowCoins, isPositive ? styles.coinsPositive : styles.coinsNegative]}>
        {sign}{tx.coins}
      </Text>
    </View>
  );
}

export default function WalletHistoryScreen({ navigation }) {
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const r = await apiFetch("/points/wallet/transactions?limit=100");
      setTransactions(Array.isArray(r?.transactions) ? r.transactions : []);
    } catch (e) {
      console.log("❌ WalletHistory fetchHistory:", e?.status, e?.data || e?.message);
      setError("No pudimos cargar tu historial. Desliza para reintentar.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <Screen>
      <View style={styles.headerTop}>
        <Text style={styles.pageTitle}>Historial</Text>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={styles.backBtn}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>← Regresar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchHistory} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.card}>
              <Text style={styles.helper}>
                {error || "Todavía no tienes movimientos de Buddy Coins."}
              </Text>
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          )
        }
      />
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
  pageTitle: { color: colors.text, fontSize: 32, fontWeight: "900" },
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  helper: { color: colors.textMuted, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "900" },
  rowDate: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  rowNote: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  rowCoins: { fontSize: 16, fontWeight: "900", marginLeft: 10 },
  coinsPositive: { color: "#2E7D32" },
  coinsNegative: { color: "#B3261E" },
  separator: { height: 10 },
});
