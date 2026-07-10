import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";

interface ReferralRow {
  worker_id: string;
  full_name: string;
  phone: string;
  referral_code: string;
  total_referred: number;
  registered_count: number;
  not_registered_count: number;
  paid_count: number;
  pending_count: number;
}

export default function AdminReferrals() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ rows: ReferralRow[] }>("/admin/referrals/overview");
      setRows(data.rows);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Referral Dashboard" onBack={() => router.back()} />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.worker_id}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
          ListEmptyComponent={<AppText color={COLORS.muted} style={{ textAlign: "center", marginTop: SPACING.xl }}>No referrals yet</AppText>}
          renderItem={({ item }) => (
            <View style={[styles.card, shadow]}>
              <View style={styles.rowTop}>
                <AppText weight="bold" size="lg">{item.full_name}</AppText>
                <View style={styles.codePill}>
                  <AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{item.referral_code}</AppText>
                </View>
              </View>
              <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.md }}>{item.phone}</AppText>

              <View style={styles.statsRow}>
                <Stat label="Referred" value={item.total_referred} color={COLORS.onSurface} />
                <Stat label="Registered" value={item.registered_count} color={COLORS.success} />
                <Stat label="Not Registered" value={item.not_registered_count} color={COLORS.error} />
              </View>
              <View style={styles.statsRow}>
                <Stat label="Paid" value={item.paid_count} color={COLORS.success} />
                <Stat label="Pending Payout" value={item.pending_count} color={COLORS.warning} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <AppText weight="bold" size="lg" color={color}>{value}</AppText>
      <AppText size="sm" color={COLORS.muted} style={{ textAlign: "center" }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  codePill: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  statsRow: { flexDirection: "row", marginTop: SPACING.sm },
});
