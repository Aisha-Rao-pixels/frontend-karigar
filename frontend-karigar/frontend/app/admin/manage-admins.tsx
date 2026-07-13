import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";

interface Admin {
  id: string;
  phone: string;
  name: string;
  admin_role: string;
  created_at?: string;
  is_you: boolean;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ManageAdmins() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const a = await apiFetch<Admin[]>("/auth/admins");
      setAdmins(a);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Admin Management</AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>
            {admins.length} {admins.length === 1 ? "account" : "accounts"} registered
          </AppText>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/admin/add-admin")}
          testID="go-to-add-admin"
        >
          <Ionicons name="pencil-outline" size={16} color={COLORS.brandPrimary} />
          <AppText weight="semibold" size="sm" style={{ color: COLORS.brandPrimary, marginLeft: 6 }}>
            Edit
          </AppText>
        </Pressable>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      ) : admins.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={COLORS.muted} />
          <AppText size="base" style={{ color: COLORS.muted, marginTop: SPACING.md }}>No admins found</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.tableWrap} showsVerticalScrollIndicator={false}>

          {/* ── Table ── */}
          <View style={[styles.table, shadow]}>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <AppText weight="semibold" size="sm" style={[styles.col1, styles.headerText]}>#</AppText>
              <AppText weight="semibold" size="sm" style={[styles.col2, styles.headerText]}>Name</AppText>
              <AppText weight="semibold" size="sm" style={[styles.col3, styles.headerText]}>Role</AppText>
              <AppText weight="semibold" size="sm" style={[styles.col4, styles.headerText]}>Mobile</AppText>
              <AppText weight="semibold" size="sm" style={[styles.col5, styles.headerText]}>Added On</AppText>
            </View>

            {/* Table Rows */}
            {admins.map((item, index) => (
              <View
                key={item.id}
                style={[styles.tableRow, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}
                testID={`admin-row-${item.id}`}
              >
                {/* # */}
                <AppText size="sm" style={[styles.col1, { color: COLORS.muted }]}>
                  {index + 1}
                </AppText>

                {/* Name + YOU badge */}
                <View style={[styles.col2, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  <View style={styles.avatar}>
                    <AppText weight="semibold" size="sm" style={{ color: COLORS.onBrandPrimary }}>
                      {(item.name || item.phone).charAt(0).toUpperCase()}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold" size="sm" style={{ color: COLORS.onSurface }} numberOfLines={1}>
                      {item.name || "—"}
                    </AppText>
                    {item.is_you && (
                      <View style={styles.youBadge}>
                        <AppText size="sm" weight="semibold" style={{ color: COLORS.brandPrimary, fontSize: 10 }}>
                          YOU
                        </AppText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Role badge */}
                <View style={styles.col3}>
                  <View style={styles.roleBadge}>
                    <AppText size="sm" style={{ color: COLORS.onSurface, fontSize: 11 }} numberOfLines={1}>
                      {item.admin_role || "Admin"}
                    </AppText>
                  </View>
                </View>

                {/* Mobile */}
                <AppText size="sm" style={[styles.col4, { color: COLORS.onSurface }]}>
                  +91 {item.phone}
                </AppText>

                {/* Date */}
                <AppText size="sm" style={[styles.col5, { color: COLORS.muted }]}>
                  {formatDate(item.created_at)}
                </AppText>
              </View>
            ))}
          </View>

          {/* Footer note */}
          <AppText size="sm" style={styles.footerNote}>
            Only existing admins can add or remove other admins.
          </AppText>
        </ScrollView>
      )}
    </View>
  );
}

const COL_WIDTHS = { c1: 32, c2: 140, c3: 100, c4: 120, c5: 90 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },

  tableWrap: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  table: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceTertiary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: { color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11 },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rowEven: { backgroundColor: COLORS.surfaceSecondary },
  rowOdd: { backgroundColor: "#FDFBF9" },

  col1: { width: COL_WIDTHS.c1 },
  col2: { width: COL_WIDTHS.c2 },
  col3: { width: COL_WIDTHS.c3 },
  col4: { width: COL_WIDTHS.c4 },
  col5: { width: COL_WIDTHS.c5 },

  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  youBadge: {
    marginTop: 2,
    alignSelf: "flex-start",
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brandTertiary,
    borderWidth: 1, borderColor: COLORS.brandSecondary,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  footerNote: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
});
