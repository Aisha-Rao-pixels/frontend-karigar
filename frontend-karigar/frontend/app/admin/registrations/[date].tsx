import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader, EmptyState } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { Worker, verificationColor } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

const COLS = [
  { key: "sino",   label: "S.No",   width: 50 },
  { key: "name",   label: "Name",   width: 160 },
  { key: "phone",  label: "Phone",  width: 130 },
  { key: "skill",  label: "Skill",  width: 220 },
  { key: "city",   label: "City",   width: 120 },
  { key: "status", label: "Status", width: 130 },
  { key: "exp",    label: "Exp",    width: 80 },
  { key: "time",   label: "Registered At", width: 150 },
];
const TABLE_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

function prettyDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminRegistrationsByDate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!date) return;
    try {
      const q = new URLSearchParams();
      q.set("registered_date", date);
      q.set("page_size", "200");
      const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      show(e.message || "Could not load registrations", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Registrations"
        subtitle={date ? prettyDate(date) : undefined}
        onBack={() => router.back()}
      />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
        >
          <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.lg }}>
            {total} worker{total !== 1 ? "s" : ""} registered on this day
          </AppText>

          {items.length === 0 ? (
            <EmptyState icon="people-outline" title="No registrations" subtitle="No workers registered on this day" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ width: "100%", minWidth: TABLE_WIDTH, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: "hidden" }}>
                {/* Header */}
                <View style={styles.headerRow}>
                  {COLS.map((c) => (
                    <View key={c.key} style={{ width: c.width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
                      <AppText size="sm" weight="bold" color="#fff">{c.label}</AppText>
                    </View>
                  ))}
                </View>

                {/* Rows */}
                {items.map((w, i) => (
                  <Pressable
                    key={w.id}
                    onPress={() => router.push(`/admin/worker/${w.id}?from=search`)}
                    style={[styles.dataRow, { backgroundColor: i % 2 === 0 ? COLORS.surface : COLORS.surfaceSecondary }]}
                    testID={`registration-row-${w.id}`}
                  >
                    <Cell width={COLS[0].width}><AppText size="sm">{i + 1}</AppText></Cell>
                    <Cell width={COLS[1].width}><AppText size="sm" weight="semibold" numberOfLines={1}>{w.full_name}</AppText></Cell>
                    <Cell width={COLS[2].width}><AppText size="sm" color={COLORS.muted} numberOfLines={1}>{w.phone || "—"}</AppText></Cell>
                    <Cell width={COLS[3].width}>
                      <AppText size="sm" numberOfLines={2}>{(w.skills || []).join(", ") || "—"}</AppText>
                    </Cell>
                    <Cell width={COLS[4].width}><AppText size="sm" numberOfLines={1}>{w.city || "—"}</AppText></Cell>
                    <Cell width={COLS[5].width}>
                      <AppText size="sm" weight="semibold" color={verificationColor(w.verification_status)}>
                        {w.verification_status === "approved" ? "✅ Verified" : w.verification_status === "pending" ? "⏳ Pending" : "❌ Rejected"}
                      </AppText>
                    </Cell>
                    <Cell width={COLS[6].width}><AppText size="sm">{w.years_experience || 0} yrs</AppText></Cell>
                    <Cell width={COLS[7].width}>
                      <AppText size="sm" color={COLORS.muted}>
                        {new Date(w.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </AppText>
                    </Cell>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View style={{ width, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.divider }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.surfaceInverse },
  dataRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.divider },
});
