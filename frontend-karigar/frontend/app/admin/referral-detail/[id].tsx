import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

interface ReferredPerson {
  worker_id: string | null;
  emp_id?: string | null;
  name: string;
  phone: string;
  status: string;
  verification_status?: string | null;
  verified: boolean;
  payout_amount_rs: number;
  created_at: string;
}

interface DetailResponse {
  referrer_name: string;
  referrer_phone: string;
  referral_code: string;
  people: ReferredPerson[];
  registered_count: number;
  account_created_count: number;
  not_registered_count: number;
  total_earned_rs: number;
  paid_rs: number;
  pending_rs: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  account_created:  { label: "Logged In Only", color: COLORS.warning },
  pending:          { label: "Registered",     color: COLORS.success },
  reward_triggered: { label: "Reward Due",     color: COLORS.success },
  paid:             { label: "Paid",           color: COLORS.success },
};

const COLS = [
  { key: "sino",     label: "S.No",     width: 50 },
  { key: "emp_id",   label: "EMP_ID",   width: 80 },
  { key: "name",     label: "Name",     width: 160 },
  { key: "phone",    label: "Phone",    width: 120 },
  { key: "status",   label: "Status",   width: 130 },
  { key: "verified", label: "Verified", width: 100 },
  { key: "paid",     label: "Paid (₹)", width: 100 },
  { key: "date",     label: "Date",     width: 110 },
];
const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

