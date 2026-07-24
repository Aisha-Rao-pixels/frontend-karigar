import React, { useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import { LANGUAGES } from "@/src/constants/app";
import { setLanguage } from "@/src/i18n";
import { useAuth } from "@/src/context/AuthContext";

const SPLASH_BG =
  "https://images.unsplash.com/photo-1591195854242-8804547cdcab?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHx3YXJtJTIwZmFicmljJTIwdGV4dHVyZSUyMGJhY2tncm91bmQlMjBjcmFmdHxlbnwwfHx8fDE3ODEyNTk4MTd8MA&ixlib=rb-4.1.0&q=85";

export default function LanguageScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selected, setSelected] = useState("en");

  const onContinue = async () => {
    await setLanguage(selected);
    if (!user) router.push("/login");
    else if (user.role === "karigar")
      router.replace(user.has_profile ? "/(artisan)/dashboard" : "/profile-form?mode=create");
    else router.replace("/admin/dashboard");
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: SPLASH_BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(26,24,23,0.4)", "rgba(26,24,23,0.95)"]}
        locations={[0, 0.4, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="cut" size={26} color={COLORS.onBrandPrimary} />
          </View>
          <AppText weight="bold" size="2xl" color="#fff">
            {t("appName")}
          </AppText>
        </View>

        <AppText weight="bold" size="2xl" color="#fff" style={{ marginBottom: 4 }}>
          {t("chooseLanguage")}
        </AppText>
        <AppText size="base" color="rgba(255,255,255,0.8)" style={{ marginBottom: SPACING.xl }}>
          {t("languagePrompt")}
        </AppText>

        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
          {LANGUAGES.map((l) => {
            const active = selected === l.code;
            return (
              <Pressable
                key={l.code}
                testID={`lang-option-${l.code}`}
                onPress={() => setSelected(l.code)}
                style={[styles.langPill, active && styles.langPillActive]}
              >
                <AppText weight="semibold" size="lg" color={active ? COLORS.onBrandPrimary : "#fff"}>
                  {l.native}
                </AppText>
                {active && <Ionicons name="checkmark-circle" size={22} color={COLORS.onBrandPrimary} />}
              </Pressable>
            );
          })}
        </View>

        <Button title={t("continue")} onPress={onContinue} testID="language-continue-btn" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceInverse },
  content: { flex: 1, justifyContent: "flex-end", padding: SPACING.xl, paddingBottom: SPACING["3xl"] },
  brandRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.xl },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  langPillActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
});
