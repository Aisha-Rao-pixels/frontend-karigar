import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Loader, Button } from "@/src/components/ui";
import { Panel, StatTile, BarList, ColumnChart, SegmentBar, SERIES } from "@/src/components/charts";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

interface Analytics {
  kpis: {
    total_workers: number;
    verified_workers: number;
    pending_verification: number;
    rejected_workers: number;
    available_workers: number;
    new_today: number;
    new_this_week: number;
    rejected_profiles: number;
    total_referrals: number;
  };
  location_distribution: { area: string; city: string; count: number; pct: number }[];
  skill_distribution: { skill: string; count: number }[];
  verification_funnel: { approved: number; pending: number; rejected: number };
  availability_distribution: { available_now: number; available_from: number; not_available: number };
  experience_buckets: { label: string; count: number }[];
  gender_distribution: { male: number; female: number; other: number };
  registration_trend: { label: string; date_from: string; date_to: string; date?: string; count: number }[];
  trend_period?: "day" | "week" | "month";
}

// Aligned by index with the fixed backend order of experience_buckets
// (0-2 yrs, 3-5 yrs, 6-10 yrs, 10+ yrs) — used to drive the Experience
// Mix drill-down into the worker directory.
const EXP_RANGES: { min_exp: number; max_exp?: number }[] = [
  { min_exp: 0, max_exp: 2 },
  { min_exp: 3, max_exp: 5 },
  { min_exp: 6, max_exp: 10 },
  { min_exp: 11 },
];

