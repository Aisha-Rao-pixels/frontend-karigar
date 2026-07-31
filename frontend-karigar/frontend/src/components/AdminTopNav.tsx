import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";

const LINKS: { href: "/admin/dashboard" | "/admin/search" | "/admin/verify"; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { href: "/admin/dashboard", labelKey: "tabHome", icon: "grid-outline" },
  { href: "/admin/search", labelKey: "tabSearch", icon: "search-outline" },
  { href: "/admin/verify", labelKey: "tabVerify", icon: "shield-checkmark-outline" },
];

export default function AdminTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <View style={styles.bar} testID="admin-top-nav">
      <Pressable onPress={() => router.push("/admin/dashboard")} style={styles.brand} testID="admin-nav-brand">
        <View style={styles.brandMark}>
          <Ionicons name="hammer" size={16} color={COLORS.onBrandPrimary} />
        </View>
        <AppText weight="bold" size="lg">Karigar Admin</AppText>
      </Pressable>

      <View style={styles.links}>
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Pressable
              key={link.href}
              onPress={() => router.push(link.href)}
              style={[styles.link, active && styles.linkActive]}
              testID={`admin-nav-${link.href.split("/").pop()}`}
            >
              <Ionicons name={link.icon} size={16} color={active ? COLORS.brandPrimary : COLORS.muted} />
              <AppText size="sm" weight={active ? "semibold" : "regular"} color={active ? COLORS.brandPrimary : COLORS.muted} style={{ marginLeft: 6 }}>
                {t(link.labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => logout()} style={styles.logout} testID="admin-nav-logout">
        <Ionicons name="log-out-outline" size={16} color={COLORS.muted} />
        <AppText size="sm" color={COLORS.muted} style={{ marginLeft: 6 }}>Log out</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceSecondary,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginRight: SPACING.xl },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  links: { flexDirection: "row", gap: SPACING.xs, flex: 1 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  linkActive: { backgroundColor: COLORS.brandTertiary },
  logout: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
});
