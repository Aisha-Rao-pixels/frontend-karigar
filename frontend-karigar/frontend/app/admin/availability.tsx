// ── Availability (Available From) admin page ───────────────────────────────
import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { ResizableTable, ResizableTableColumn } from "@/src/components/ResizableTable";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";
import { useToast } from "@/src/components/Toast";

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

function formatAvailableFrom(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function DaysRemainingBadge({ days }: { days: number | null }) {
  if (days == null) return <AppText size="sm" color={COLORS.muted}>—</AppText>;
  if (days <= 0) {
    return <AppText size="sm" weight="semibold" color={COLORS.success}>Available today</AppText>;
  }
  const color = days <= 3 ? COLORS.warning : COLORS.onSurface;
  return (
    <AppText size="sm" weight="semibold" color={color}>
      {days} day{days !== 1 ? "s" : ""}
    </AppText>
  );
}

export default function AdminAvailability() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard"));

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      q.set("availability", "available_from");
      q.set("page_size", "200");
      const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q.toString()}`);
      const sorted = [...res.items].sort((a, b) => (a.available_from || "9999").localeCompare(b.available_from || "9999"));
      setItems(sorted);
      setTotal(res.total);
    } catch (e: any) {
      show(e.message || "Could not load availability data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const columns: ResizableTableColumn<Worker>[] = [
    {
      key: "sno", label: "S.No", width: 56, resizable: false,
      render: (_item, index) => <AppText size="sm" color={COLORS.muted}>{index + 1}</AppText>,
    },
    {
      key: "emp_id", label: "EMP_ID", width: 80, resizable: false,
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.worker_id}</AppText>,
    },
    {
      key: "name", label: "Name", width: 170,
      render: (item) => <AppText size="sm" weight="semibold" numberOfLines={1}>{item.full_name}</AppText>,
    },
    {
      key: "phone", label: "Phone", width: 130,
      render: (item) => <AppText size="sm" numberOfLines={1} color={COLORS.muted}>{item.phone || "—"}</AppText>,
    },
    {
      key: "skill", label: "Skill", width: 200,
      render: (item) => <AppText size="sm" numberOfLines={2}>{(item.skills || []).join(", ") || "—"}</AppText>,
    },
    {
      key: "city", label: "City / Area", width: 160,
      render: (item) => <AppText size="sm" numberOfLines={1}>{item.area ? `${item.area}, ` : ""}{item.city || "—"}</AppText>,
    },
    {
      key: "available_from", label: "Available From", width: 150,
      render: (item) => <AppText size="sm" weight="semibold">{formatAvailableFrom(item.available_from)}</AppText>,
    },
    {
      key: "days_remaining", label: "Days Remaining", width: 140,
      render: (item) => <DaysRemainingBadge days={daysUntil(item.available_from)} />,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Availability"
        subtitle={`${total} worker${total !== 1 ? "s" : ""} becoming available soon`}
        onBack={goBack}
      />

      <View style={styles.noteBar}>
        <Ionicons name="information-circle" size={16} color={COLORS.brandPrimary} />
        <AppText size="sm" color={COLORS.brandPrimary} style={{ flex: 1 }}>
          Workers move to "Available Now" automatically once their date arrives — no action needed here.
        </AppText>
        <Pressable onPress={load} testID="availability-refresh-btn" hitSlop={8}>
          <Ionicons name="refresh" size={18} color={COLORS.brandPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <Loader />
      ) : (
        <View style={{ flex: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}>
          <ResizableTable
            columns={columns}
            data={items}
            keyExtractor={(w) => w.id}
            onRowPress={(w) => router.push(`/admin/worker/${w.id}?from=search`)}
            testIDPrefix="availability-table"
            storageKey="admin_availability_table"
            emptyText="No workers are currently marked Available From — everyone is either Available Now or Not Available."
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  noteBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.brandTertiary,
    borderRadius: RADIUS.md,
  },
});
