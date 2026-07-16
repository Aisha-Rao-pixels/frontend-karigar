import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, shadow } from "@/src/theme";
import { AppText } from "@/src/components/ui";

export default function AdminRestricted() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, role } = useLocalSearchParams<{ name?: string; role?: string }>();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/manage-admins"))}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Admin Profile</AppText>
      </View>

      <View style={styles.divider} />

      <View style={styles.body}>
        <View style={[styles.card, shadow]}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={28} color={COLORS.brandPrimary} />
          </View>

          <AppText weight="semibold" size="lg" style={{ color: COLORS.onSurface, marginTop: SPACING.md, textAlign: "center" }}>
            Access Restricted
          </AppText>

          <AppText size="base" style={{ color: COLORS.muted, marginTop: SPACING.sm, textAlign: "center", lineHeight: 20 }}>
            Sorry, you can't modify {name ? `${name}'s` : "this admin's"} details. Admins can only edit their own profile.
          </AppText>

          {!!role && (
            <View style={styles.roleBadge}>
              <AppText size="sm" style={{ color: COLORS.onSurface }}>{role}</AppText>
            </View>
          )}

          <AppText size="sm" style={{ color: COLORS.muted, marginTop: SPACING.lg, textAlign: "center" }}>
            Need this changed? Ask a Manager, or have {name || "this admin"} update it themselves.
          </AppText>
        </View>

        <Pressable style={styles.backLink} onPress={() => router.back()}>
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
  backBtn: {
    width: 36, height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
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
  roleBadge: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  backLink: { marginTop: SPACING.xl, padding: SPACING.sm },
});
