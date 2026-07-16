import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";

interface AuditLogEntry {
  id: string;
  deleted_admin_name?: string;
  deleted_admin_phone: string;
  deleted_admin_role?: string;
  performed_by_name?: string;
  performed_by_phone: string;
  created_at: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminAuditLog() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const data = await apiFetch<AuditLogEntry[]>("/auth/admins/audit-log");
      setLogs(data);
    } catch (e: any) {
      setError(e.message || "Could not load the audit log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" size="xl" style={{ color: COLORS.onSurface }}>Deletion History</AppText>
          <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>
            Record of every admin account that has been removed
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <AppText size="base" style={{ color: COLORS.error, textAlign: "center", paddingHorizontal: SPACING.lg }}>
            {error}
          </AppText>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.muted} />
          <AppText size="base" style={{ color: COLORS.muted, marginTop: SPACING.md }}>
            No admin has been deleted yet
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          {logs.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Ionicons name="person-remove-outline" size={18} color={COLORS.error} />
                <AppText weight="semibold" size="base" style={{ color: COLORS.onSurface, marginLeft: 8 }}>
                  {entry.deleted_admin_name && entry.deleted_admin_name !== "—"
                    ? entry.deleted_admin_name
                    : `+91 ${entry.deleted_admin_phone}`}
                </AppText>
                {!!entry.deleted_admin_role && (
                  <View style={styles.roleBadge}>
                    <AppText size="sm" style={{ color: COLORS.onSurface, fontSize: 11 }}>
                      {entry.deleted_admin_role}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText size="sm" style={{ color: COLORS.muted, marginTop: 6 }}>
                Removed by {entry.performed_by_name || `+91 ${entry.performed_by_phone}`}
              </AppText>
              <AppText size="sm" style={{ color: COLORS.muted, marginTop: 2 }}>
                {formatDateTime(entry.created_at)}
              </AppText>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

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
  divider: { height: 1, backgroundColor: COLORS.border },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  roleBadge: {
    marginLeft: 8,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1, borderColor: COLORS.border,
  },
});
