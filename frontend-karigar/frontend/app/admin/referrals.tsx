import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
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
  account_created_count: number;
  not_registered_count: number;
  paid_amount_rs: number;
  pending_amount_rs: number;
}

const COLS = [
  { key: "sino", label: "S.No", width: 50 },
  { key: "name", label: "Name", width: 160 },
  { key: "phone", label: "Phone", width: 110 },
  { key: "code", label: "Referral Code", width: 130 },
  { key: "referred", label: "Referred", width: 90 },
  { key: "registered", label: "Registered", width: 100 },
  { key: "loggedIn", label: "Logged In Only", width: 130 },
  { key: "notRegistered", label: "Not Registered", width: 130 },
  { key: "paid", label: "Paid (₹)", width: 100 },
  { key: "pending", label: "Pending (₹)", width: 110 },
];
const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

export default function AdminReferrals() {
  const router = useRouter();
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

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        referred: acc.referred + r.total_referred,
        registered: acc.registered + r.registered_count,
        loggedIn: acc.loggedIn + r.account_created_count,
        notRegistered: acc.notRegistered + r.not_registered_count,
        paid: acc.paid + r.paid_amount_rs,
        pending: acc.pending + r.pending_amount_rs,
      }),
      { referred: 0, registered: 0, loggedIn: 0, notRegistered: 0, paid: 0, pending: 0 }
    );
  }, [rows]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Referral Dashboard" onBack={() => router.back()} />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          {/* Summary KPI strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, marginBottom: SPACING.lg }}>
            <Kpi label="Total Referrers" value={rows.length} />
            <Kpi label="Total Referred" value={totals.referred} />
            <Kpi label="Registered" value={totals.registered} color={COLORS.success} />
            <Kpi label="Logged In Only" value={totals.loggedIn} color={COLORS.warning} />
            <Kpi label="Not Registered" value={totals.notRegistered} color={COLORS.error} />
            <Kpi label="Total Paid" value={`₹${totals.paid}`} color={COLORS.success} />
            <Kpi label="Total Pending" value={`₹${totals.pending}`} color={COLORS.warning} />
          </ScrollView>

          {/* Data table */}
          <View style={{ width: "100%", minWidth: TABLE_WIDTH, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>
            {/* Header */}
            <View style={styles.headerRow}>
              {COLS.map((c) => (
                <View key={c.key} style={{ flex: 1, minWidth: c.width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                  <AppText size="sm" weight="bold" color="#fff">{c.label}</AppText>
                </View>
              ))}
            </View>
            {/* Rows */}
            {rows.map((r, i) => (
              <View
                key={r.worker_id}
                style={[styles.dataRow, { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary }]}
              >
                <Cell width={COLS[0].width}><AppText size="sm">{i + 1}</AppText></Cell>
                <Pressable onPress={() => router.push(`/admin/worker/${r.worker_id}`)}>
                  <Cell width={COLS[1].width}>
                    <AppText size="sm" weight="semibold">{r.full_name}</AppText>
                  </Cell>
                </Pressable>
                <Cell width={COLS[2].width}><AppText size="sm" color={COLORS.muted}>{r.phone}</AppText></Cell>
                <Cell width={COLS[3].width}><AppText size="sm" weight="semibold" color={COLORS.brandPrimary}>{r.referral_code}</AppText></Cell>
                <Pressable onPress={() => router.push(`/admin/referral-detail/${r.worker_id}`)}>
                  <Cell width={COLS[4].width}>
                    <AppText size="sm">{r.total_referred}</AppText>
                  </Cell>
                </Pressable>
                <Cell width={COLS[5].width}><AppText size="sm" color={COLORS.success} weight="semibold">{r.registered_count}</AppText></Cell>
                <Cell width={COLS[6].width}><AppText size="sm" color={COLORS.warning} weight="semibold">{r.account_created_count}</AppText></Cell>
                <Cell width={COLS[7].width}><AppText size="sm" color={COLORS.error} weight="semibold">{r.not_registered_count}</AppText></Cell>
                <Cell width={COLS[8].width}><AppText size="sm" color={COLORS.success}>₹{r.paid_amount_rs}</AppText></Cell>
                <Cell width={COLS[9].width}><AppText size="sm" color={COLORS.warning}>₹{r.pending_amount_rs}</AppText></Cell>
              </View>
            ))}
            {rows.length === 0 && (
              <View style={{ padding: SPACING.xl, alignItems: "center" }}>
                <AppText color={COLORS.muted}>No referral activity yet</AppText>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}>
      {children}
    </View>
  );
}

function Kpi({ label, value, color = COLORS.onSurface }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={[styles.kpi, shadow]}>
      <AppText weight="bold" size="xl" color={color}>{value}</AppText>
      <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider },
  kpi: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, minWidth: 130, alignItems: "flex-start" },
});
