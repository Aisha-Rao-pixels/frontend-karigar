import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, ProgressBar, StatusBadge, Card, Loader } from "@/src/components/ui";
import { Calendar } from "@/src/components/Calendar";
import { apiFetch } from "@/src/api/client";
import { Worker, profileCompletion, availabilityColor, verificationColor, timeAgo, formatDate } from "@/src/utils/profile";
import { AVAILABILITY_OPTIONS } from "@/src/constants/app";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import i18n from "@/src/i18n";

const REFERRAL_BG =
  "https://images.unsplash.com/photo-1619459074324-33d5f591c53e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwyfHx3YXJtJTIwZmFicmljJTIwdGV4dHVyZSUyMGJhY2tncm91bmQlMjBjcmFmdHxlbnwwfHx8fDE3ODEyNTk4MTd8MA&ixlib=rb-4.1.0&q=85";

// ── Profile completion helper ─────────────────────────────────────────────
function getMissingFields(worker: Worker): string[] {
  const missing: string[] = [];
  if (!worker.portfolio_images || worker.portfolio_images.length === 0)
    missing.push("Portfolio photos");
  if (!worker.aadhar_images || worker.aadhar_images.length === 0)
    missing.push("Aadhaar card");
  if (!worker.upi_id) missing.push("PhonePe/Google Pay number");
  if (!worker.employment_proof_images || worker.employment_proof_images.length === 0)
    missing.push("Employment proof");
  if (!worker.current_employer) missing.push("Current employer");
  if (!worker.wage_expectation) missing.push("Expected wage");
  return missing;
}

function completionColor(pct: number): string {
  if (pct === 100) return COLORS.success;
  if (pct >= 60) return COLORS.warning;
  return COLORS.error;
}

