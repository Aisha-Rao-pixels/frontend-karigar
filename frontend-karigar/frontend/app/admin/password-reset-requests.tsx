import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { ScreenHeader, AppText, Loader, Chip, EmptyState, Card } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";

interface ResetRequest {
  id: string;
  phone: string;
  code: string;
  status: "pending" | "resolved";
  full_name: string | null;
  created_at: string;
  resolved_at: string | null;
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function PasswordResetRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ requests: ResetRequest[] }>("/admin/password-reset-requests");
      setRequests(data.requests);
    } catch {
      show("Could not load password reset requests", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markResolved = async (id: string) => {
    setResolvingId(id);
    try {
      await apiFetch(`/admin/password-reset-requests/${id}/resolve`, { method: "PATCH" });
      show("Marked as resolved", "success");
      await load();
    } catch {
      show("Something went wrong", "error");
    } finally {
      setResolvingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const resolvedCount = requests.filter((r) => r.status === "resolved").length;
  const visible = requests.filter((r) => filter === "all" || r.status === filter);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Password Reset Requests"
        subtitle={`${pendingCount} awaiting your call`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"))}
      />

      <View style={styles.filterRow}>
        <Chip label={`Pending (${pendingCount})`} selected={filter === "pending"} onPress={() => setFilter("pending")} />
        <Chip label={`Resolved (${resolvedCount})`} selected={filter === "resolved"} onPress={() => setFilter("resolved")} />
        <Chip label={`All (${requests.length})`} selected={filter === "all"} onPress={() => setFilter("all")} />
      </View>

      {loading ? (
        <Loader label="Loading requests…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title={filter === "pending" ? "All caught up" : filter === "resolved" ? "No resolved requests yet" : "No requests yet"}
          subtitle={
            filter === "pending"
              ? "No one is waiting on a password reset call right now."
              : "Password reset requests will show up here as workers ask for help."
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: SPACING["3xl"] }} showsVerticalScrollIndicator={false}>
        {visible.map((r) => (
          <View key={r.id} style={styles.card} testID={`reset-request-${r.id}`}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <AppText weight="bold" size="lg">{r.full_name || "Unknown worker"}</AppText>
                <AppText size="sm" color={COLORS.muted}>+91 {r.phone}</AppText>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (r.status === "pending" ? COLORS.warning : COLORS.success) + "1A" }]}>
                <AppText size="sm" weight="semibold" color={r.status === "pending" ? COLORS.warning : COLORS.success}>
                  {r.status === "pending" ? "Pending" : "Resolved"}
                </AppText>
              </View>
            </View>

            <AppText size="sm" color={COLORS.muted} style={{ marginTop: SPACING.sm }}>
              Requested {formatDateTime(r.created_at)}
            </AppText>
            {r.resolved_at && (
              <AppText size="sm" color={COLORS.muted}>Resolved {formatDateTime(r.resolved_at)}</AppText>
            )}

            {r.status === "pending" && (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => Linking.openURL(`tel:+91${r.phone}`)}
                  style={styles.callBtn}
                  testID={`call-worker-${r.id}`}
                >
                  <Ionicons name="call" size={16} color="#fff" />
                  <AppText size="sm" weight="semibold" color="#fff" style={{ marginLeft: 6 }}>Call</AppText>
                </Pressable>

                <Pressable
                  onPress={() => setRevealedId(revealedId === r.id ? null : r.id)}
                  style={styles.codeBtn}
                  testID={`reveal-code-${r.id}`}
                >
                  <Ionicons name={revealedId === r.id ? "eye-off" : "eye"} size={16} color={COLORS.brandPrimary} />
                  <AppText size="sm" weight="semibold" color={COLORS.brandPrimary} style={{ marginLeft: 6 }}>
                    {revealedId === r.id ? r.code : "Show code"}
                  </AppText>
                </Pressable>

                <Pressable
                  onPress={() => markResolved(r.id)}
                  disabled={resolvingId === r.id}
                  style={styles.resolveBtn}
                  testID={`resolve-${r.id}`}
                >
                  <AppText size="sm" weight="semibold" color={COLORS.muted}>
                    {resolvingId === r.id ? "..." : "Mark resolved"}
                  </AppText>
                </Pressable>
              </View>
            )}
          </Card>
        ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  filterRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: SPACING["3xl"] },
  card: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, flexWrap: "wrap" },
  callBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  codeBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.brandPrimary + "12",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  resolveBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceTertiary,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
});
