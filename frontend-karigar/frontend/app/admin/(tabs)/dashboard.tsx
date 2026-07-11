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
  registration_trend: { date: string; count: number }[];
}

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

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Analytics>("/admin/analytics");
      setA(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
