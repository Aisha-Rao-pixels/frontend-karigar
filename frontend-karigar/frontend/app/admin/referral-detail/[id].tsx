import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader, Card } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";

interface ReferredPerson {
  name: string;
  phone: string;
  status: string;
  payout_amount_rs: number;
  created_at: string;
}

interface DetailResponse {
  referrer_name: string;
  referrer_phone: string;
  referral_code: string;
  people: ReferredPerson[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  account_created:  { label: "Logged In Only", color: COLORS.warning },
  pending:          { label: "Registered",     color: COLORS.success },
  reward_triggered: { label: "Reward Due",     color: COLORS.success },
  paid:             { label: "Paid",           color: COLORS.success },
};

export default function AdminReferralDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<DetailResponse>(`/admin/referrals/${id}/detail`);
      setData(res);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Referred Users" onBack={() => router.back()} />

      {loading || !data ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <Card style={styles.summaryCard}>
            <AppText weight="bold" size="lg">{data.referrer_name}</AppText>
            <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>{data.referrer_phone}</AppText>
            <View style={styles.codeBadge}>
              <AppText weight="bold" size="sm" color={COLORS.brandPrimary}>{data.referral_code}</AppText>
            </View>
          </Card>

          <AppText weight="semibold" size="md" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
            {data.people.length} {data.people.length === 1 ? "Person" : "People"} Referred
          </AppText>

          {data.people.length === 0 && (
            <Card style={{ padding: SPACING.xl, alignItems: "center" }}>
              <AppText color={COLORS.muted}>No referrals yet from this person</AppText>
            </Card>
          )}

          {data.people.map((p, i) => {
            const statusInfo = STATUS_LABELS[p.status] || { label: p.status, color: COLORS.muted };
            return (
              <Card key={i} style={styles.personCard}>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" size="md">{p.name}</AppText>
                  <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>{p.phone}</AppText>
                  <AppText size="xs" color={COLORS.muted} style={{ marginTop: 2 }}>
                    {new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "22" }]}>
                    <AppText size="xs" weight="semibold" color={statusInfo.color}>{statusInfo.label}</AppText>
                  </View>
                  {p.payout_amount_rs > 0 && (
                    <AppText size="sm" weight="semibold" color={COLORS.success} style={{ marginTop: 4 }}>
                      ₹{p.payout_amount_rs}
                    </AppText>
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  summaryCard: { padding: SPACING.lg },
  codeBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  personCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
});
