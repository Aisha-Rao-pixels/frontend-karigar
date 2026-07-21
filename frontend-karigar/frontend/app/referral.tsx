import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Share, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, Card, ScreenHeader, Button, Loader } from "@/src/components/ui";
import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";

const REFERRAL_BG =
  "https://images.unsplash.com/photo-1619459074324-33d5f591c53e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwyfHx3YXJtJTIwZmFicmljJTIwdGV4dHVyZSUyMGJhY2tncm91bmQlMjBjcmFmdHxlbnwwfHx8fDE3ODEyNTk4MTd8MA&ixlib=rb-4.1.0&q=85";

export default function ReferralScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch("/referrals/me");
      setData(d);
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

  const onShare = async () => {
    if (!data) return;
    const link = `https://frontend-karigar-swart.vercel.app/login?ref=${data.referral_code}&mode=register`;
    try {
      await Share.share({ message: t("referralShareMsg", { code: data.referral_code, link }) });
    } catch {}
  };

  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.referral_code);
    show("Copied!", "success");
  };

  if (loading) return <View style={styles.container}><Loader /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("referralCenter")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}>
        <View style={styles.hero}>
          <Image source={{ uri: REFERRAL_BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.heroOverlay} />
          <View style={{ padding: SPACING.xl, alignItems: "center" }}>
            <Ionicons name="gift" size={40} color="#fff" />
            <AppText weight="bold" size="xl" color="#fff" style={{ marginTop: SPACING.sm }}>
              {t("referFriends")}
            </AppText>
            <AppText size="sm" color="rgba(255,255,255,0.85)" style={{ textAlign: "center", marginTop: 4 }}>
              {t("referDesc")}
            </AppText>
            <Pressable onPress={copy} style={styles.codeBox} testID="referral-code-box">
              <AppText weight="bold" size="2xl" color={COLORS.brandPrimary} style={{ letterSpacing: 2 }}>
                {data.referral_code}
              </AppText>
              <Ionicons name="copy-outline" size={20} color={COLORS.brandPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t("totalReferred")} value={data.referred_count} />
          <Stat label={t("paidOut")} value={`₹${data.total_paid_rs}`} color={COLORS.success} />
          <Stat label={t("pendingReward")} value={`₹${data.pending_rs}`} color={COLORS.warning} />
        </View>

        <View style={{ marginTop: SPACING.xl }}>
          <Button title={t("shareInvite")} onPress={onShare} icon="share-social" testID="share-invite-btn" />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color = COLORS.onSurface }: { label: string; value: any; color?: string }) {
  return (
    <Card style={styles.stat}>
      <AppText weight="bold" size="xl" color={color}>{value}</AppText>
      <AppText size="sm" color={COLORS.muted} style={{ marginTop: 2, textAlign: "center" }}>{label}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { borderRadius: RADIUS.lg, overflow: "hidden", minHeight: 220 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(40,25,18,0.72)" },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  stat: { flex: 1, alignItems: "center" },
});
