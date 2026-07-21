import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Card, ScreenHeader, EmptyState, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { timeAgo } from "@/src/utils/profile";
import i18n from "@/src/i18n";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const n = await apiFetch<any[]>("/notifications");
      setNotifs(n);
    } catch {
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
  const markAll = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    setNotifs((ns) => ns.map((n) => ({ ...n, is_read: true })));
  };

  const lang = i18n.language;
  const title = (n: any) => n[`title_${lang}`] || n.title_en;
  const body = (n: any) => n[`body_${lang}`] || n.body_en;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t("notifications")}
        right={
          notifs.some((n) => !n.is_read) ? (
            <Pressable onPress={markAll} testID="mark-all-read-btn">
              <AppText color={COLORS.brandPrimary} weight="semibold" size="sm">
                {t("markAllRead")}
              </AppText>
            </Pressable>
          ) : undefined
        }
      />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title={t("noNotifications")} />}
          renderItem={({ item }) => (
            <Card style={[styles.row, !item.is_read && styles.unread]} testID={`notif-${item.id}`}>
              <View style={[styles.icon, { backgroundColor: COLORS.brandTertiary }]}>
                <Ionicons name={icon(item.type)} size={20} color={COLORS.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">{title(item)}</AppText>
                <AppText size="sm" color={COLORS.onSurfaceTertiary} style={{ marginTop: 2 }}>
                  {body(item)}
                </AppText>
                <AppText size="sm" color={COLORS.muted} style={{ marginTop: 4 }}>
                  {timeAgo(item.created_at)}
                </AppText>
              </View>
              {!item.is_read && <View style={styles.dot} />}
            </Card>
          )}
        />
      )}
    </View>
  );
}

function icon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "job_alert":
      return "briefcase";
    case "referral_reward":
      return "gift";
    case "training":
      return "school";
    case "verification_update":
      return "shield-checkmark";
    default:
      return "megaphone";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  row: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  unread: { borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary },
  icon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary, marginTop: 6 },
});