export default function ArtisanDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, n] = await Promise.all([
        apiFetch<Worker>("/workers/me"),
        apiFetch<any[]>("/notifications"),
      ]);
      setWorker(w);
      setNotifs(n);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user) return;
      load();
    }, [load, authLoading, user])
  );

  const commitAvailability = async (status: string, availableFrom: string | null) => {
    if (!worker) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setUpdating(true);
    setWorker({ ...worker, availability_status: status as any, available_from: availableFrom });
    try {
      await apiFetch("/workers/me/availability", {
        method: "PATCH",
        body: { availability_status: status, available_from: availableFrom },
      });
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    } finally {
      setUpdating(false);
    }
  };

  const onPickAvailability = (status: string) => {
    if (status === "available_from") {
      setPickerOpen((p) => !p);
      return;
    }
    setPickerOpen(false);
    if (!worker || status === worker.availability_status) return;
    commitAvailability(status, null);
  };

  if (loading) return <View style={styles.container}><Loader /></View>;
  if (!worker) return null;

  const completion = profileCompletion(worker);
  const missingFields = getMissingFields(worker);
  const isComplete = completion === 100;
  const lang = i18n.language;
  const notifTitle = (n: any) => n[`title_${lang}`] || n.title_en;
  const unread = notifs.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACING.md, paddingBottom: SPACING["2xl"] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brandPrimary}
            colors={[COLORS.brandPrimary]}
            progressBackgroundColor={COLORS.surfaceSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AppText size="sm" color={COLORS.muted}>
              {t("hello")} 👋
            </AppText>
            <AppText weight="bold" size="2xl" numberOfLines={1}>
              {worker.full_name}
            </AppText>
          </View>
          <Pressable
            testID="dashboard-bell"
            onPress={() => router.push("/(artisan)/notifications")}
            style={styles.bell}
          >
            <Ionicons name="notifications" size={22} color={COLORS.onSurface} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <AppText size="sm" color="#fff" weight="bold" style={{ fontSize: 10 }}>
                  {unread}
                </AppText>
              </View>
            )}
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
          <StatusTracker status={worker.verification_status as "pending" | "approved" | "rejected"} />
        </View>

        {/* Availability hero */}
        <Card style={styles.heroCard} testID="availability-card">
          <AppText weight="bold" size="lg">
            {t("yourAvailability")}
          </AppText>
          <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2, marginBottom: SPACING.md }}>
            {t("tapToChange")}
          </AppText>
          <View style={{ gap: SPACING.sm }}>
            {AVAILABILITY_OPTIONS.map((o) => {
              const active = worker.availability_status === o.value;
              const c = availabilityColor(o.value);
              return (
                <View key={o.value}>
                  <Pressable
                    onPress={() => onPickAvailability(o.value)}
                    disabled={updating}
                    style={[
                      styles.availBtn,
                      {
                        borderColor: active ? c : COLORS.border,
                        backgroundColor: active ? c + "14" : COLORS.surface,
                      },
                    ]}
                    testID={`dash-avail-${o.value}`}
                  >
                    <View style={[styles.availDot, { backgroundColor: c }]} />
                    <View style={{ flex: 1 }}>
                      <AppText
                        weight={active ? "bold" : "medium"}
                        size="lg"
                        color={active ? c : COLORS.onSurface}
                      >
                        {t(o.key)}
                      </AppText>
                      {o.value === "available_from" && active && worker.available_from ? (
                        <AppText size="sm" weight="semibold" color={c}>
                          {formatDate(worker.available_from)}
                        </AppText>
                      ) : null}
                    </View>
                    {o.value === "available_from" ? (
                      <Ionicons
                        name={pickerOpen ? "chevron-up" : "calendar-outline"}
                        size={20}
                        color={active ? c : COLORS.muted}
                      />
                    ) : active ? (
                      <Ionicons name="checkmark-circle" size={22} color={c} />
                    ) : null}
                  </Pressable>
                  {o.value === "available_from" && pickerOpen && (
                    <View style={{ marginTop: SPACING.sm }}>
                      <AppText size="sm" color={COLORS.muted} style={{ marginBottom: SPACING.xs }}>
                        {t("pickAvailableDate")}
                      </AppText>
                      <Calendar
                        value={worker.available_from || null}
                        onSelect={(iso) => {
                          commitAvailability("available_from", iso);
                          setPickerOpen(false);
                        }}
                        testID="dash-availfrom-calendar"
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Profile Completion Card ── */}
        <Card style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
              <AppText weight="semibold">{t("profileCompletion")}</AppText>
              {/* ✅ Completion Badge — shows when profile is 100% complete */}
              {isComplete && (
                <View style={styles.completeBadge} testID="profile-complete-badge">
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <AppText size="sm" weight="bold" color={COLORS.success}>
                    Complete!
                  </AppText>
                </View>
              )}
            </View>
            <AppText weight="bold" color={completionColor(completion)}>
              {completion}%
            </AppText>
          </View>

          {/* Progress bar with dynamic color */}
          <View style={{ marginTop: SPACING.sm }}>
            <ProgressBar value={completion} color={completionColor(completion)} />
          </View>

          {/* Missing fields list */}
          {!isComplete && missingFields.length > 0 && (
            <View style={styles.missingList}>
              <AppText size="sm" color={COLORS.muted} style={{ marginBottom: 4 }}>
                Complete your profile by adding:
              </AppText>
              {missingFields.map((field) => (
                <View key={field} style={styles.missingItem}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning} />
                  <AppText size="sm" color={COLORS.warning}>{field}</AppText>
                </View>
              ))}
            </View>
          )}

          {/* Edit profile link */}
          {!isComplete && (
            <Pressable
              onPress={() => router.push("/profile-form?mode=edit")}
              style={{ marginTop: SPACING.md }}
              testID="complete-profile-link"
            >
              <AppText color={COLORS.brandPrimary} weight="semibold">
                {t("editProfile")} →
              </AppText>
            </Pressable>
          )}

          {/* 🎉 Completion message */}
          {isComplete && (
            <View style={styles.completeMessage}>
              <Ionicons name="trophy" size={20} color={COLORS.success} />
              <AppText size="sm" color={COLORS.success} weight="semibold">
                Great job! Your profile is fully complete. You're more likely to get hired!
              </AppText>
            </View>
          )}
        </Card>

        {/* Referral */}
        <Pressable
          onPress={() => router.push("/referral")}
          style={styles.referralWrap}
          testID="referral-card"
        >
          <Image
            source={{ uri: REFERRAL_BG }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <View style={styles.referralOverlay} />
          <View style={{ padding: SPACING.lg }}>
            <AppText weight="bold" size="lg" color="#fff">
              {t("referFriends")}
            </AppText>
            <AppText
              size="sm"
              color="rgba(255,255,255,0.85)"
              style={{ marginTop: 4, marginBottom: SPACING.md }}
            >
              {t("referDesc")}
            </AppText>
            <View style={styles.codePill}>
              <Ionicons name="gift" size={16} color={COLORS.brandPrimary} />
              <AppText weight="bold" color={COLORS.brandPrimary}>
                {worker.referral_code}
              </AppText>
            </View>
          </View>
        </Pressable>

        {/* Notifications preview */}
        <View style={styles.rowBetween2}>
          <AppText weight="bold" size="lg">
            {t("recentNotifications")}
          </AppText>
          <Pressable onPress={() => router.push("/(artisan)/notifications")}>
            <AppText color={COLORS.brandPrimary} weight="semibold">
              {t("viewAll")}
            </AppText>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}>
          {notifs.length === 0 ? (
            <Card>
              <AppText color={COLORS.muted}>{t("noNotifications")}</AppText>
            </Card>
          ) : (
            notifs.slice(0, 3).map((n) => (
              <Card key={n.id} style={styles.notifRow}>
                <View style={[styles.notifIcon, { backgroundColor: COLORS.brandTertiary }]}>
                  <Ionicons name={notifIcon(n.type)} size={18} color={COLORS.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" numberOfLines={1}>
                    {notifTitle(n)}
                  </AppText>
                  <AppText size="sm" color={COLORS.muted}>
                    {timeAgo(n.created_at)}
                  </AppText>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Support */}
        <Pressable
          onPress={() => router.push("/support")}
          style={styles.supportLink}
          testID="support-link"
        >
          <Ionicons name="headset" size={20} color={COLORS.brandPrimary} />
          <AppText weight="semibold" color={COLORS.brandPrimary}>
            {t("getSupport")}
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function verificationKey(s: string) {
  return s === "approved" ? "verified" : s === "pending" ? "pending" : "rejected";
}

function notifIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "job_alert": return "briefcase";
    case "referral_reward": return "gift";
    case "training": return "school";
    case "verification_update": return "shield-checkmark";
    default: return "megaphone";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: { marginHorizontal: SPACING.lg, marginTop: SPACING.md },
  sectionCard: { marginHorizontal: SPACING.lg, marginTop: SPACING.md },
  availBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  availDot: { width: 16, height: 16, borderRadius: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetween2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },

  // Profile completion styles
  completeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.success + "15",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  missingList: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.warning + "10",
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    gap: 4,
  },
  missingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  completeMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.success + "10",
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },

  referralWrap: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    minHeight: 150,
  },
  referralOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(40,25,18,0.7)",
  },
  codePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  notifRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
  },
});
