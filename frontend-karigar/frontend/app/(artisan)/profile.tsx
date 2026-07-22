import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Card, Avatar, StatusBadge, Button, Loader, Chip } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { Worker, verificationColor, availabilityColor, calcAge, formatDate } from "@/src/utils/profile";
import { useAuth } from "@/src/context/AuthContext";
import { LANGUAGES } from "@/src/constants/app";
import { setLanguage } from "@/src/i18n";
import i18n from "@/src/i18n";

export default function ArtisanProfile() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logout, user, loading: authLoading } = useAuth();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const w = await apiFetch<Worker>("/workers/me");
      setWorker(w);
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

  const changeLang = async (code: string) => {
    await setLanguage(code);
    setWorker((w) => (w ? { ...w } : w)); // re-render
  };

  if (loading) return <View style={styles.container}><Loader /></View>;
  if (!worker) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SPACING.lg, paddingBottom: SPACING["2xl"] }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Avatar name={worker.full_name} size={72} />
          <AppText weight="bold" size="2xl" style={{ marginTop: SPACING.md }}>
            {worker.full_name}
          </AppText>
          <AppText size="base" color={COLORS.muted}>
            +91 {worker.phone} · {worker.area}, {worker.city}
          </AppText>
          {worker.worker_id && (
            <AppText size="sm" weight="semibold" color={COLORS.primary} style={{ marginTop: 4 }}>
              {t("empId") || "Employee ID"}: {worker.worker_id}
            </AppText>
          )}
          <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
            <StatusBadge label={t(vKey(worker.verification_status))} color={verificationColor(worker.verification_status)} />
            <StatusBadge
              label={worker.availability_status === "available_from" && worker.available_from
                ? `${t("avail_from")} · ${formatDate(worker.available_from)}`
                : t(aKey(worker.availability_status))}
              color={availabilityColor(worker.availability_status)}
            />
          </View>
        </View>

        {worker.verification_status === "rejected" && worker.rejection_reason && (
          <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: COLORS.error }]}>
            <AppText weight="semibold" color={COLORS.error}>{t("rejectionReason")}</AppText>
            <AppText style={{ marginTop: 4 }}>{worker.rejection_reason}</AppText>
          </Card>
        )}

        <Card style={styles.card}>
          {worker.dob ? <Row label={t("dob")} value={`${worker.dob} (${calcAge(worker.dob)} ${t("yearsShort")})`} /> : null}
          <Row label={t("gender")} value={t(worker.gender)} />
          <Row label={t("experience")} value={`${worker.years_experience} ${t("yearsShort")}`} />
          {worker.wage_expectation ? <Row label={t("wage")} value={`₹${worker.wage_expectation} ${t("perMonth")}`} /> : null}
          {worker.current_employer ? <Row label={t("currentEmployer")} value={worker.current_employer} /> : null}
          <Row label={t("languagesSpoken")} value={worker.languages.join(", ")} last />
        </Card>

        <View style={{ paddingHorizontal: SPACING.lg }}>
          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("skills")}</AppText>
          <View style={styles.wrap}>
            {worker.skills.map((s) => (
              <View key={s} style={styles.skillTag}>
                <AppText size="sm" color={COLORS.onBrandTertiary} weight="semibold">{s}</AppText>
              </View>
            ))}
          </View>
        </View>

        {worker.portfolio_images.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <AppText weight="semibold" style={{ marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg }}>
              {t("portfolio")}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}>
              {worker.portfolio_images.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.portfolio} contentFit="cover" />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.xl }}>
          <Button title={t("editProfile")} onPress={() => router.push("/profile-form?mode=edit")} icon="create-outline" testID="edit-profile-btn" />
        </View>

        {/* Language */}
        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.xl }}>
          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("chooseLanguage")}</AppText>
          <View style={styles.row}>
            {LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.native} selected={i18n.language === l.code} onPress={() => changeLang(l.code)} testID={`profile-lang-${l.code}`} />
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.xl }}>
          <Button title={t("logout")} variant="secondary" onPress={async () => { await logout(); router.replace("/login"); }} icon="log-out-outline" testID="logout-btn" />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <AppText color={COLORS.muted} size="base">{label}</AppText>
      <AppText weight="semibold" size="base" style={{ flex: 1, textAlign: "right", marginLeft: SPACING.md }}>{value}</AppText>
    </View>
  );
}
function vKey(s: string) { return s === "approved" ? "verified" : s === "pending" ? "pending" : "rejected"; }
function aKey(s: string) { return s === "available_now" ? "avail_now" : s === "available_from" ? "avail_from" : "avail_no"; }

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  head: { alignItems: "center", paddingHorizontal: SPACING.lg },
  card: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  skillTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill },
  portfolio: { width: 120, height: 120, borderRadius: RADIUS.md },
});
