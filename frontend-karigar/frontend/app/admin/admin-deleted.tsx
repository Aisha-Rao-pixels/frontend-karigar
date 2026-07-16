import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";

export default function AdminDeleted() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name?: string }>();

  const goToAdminList = () => {
    // Always land back on the admin list, regardless of navigation history
    router.replace("/admin/manage-admins");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <View style={styles.header}>
        <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Admin Removed</AppText>
      </View>

      <View style={styles.divider} />

      <View style={styles.body}>
        <View style={[styles.card, shadow]}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.brandPrimary} />
          </View>

          <AppText weight="semibold" size="lg" style={{ color: COLORS.onSurface, marginTop: SPACING.md, textAlign: "center" }}>
            You have deleted {name ? `Mr. ${name}'s` : "this admin's"} profile
          </AppText>

          <AppText size="base" style={{ color: COLORS.muted, marginTop: SPACING.sm, textAlign: "center", lineHeight: 20 }}>
            {name || "This admin"} no longer has access to the admin dashboard. This action cannot be undone.
          </AppText>
        </View>

        <Pressable style={styles.backLink} onPress={goToAdminList} testID="back-to-admin-list">
          <AppText weight="semibold" size="base" style={{ color: COLORS.brandPrimary }}>Back to Admin List</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: "center",
  },
  iconWrap: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  backLink: { marginTop: SPACING.xl, padding: SPACING.sm },
});
