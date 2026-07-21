import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { AppText, Avatar, EmptyState, Loader } from "@/src/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { Worker, timeAgo } from "@/src/utils/profile";

export default function VerificationCenter() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Worker[]>("/admin/verification/queue");
      setItems(res);
    } catch (e: any) {
      console.error("Verification queue load failed:", e?.message || e);
      show(e?.message || t("genericError"), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user) return;
      load();
    }, [load, authLoading, user])
  );
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="verify-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.onSurface} />
          </Pressable>
          <AppText weight="bold" size="2xl">{t("verificationCenter")}</AppText>
        </View>
        {!loading && <AppText size="sm" color={COLORS.muted} style={{ marginLeft: 32 }}>{t("pendingReviews", { count: items.length })}</AppText>}
      </View>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
          ListEmptyComponent={<EmptyState icon="checkmark-done-circle-outline" title={t("allCaughtUp")} subtitle={t("noPending")} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/admin/review/${item.id}?from=verify`)} style={[styles.card, shadow]} testID={`queue-item-${item.id}`}>
              {item.duplicate_flags && item.duplicate_flags.length > 0 && (
                <View style={styles.dupBadge} testID={`dup-badge-${item.id}`}>
                  <AppText size="sm" weight="bold" color="#fff" style={{ fontSize: 10 }}>!</AppText>
                </View>
              )}
              <Avatar name={item.full_name} size={48} />
              <View style={{ flex: 1 }}>
                <AppText weight="bold" numberOfLines={1}>{item.full_name}</AppText>
                <AppText size="sm" color={COLORS.muted} numberOfLines={1}>
                  {item.skills.join(", ")}
                </AppText>
                <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2 }}>
                  {item.area}, {item.city} · {timeAgo(item.created_at)}
                </AppText>
              </View>
              <View style={styles.reviewPill}>
                <AppText size="sm" weight="bold" color={COLORS.onBrandPrimary}>{t("reviewProfile")}</AppText>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  card: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning, position: "relative" },
  reviewPill: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill },
  dupBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
