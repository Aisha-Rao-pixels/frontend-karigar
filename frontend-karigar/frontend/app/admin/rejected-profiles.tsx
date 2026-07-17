import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { ScreenHeader, AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
function formatDDMMYYYY(dateStr: string) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface RejectedProfile {
  id: string;
  full_name: string;
  phone: string;
  area: string;
  city: string;
  skills: string[];
  portfolio_images: string[];
  rejection_reason: string | null;
  rejected_by: string;
  rejected_at: string;
}

export default function RejectedProfiles() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<RejectedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ profiles: RejectedProfile[] }>("/admin/rejected-profiles");
      setProfiles(data.profiles);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Rejected Profiles" onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"))} />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING["2xl"] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
          }
          ListEmptyComponent={<AppText color={COLORS.muted} style={{ textAlign: "center", marginTop: SPACING.xl }}>No Rejected Profiles</AppText>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/admin/rejected-profile/${item.id}`)} style={[styles.card, shadow]} testID={`rejected-${item.id}`}>
              <View style={styles.row}>
                {item.portfolio_images?.[0] ? (
                  <Image source={{ uri: item.portfolio_images[0] }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" size="lg">{item.full_name}</AppText>
                  <AppText size="sm" color={COLORS.muted}>{item.phone} · {item.area}, {item.city}</AppText>
                  <AppText size="sm" color={COLORS.muted}>{(item.skills || []).join(", ")}</AppText>
                </View>
              </View>
              <View style={styles.reasonBox}>
                <AppText size="sm" weight="semibold" color={COLORS.error}>Reason</AppText>
                <AppText size="sm">{item.rejection_reason || "No reason given"}</AppText>
              </View>
              <AppText size="sm" color={COLORS.muted} style={{ marginTop: SPACING.xs }}>
                Rejected by {item.rejected_by} on {formatDDMMYYYY(item.rejected_at)}
              </AppText>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg },
  row: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.sm },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.md },
  thumbPlaceholder: { backgroundColor: COLORS.surfaceTertiary },
  reasonBox: { backgroundColor: COLORS.error + "0D", borderRadius: RADIUS.sm, padding: SPACING.sm, marginTop: SPACING.xs },
});
