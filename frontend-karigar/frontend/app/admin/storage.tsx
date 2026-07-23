import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING } from "@/src/theme";
import { AppText, Loader, ScreenHeader } from "@/src/components/ui";
import { Panel, StatTile, SegmentBar } from "@/src/components/charts";
import { apiFetch } from "@/src/api/client";

// Atlas free tier (M0) hard cap. Update this if you upgrade your plan.
const CAP_MB = 512;

interface StorageStats {
  total_mb: number;
  orphaned_mb: number;
  total_files: number;
  orphaned_files: number;
}

export default function StoragePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<StorageStats>(
        "/admin/maintenance/cleanup-orphaned-images?dry_run=true",
        { method: "POST" }
      );
      setStats(res);
    } catch {
      // keep old stats visible on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const usedMb = stats?.total_mb ?? 0;
  const availableMb = Math.max(0, CAP_MB - usedMb);
  const pct = Math.min(100, Math.round((usedMb / CAP_MB) * 100));
  const barColor = pct >= 90 ? COLORS.error : pct >= 70 ? COLORS.warning : COLORS.success;

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/admin/(tabs)/dashboard");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Storage" subtitle="Photo storage usage" onBack={goBack} />

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          <Panel title="Storage Used" subtitle={`${pct}% of ${CAP_MB} MB used`} icon="server">
            <SegmentBar
              segments={[
                { label: "Used", value: usedMb, color: barColor },
                { label: "Available", value: availableMb, color: COLORS.surfaceTertiary },
              ]}
            />

            <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg }}>
              <StatTile label="Used (MB)" value={usedMb.toFixed(1)} icon="cloud-upload" tint={barColor} />
              <StatTile label="Available (MB)" value={availableMb.toFixed(1)} icon="cloud-done" tint={COLORS.success} />
            </View>

            <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md }}>
              <StatTile
                label="Total Photos (tap to view)"
                value={stats?.total_files ?? 0}
                icon="images"
                onPress={() => router.push("/admin/search")}
              />
              <StatTile
                label="Unused Photos"
                value={stats?.orphaned_files ?? 0}
                icon="trash"
                tint={COLORS.warning}
              />
            </View>

            {pct >= 90 && (
              <AppText size="sm" color={COLORS.error} style={{ marginTop: SPACING.md }}>
                Storage is nearly full. New photo uploads may start failing soon.
              </AppText>
            )}
          </Panel>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
});