export default function AdminReferralDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paidInput, setPaidInput] = useState("");
  const [saving, setSaving] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/referrals"));

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<DetailResponse>(`/admin/referrals/${id}/detail`);
      setData(res);
      setPaidInput(String(res.paid_rs));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Live pending calculation as admin types ────────────────────────────
  const totalEarned = data?.total_earned_rs ?? 0;
  const parsedInput = parseInt(paidInput, 10);
  const livePaid = isNaN(parsedInput) || parsedInput < 0 ? 0 : Math.min(parsedInput, totalEarned);
  const livePending = Math.max(totalEarned - livePaid, 0);

  const handleSave = async () => {
    const n = parseInt(paidInput, 10);
    if (isNaN(n) || n < 0) { show("Enter a valid amount (0 to reset)", "error"); return; }
    setSaving(true);
    try {
      const res = await apiFetch<{ total_earned_rs: number; paid_rs: number; pending_rs: number }>(
        `/admin/referrals/${id}/paid-amount`, { method: "PATCH", body: { amount_rs: n } }
      );
      setData((d) => d ? {
        ...d,
        total_earned_rs: res.total_earned_rs,
        paid_rs: res.paid_rs,
        pending_rs: res.pending_rs,
      } : d);
      setPaidInput(String(res.paid_rs));
      show(`Saved ✓  Paid: ₹${res.paid_rs}  Pending: ₹${res.pending_rs}`, "success");
    } catch (e: any) {
      show(e.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Referred Users" onBack={goBack} />

      {loading || !data ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <AppText weight="bold" size="lg">{data.referrer_name}</AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2, marginBottom: SPACING.lg }}>
            {data.referrer_phone} · {data.referral_code} · {data.people.length} referred
          </AppText>

          {/* ── KPI tiles ─────────────────────────────────────────────── */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <AppText weight="bold" size="lg" color={COLORS.warning}>{data.account_created_count}</AppText>
              <AppText size="xs" color={COLORS.muted}>Logged In Only</AppText>
            </View>
            <View style={styles.kpiBox}>
              <AppText weight="bold" size="lg" color={COLORS.error}>{data.not_registered_count}</AppText>
              <AppText size="xs" color={COLORS.muted}>Not Registered</AppText>
            </View>
          </View>

          {/* ── Payment card ─────────────────────────────────────────── */}
          <View style={styles.paymentCard}>

            {/* Top row: Total Earned | Live Pending */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <AppText size="xs" color={COLORS.muted}>Total Earned</AppText>
                <AppText weight="bold" size="lg">₹{data.total_earned_rs}</AppText>
              </View>
              <View style={[styles.summaryBox, { alignItems: "flex-end" }]}>
                <AppText size="xs" color={COLORS.muted}>Pending</AppText>
                {/* Updates LIVE as you type */}
                <AppText weight="bold" size="lg" color={livePending > 0 ? COLORS.warning : COLORS.success}>
                  ₹{livePending}
                </AppText>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Input row */}
            <AppText size="sm" weight="semibold" style={{ marginBottom: 4 }}>
              Amount Paid So Far (₹)
            </AppText>
            <AppText size="xs" color={COLORS.muted} style={{ marginBottom: 8 }}>
              Enter 0 to reset. Pending updates as you type.
            </AppText>

            <View style={styles.inputRow}>
              <TextInput
                value={paidInput}
                onChangeText={setPaidInput}
                keyboardType="numeric"
                editable={!saving}
                placeholder="0"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />
              {saving ? (
                <ActivityIndicator color={COLORS.brandPrimary} style={{ paddingHorizontal: 18 }} />
              ) : (
                <Pressable onPress={handleSave} style={styles.saveBtn}>
                  <AppText size="sm" weight="bold" color="#fff">Save</AppText>
                </Pressable>
              )}
            </View>

            {/* Saved values for reference */}
            <AppText size="xs" color={COLORS.muted} style={{ marginTop: 6 }}>
              Last saved: ₹{data.paid_rs} paid · ₹{data.pending_rs} pending
            </AppText>
          </View>

          {/* ── Referred people table ──────────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: TABLE_WIDTH, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>
              <View style={styles.headerRow}>
                {COLS.map((c) => (
                  <View key={c.key} style={{ flex: 1, minWidth: c.width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                    <AppText size="sm" weight="bold" color="#fff">{c.label}</AppText>
                  </View>
                ))}
              </View>

              {data.people.map((p, i) => {
                const statusInfo = STATUS_LABELS[p.status] || { label: p.status, color: COLORS.muted };
                const canReview = !!p.worker_id;
                const row = (
                  <View style={[styles.dataRow, { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary }]}>
                    <Cell width={COLS[0].width}><AppText size="sm">{i + 1}</AppText></Cell>
                    <Cell width={COLS[1].width}><AppText size="sm">{p.emp_id || "—"}</AppText></Cell>
                    <Cell width={COLS[2].width}><AppText size="sm" weight="semibold">{p.name}</AppText></Cell>
                    <Cell width={COLS[3].width}><AppText size="sm" color={COLORS.muted}>{p.phone}</AppText></Cell>
                    <Cell width={COLS[4].width}><AppText size="sm" weight="semibold" color={statusInfo.color}>{statusInfo.label}</AppText></Cell>
                    <Cell width={COLS[5].width}>
                      {canReview ? (
                        <AppText size="sm" weight="semibold" color={p.verified ? COLORS.success : COLORS.warning}>
                          {p.verified ? "Verified" : "Not Verified"}
                        </AppText>
                      ) : (
                        <AppText size="sm" color={COLORS.muted}>—</AppText>
                      )}
                    </Cell>
                    <Cell width={COLS[6].width}><AppText size="sm" color={COLORS.success}>₹{p.payout_amount_rs}</AppText></Cell>
                    <Cell width={COLS[7].width}>
                      <AppText size="sm" color={COLORS.muted}>
                        {new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </AppText>
                    </Cell>
                  </View>
                );
                return canReview ? (
                  <Pressable key={i} onPress={() => router.push(`/admin/review/${p.worker_id}?from=referral`)}>
                    {row}
                  </Pressable>
                ) : (
                  <View key={i}>{row}</View>
                );
              })}

              {data.people.length === 0 && (
                <View style={{ padding: SPACING.xl, alignItems: "center" }}>
                  <AppText color={COLORS.muted}>No referrals yet from this person</AppText>
                </View>
              )}
            </View>
          </ScrollView>
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

  kpiRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  kpiBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },

  paymentCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  summaryBox: { flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginBottom: SPACING.md },

  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surface,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
  },

  headerRow: { flexDirection: "row", backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider },
});
