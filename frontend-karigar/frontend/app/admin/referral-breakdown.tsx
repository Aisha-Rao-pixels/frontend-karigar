import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

// Categories that map 1:1 to a KPI card on the Referral Dashboard. "not_registered"
// is intentionally excluded — those are link clicks that never created an
// account, and we don't store any name/phone for a click, so there is no
// per-person table to show for it (handled with an explainer instead).
type Category = "referred" | "registered" | "logged_in" | "paid" | "pending" | "not_registered";

interface Row {
  referral_id: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_worker_id: string | null;
  referrer_has_payout_number: boolean;
  name: string;
  phone: string;
  worker_id: string | null;
  status: string;
  payout_amount_rs: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  account_created:  { label: "Logged In Only", color: COLORS.warning },
  pending:          { label: "Registered",     color: COLORS.success },
  reward_triggered: { label: "Reward Due",     color: COLORS.warning },
  paid:             { label: "Paid",           color: COLORS.success },
};

const COLS = [
  { key: "sino",     label: "S.No",      width: 50 },
  { key: "referrer", label: "Referrer",  width: 160 },
  { key: "name",     label: "Name",      width: 160 },
  { key: "phone",    label: "Phone",     width: 120 },
  { key: "status",   label: "Status",    width: 120 },
  { key: "amount",   label: "Amount (₹)", width: 100 },
  { key: "date",     label: "Date",      width: 110 },
];
const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

export default function ReferralBreakdown() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { category, label } = useLocalSearchParams<{ category: Category; label?: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!category || category === "not_registered") { setLoading(false); return; }
    try {
      const res = await apiFetch<{ rows: Row[] }>(`/admin/referrals/list?category=${category}`);
      setRows(res.rows);
    } catch (e: any) {
      show(e.message || "Could not load this list", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markPaid = async (row: Row) => {
    setPayingId(row.referral_id);
    try {
      await apiFetch(`/admin/referrals/${row.referral_id}/mark-paid`, { method: "POST" });
      show("Marked as paid", "success");
      setRows((prev) => prev.filter((r) => r.referral_id !== row.referral_id));
    } catch (e: any) {
      show(e.message || "Could not mark as paid", "error");
    } finally {
      setPayingId(null);
    }
  };

  const title = label || "Referral Details";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/referrals"))} />

      {category === "pending" && (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
          <AppText size="sm" style={{ color: COLORS.muted, flex: 1, marginLeft: SPACING.sm }}>
            These rewards have been earned but not yet paid. Send the ₹50 to the referrer yourself, then tap "Mark as Paid" — this app has no live payment gateway, so nothing is sent automatically.
          </AppText>
        </View>
      )}

      {loading ? (
        <Loader />
      ) : category === "not_registered" ? (
        <View style={styles.explainerWrap}>
          <Ionicons name="link-outline" size={40} color={COLORS.muted} />
          <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface, marginTop: SPACING.md, textAlign: "center" }}>
            No individual details to show
          </AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: SPACING.xs, textAlign: "center", paddingHorizontal: SPACING.lg }}>
            "Not Registered" counts people who tapped a referral link but never created an account. We only record that the link was clicked — not who clicked it — so there's no name or phone number to list here.
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <View style={{ width: "100%", minWidth: TABLE_WIDTH, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>
            <View style={styles.headerRow}>
              {COLS.map((c) => (
                <View key={c.key} style={{ flex: 1, minWidth: c.width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                  <AppText size="sm" weight="bold" color="#fff">{c.label}</AppText>
                </View>
              ))}
              {category === "pending" && (
                <View style={{ minWidth: 130, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                  <AppText size="sm" weight="bold" color="#fff"> </AppText>
                </View>
              )}
            </View>

            {rows.map((r, i) => {
              const statusInfo = STATUS_LABELS[r.status] || { label: r.status, color: COLORS.muted };
              return (
                <View key={r.referral_id} style={[styles.dataRow, { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary }]}>
                  <Cell width={COLS[0].width}><AppText size="sm">{i + 1}</AppText></Cell>
                  <Cell width={COLS[1].width}>
                    <AppText size="sm" weight="semibold">{r.referrer_name}</AppText>
                    <AppText size="sm" color={COLORS.muted}>{r.referrer_phone}</AppText>
                  </Cell>
                  <Cell width={COLS[2].width}><AppText size="sm">{r.name}</AppText></Cell>
                  <Cell width={COLS[3].width}><AppText size="sm" color={COLORS.muted}>{r.phone}</AppText></Cell>
                  <Cell width={COLS[4].width}><AppText size="sm" weight="semibold" color={statusInfo.color}>{statusInfo.label}</AppText></Cell>
                  <Cell width={COLS[5].width}><AppText size="sm" color={COLORS.success}>₹{r.payout_amount_rs}</AppText></Cell>
                  <Cell width={COLS[6].width}>
                    <AppText size="sm" color={COLORS.muted}>
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </AppText>
                  </Cell>
                  {category === "pending" && (
                    <View style={{ minWidth: 130, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, justifyContent: "center" }}>
                      {!r.referrer_has_payout_number ? (
                        <AppText size="sm" color={COLORS.muted}>No payout number</AppText>
                      ) : payingId === r.referral_id ? (
                        <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                      ) : (
                        <Pressable style={styles.payBtn} onPress={() => markPaid(r)} testID={`mark-paid-${r.referral_id}`}>
                          <AppText size="sm" weight="semibold" style={{ color: "#fff" }}>Mark as Paid</AppText>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {rows.length === 0 && (
              <View style={{ padding: SPACING.xl, alignItems: "center" }}>
                <AppText color={COLORS.muted}>Nothing here yet</AppText>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider, alignItems: "center" },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.lg,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  explainerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  payBtn: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    alignItems: "center",
  },
});