type TrendPeriod = "day" | "week" | "month";

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">("idle");
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("day");

  const sendSummaryEmail = async () => {
    setSendingEmail(true);
    setEmailStatus("idle");
    try {
      await apiFetch("/admin/daily-summary/run", { method: "POST" });
      setEmailStatus("success");
    } catch {
      setEmailStatus("error");
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailStatus("idle"), 4000);
    }
  };

  const load = useCallback(async (period?: TrendPeriod) => {
    try {
      const data = await apiFetch<Analytics>(`/admin/analytics?period=${period ?? trendPeriod}`);
      setA(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendPeriod]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeTrendPeriod = (period: TrendPeriod) => {
    if (period === trendPeriod) return;
    setTrendPeriod(period);
    load(period);
  };

  if (loading || !a) return <View style={styles.container}><Loader /></View>;

  const k = a.kpis;
  const topLoc = a.location_distribution[0];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING["3xl"] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brandPrimary} />
        }
      >
        {/* Dark header band */}
        <View style={[styles.hero, { paddingTop: insets.top + SPACING.md }]}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <AppText size="sm" color="rgba(255,255,255,0.6)" weight="semibold" style={{ letterSpacing: 1 }}>
                {t("workforceIntelligence").toUpperCase()}
              </AppText>
              <AppText weight="bold" size="2xl" color="#fff" style={{ marginTop: 2 }}>
                {t("adminDashboard")}
              </AppText>
              <AppText size="sm" color="rgba(255,255,255,0.55)" style={{ textTransform: "capitalize", marginTop: 2 }}>
                {t("administrator")}
              </AppText>
            </View>
            <Pressable
              onPress={async () => { await logout(); router.replace("/admin/login"); }}
              testID="admin-logout-btn"
              style={({ pressed }) => [
                styles.logoutBtn,
                { backgroundColor: pressed ? "#EF4444" : "rgba(255,255,255,0.12)",
                  transform: [{ scale: pressed ? 0.93 : 1 }] }
              ]}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* KPI tiles — 2 rows x 3 columns */}
          <View style={styles.kpiRow}>
            <StatTile
              label={t("totalWorkers")}
              value={k.total_workers}
              delta={`+${k.new_this_week}`}
              icon="people"
              tint={SERIES[0]}
              testID="kpi-total"
              onPress={() => router.push({ pathname: "/admin/search", params: { verification: "all", availability: "all" } })}
            />
            <StatTile
              label={t("availableWorkers")}
              value={k.available_workers}
              icon="flash"
              tint={SERIES[1]}
              testID="kpi-available"
              onPress={() => router.push({ pathname: "/admin/search", params: { availability: "available_now" } })}
            />
            <StatTile
              label={t("verifiedWorkers")}
              value={k.verified_workers}
              icon="shield-checkmark"
              tint={SERIES[2]}
              testID="kpi-verified"
              onPress={() => router.push({ pathname: "/admin/search", params: { verification: "approved" } })}
            />
          </View>
          <View style={styles.kpiRow}>
            <StatTile
              label={t("pendingVerification")}
              value={k.pending_verification}
              icon="hourglass"
              tint={SERIES[3]}
              testID="kpi-pending"
              onPress={() => router.push("/admin/verify")}
            />
            <StatTile
              label="Referrals"
              value={k.total_referrals}
              icon="gift"
              tint={SERIES[4]}
              testID="kpi-referrals"
              onPress={() => router.push("/admin/referrals")}
            />
            <StatTile
              label="Rejected Profiles"
              value={k.rejected_profiles}
              icon="close-circle"
              tint={COLORS.error}
              testID="kpi-rejected"
              onPress={() => router.push("/admin/rejected-profiles")}
            />
          </View>
        </View>

        <View style={{ height: SPACING.lg }} />

        {/* Location concentration — headline */}
        <Panel
          title={t("locationConcentration")}
          subtitle={t("whereRegistering")}
          icon="location"
          iconTint={SERIES[0]}
          testID="panel-location"
        >
          {topLoc && (
            <View style={styles.hotspot}>
              <View style={styles.hotspotIcon}>
                <Ionicons name="flame" size={16} color={SERIES[0]} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText size="sm" color={COLORS.muted}>{t("topHotspot")}</AppText>
                <AppText weight="bold" size="lg">{topLoc.area}</AppText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <AppText weight="bold" size="2xl" color={SERIES[0]}>{topLoc.pct}%</AppText>
                <AppText size="sm" color={COLORS.muted}>{t("ofWorkforce")}</AppText>
              </View>
            </View>
          )}
          <BarList
            data={a.location_distribution.slice(0, 7).map((l) => ({ label: l.area, value: l.count, pct: l.pct }))}
            showPct
            colorFor={(i) => (i === 0 ? SERIES[0] : COLORS.brandSecondary)}
            testID="location-bars"
            onItemPress={(item) => {
              router.push({
                pathname: "/admin/search",
                params: { area: item.label, view: "table", verification: "approved" },
              });
            }}
          />
        </Panel>

        {/* Registration trend */}
        <Panel
          title={t("registrationTrend")}
          subtitle={
            trendPeriod === "day" ? t("last14Days")
            : trendPeriod === "week" ? "Last 12 weeks"
            : "Last 12 months"
          }
          icon="trending-up"
          iconTint={SERIES[1]}
          testID="panel-trend"
          right={
            <View style={styles.periodToggle}>
              {(["day", "week", "month"] as TrendPeriod[]).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => changeTrendPeriod(p)}
                  style={[styles.periodBtn, trendPeriod === p && styles.periodBtnActive]}
                  testID={`trend-period-${p}`}
                >
                  <AppText
                    size="sm"
                    weight="semibold"
                    color={trendPeriod === p ? COLORS.onBrandPrimary : COLORS.muted}
                    style={{ textTransform: "capitalize" }}
                  >
                    {p}
                  </AppText>
                </Pressable>
              ))}
            </View>
          }
        >
          <ColumnChart
            data={a.registration_trend.map((d) => ({ label: d.label, value: d.count }))}
            tint={SERIES[1]}
            testID="trend-chart"
            onBarPress={(_bar, i) => {
              const bucket = a.registration_trend[i];
              if (!bucket) return;
              if (bucket.date_from === bucket.date_to) {
                router.push(`/admin/registrations/${bucket.date_from}`);
              } else {
                router.push({
                  pathname: `/admin/registrations/${bucket.date_from}`,
                  params: { to: bucket.date_to, label: bucket.label },
                });
              }
            }}
          />
        </Panel>

        {/* Skill distribution */}
        <Panel title={t("skillDistribution")} subtitle={t("topSkillsSubtitle")} icon="construct" iconTint={SERIES[4]} testID="panel-skills">
          <BarList
            data={a.skill_distribution.slice(0, 8).map((s) => ({ label: s.skill, value: s.count }))}
            colorFor={(i) => SERIES[i % SERIES.length]}
            testID="skill-bars"
          />
        </Panel>

        {/* Verification + availability */}
        <Panel title={t("verificationFunnel")} icon="shield-checkmark" iconTint={SERIES[2]} testID="panel-verification">
          <SegmentBar
            segments={[
              { label: t("verified"), value: a.verification_funnel.approved, color: COLORS.success },
              { label: t("pending"), value: a.verification_funnel.pending, color: COLORS.warning },
              { label: t("rejected"), value: a.verification_funnel.rejected, color: COLORS.error },
            ]}
            testID="verification-segments"
          />
        </Panel>

        <Panel
          title={t("availabilitySplit")}
          subtitle="Tap “Available From” to see who's coming available and when"
          icon="flash"
          iconTint={SERIES[1]}
          testID="panel-availability"
        >
          <SegmentBar
            segments={[
              { label: t("avail_now"), value: a.availability_distribution.available_now, color: COLORS.success, key: "available_now" },
              { label: t("avail_from"), value: a.availability_distribution.available_from, color: COLORS.warning, key: "available_from" },
              { label: t("avail_no"), value: a.availability_distribution.not_available, color: COLORS.error, key: "not_available" },
            ]}
            testID="availability-segments"
            onSegmentPress={(key) => {
              if (key === "available_from") router.push("/admin/availability");
              else router.push({ pathname: "/admin/search", params: { availability: key, view: "table" } });
            }}
          />
        </Panel>

        {/* Experience mix */}
        <Panel title={t("experienceMix")} icon="bar-chart" iconTint={SERIES[5]} testID="panel-experience">
          <BarList
            data={a.experience_buckets.map((b) => ({ label: b.label, value: b.count }))}
            colorFor={(i) => SERIES[(i + 2) % SERIES.length]}
            testID="experience-bars"
            onItemPress={(_item, i) => {
              const range = EXP_RANGES[i];
              if (!range) return;
              router.push({
                pathname: "/admin/search",
                params: {
                  min_exp: String(range.min_exp),
                  ...(range.max_exp != null ? { max_exp: String(range.max_exp) } : {}),
                  view: "table",
                },
              });
            }}
          />
        </Panel>

        {/* Verification queue CTA */}
        <Pressable
          onPress={() => router.push("/admin/verify")}
          testID="verify-queue-cta"
          style={({ pressed }) => [
            styles.queueCard,
            {
              backgroundColor: pressed ? "#FFF3E0" : COLORS.surfaceSecondary,
              borderColor: pressed ? COLORS.warning : COLORS.border,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              shadowOpacity: pressed ? 0.14 : 0.06,
              shadowRadius: pressed ? 12 : 8,
              elevation: pressed ? 5 : 2,
            }
          ]}
        >
          <View style={[styles.queueIcon, { backgroundColor: COLORS.warning + "1A" }]}>
            <Ionicons name="shield-checkmark" size={24} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="bold" size="lg">{t("verificationQueue")}</AppText>
            <AppText size="sm" color={COLORS.muted}>{t("pendingReviews", { count: k.pending_verification })}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.muted} />
        </Pressable>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.md, marginTop: SPACING.sm }}>
          <Button title={t("viewDirectory")} variant="secondary" onPress={() => router.push("/admin/search")} icon="search" testID="view-directory-btn" />
          <Button title={t("registerWorker")} onPress={() => router.push("/admin/register")} icon="person-add" testID="register-worker-btn" />
          <Button title={t("skillManagement")} variant="ghost" onPress={() => router.push("/admin/skills")} icon="construct" testID="skills-btn" />
          <Button title={t("manageAdmins")} variant="ghost" onPress={() => router.push("/admin/manage-admins")} icon="people-circle" testID="manage-admins-btn" />
          <Button title="Availability" variant="ghost" onPress={() => router.push("/admin/availability")} icon="time" testID="availability-btn" />
          <Button title="Referral Dashboard" variant="ghost" onPress={() => router.push("/admin/referrals")} icon="gift" testID="referrals-dashboard-btn" />

          {/* Send Summary Email Button */}
          <Pressable
            onPress={sendSummaryEmail}
            disabled={sendingEmail}
            testID="send-summary-btn"
            style={[
              styles.summaryBtn,
              emailStatus === "success" && styles.summaryBtnSuccess,
              emailStatus === "error"   && styles.summaryBtnError,
            ]}
          >
            <Ionicons
              name={
                sendingEmail ? "time-outline"
                : emailStatus === "success" ? "checkmark-circle"
                : emailStatus === "error"   ? "alert-circle"
                : "mail"
              }
              size={20}
              color="#fff"
            />
            <AppText weight="semibold" size="sm" color="#fff" style={{ marginLeft: 8 }}>
              {sendingEmail
                ? "Sending..."
                : emailStatus === "success"
                ? "Email Sent to Manager 2713"
                : emailStatus === "error"
                ? "Failed — Try Again"
                : "Send Summary Email to Manager"}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: {
    backgroundColor: COLORS.surfaceInverse,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  heroRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: SPACING.lg },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  kpiRow: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.md },
  hotspot: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.brandTertiary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  hotspotIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  queueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  queueIcon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  summaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7A2E1D",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  summaryBtnSuccess: { backgroundColor: "#2D7A4F" },
  summaryBtnError:   { backgroundColor: "#B91C1C" },
  periodToggle: { flexDirection: "row", gap: 2, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: 2 },
  periodBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.sm - 2 },
  periodBtnActive: { backgroundColor: COLORS.brandPrimary },
});
